use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;

use super::activity::{
    clear_local_inference_activity, set_local_inference_activity_detailed, LocalInferencePhase,
};
use super::catalog::find_lora_attachment;
use super::download_cache::{
    copy_file_to_bundle, copy_file_to_cache, ensure_hf_cache_root, hf_cache_blob_path,
};
use super::download_http::download_http_file;
use super::download_paths::lora_download_part_path;
use super::download_control::{
    apply_download_interrupt, check_interrupt, finish_running_task, DOWNLOAD_PAUSED_MESSAGE,
};
use super::download_progress::reset_download_speed_sample;
use super::model_assets::asset_file_ready;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoraAssetsFile {
    bundles: Vec<LoraAssetBundle>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoraAssetBundle {
    lora_id: String,
    directory: String,
    file_name: String,
    download_url: String,
    #[serde(default)]
    hf_repo: Option<String>,
    #[serde(default)]
    hf_revision: Option<String>,
    #[serde(default)]
    estimated_size_mb: u64,
}

fn load_lora_assets_file() -> Result<LoraAssetsFile, String> {
    serde_json::from_str(include_str!(
        "../../../../resources/local_lora_assets.json"
    ))
    .map_err(|error| format!("解析 LoRA 资产 manifest 失败：{error}"))
}

fn find_lora_bundle(lora_id: &str) -> Result<LoraAssetBundle, String> {
    let normalized = lora_id.trim();
    load_lora_assets_file()?
        .bundles
        .into_iter()
        .find(|bundle| bundle.lora_id == normalized)
        .ok_or_else(|| format!("未找到 LoRA 资产定义：{normalized}"))
}

pub fn lora_destination_path(models_root: &Path, lora_id: &str) -> Result<PathBuf, String> {
    let bundle = find_lora_bundle(lora_id)?;
    Ok(models_root.join("loras").join(&bundle.directory).join(&bundle.file_name))
}

pub fn lora_assets_installed(models_root: &Path, lora_id: &str) -> bool {
    lora_destination_path(models_root, lora_id)
        .ok()
        .and_then(|path| {
            find_lora_bundle(lora_id)
                .ok()
                .map(|bundle| asset_file_ready(&path, bundle.estimated_size_mb))
        })
        .unwrap_or(false)
}

fn finalize_lora_part(
    models_root: &Path,
    part_path: &Path,
    destination: &Path,
    bundle: &LoraAssetBundle,
) -> Result<(), String> {
    if !part_path.is_file() {
        return Err(format!(
            "找不到已下载的 LoRA 临时文件：{}",
            part_path.display()
        ));
    }

    if let Some(cache_path) = hf_cache_blob_path(
        models_root,
        bundle.hf_repo.as_deref(),
        bundle.hf_revision.as_deref(),
        bundle.file_name.as_str(),
    ) {
        copy_file_to_cache(part_path, &cache_path)?;
    }

    copy_file_to_bundle(part_path, destination)?;
    fs::remove_file(part_path).map_err(|error| format!("清理 LoRA 临时文件失败：{error}"))?;
    Ok(())
}

fn propagate_interrupt(partial_path: &Path) -> Result<(), String> {
    match check_interrupt() {
        Ok(()) => Ok(()),
        Err(interrupt) => Err(apply_download_interrupt(interrupt, Some(partial_path))),
    }
}

pub fn ensure_lora_assets(
    models_root: &Path,
    lora_id: &str,
    hf_endpoint: &str,
) -> Result<PathBuf, String> {
    let _catalog = find_lora_attachment(lora_id)?;
    let bundle = find_lora_bundle(lora_id)?;
    let destination = models_root.join("loras").join(&bundle.directory).join(&bundle.file_name);

    if asset_file_ready(&destination, bundle.estimated_size_mb) {
        finish_running_task();
        return Ok(destination);
    }

    struct ActivityGuard {
        should_clear: bool,
    }
    impl Drop for ActivityGuard {
        fn drop(&mut self) {
            reset_download_speed_sample();
            if self.should_clear {
                clear_local_inference_activity();
            }
        }
    }
    let mut guard = ActivityGuard {
        should_clear: true,
    };

    reset_download_speed_sample();
    ensure_hf_cache_root(models_root)?;

    let estimated_bytes = bundle.estimated_size_mb.saturating_mul(1024 * 1024);
    let part_path = lora_download_part_path(models_root, lora_id);
    let label = format!("LoRA · {}", _catalog.label);

    set_local_inference_activity_detailed(
        LocalInferencePhase::Downloading,
        format!("正在下载 {label}…"),
        Some(0),
        Some(0),
        Some(estimated_bytes),
        Some("downloading".to_string()),
        None,
    );

    if let Some(parent) = part_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建 LoRA 下载临时目录失败：{error}"))?;
    }

    propagate_interrupt(&part_path)?;

    match download_http_file(
        bundle.download_url.as_str(),
        &part_path,
        label.as_str(),
        0,
        estimated_bytes,
        estimated_bytes,
        hf_endpoint,
        || propagate_interrupt(&part_path),
    ) {
        Ok(()) => {}
        Err(message) if message == DOWNLOAD_PAUSED_MESSAGE => {
            guard.should_clear = false;
            return Err(message);
        }
        Err(message) => return Err(message),
    }

    finalize_lora_part(models_root, &part_path, &destination, &bundle)?;
    finish_running_task();
    Ok(destination)
}

pub fn import_lora_from_file(
    models_root: &Path,
    lora_id: &str,
    source_path: &Path,
) -> Result<PathBuf, String> {
    let _catalog = find_lora_attachment(lora_id)?;
    let bundle = find_lora_bundle(lora_id)?;

    if !source_path.is_file() {
        return Err(format!("找不到 LoRA 文件：{}", source_path.display()));
    }

    let destination = models_root.join("loras").join(&bundle.directory).join(&bundle.file_name);
    copy_file_to_bundle(source_path, &destination)?;
    Ok(destination)
}

pub fn delete_lora_assets(models_root: &Path, lora_id: &str) -> Result<(), String> {
    let bundle = find_lora_bundle(lora_id)?;
    let bundle_dir = models_root.join("loras").join(&bundle.directory);
    let destination = bundle_dir.join(&bundle.file_name);

    if destination.is_file() {
        fs::remove_file(&destination)
            .map_err(|error| format!("删除 LoRA 文件失败：{error}"))?;
    }

    if bundle_dir.is_dir() {
        let _ = fs::remove_dir(&bundle_dir);
    }

    let part_path = lora_download_part_path(models_root, lora_id);
    if part_path.is_file() {
        let _ = fs::remove_file(&part_path);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_pixel_art_lora_bundle() {
        let bundle = find_lora_bundle("pixel-art-sprite-klein").expect("bundle");
        assert!(bundle.file_name.ends_with(".safetensors"));
    }
}
