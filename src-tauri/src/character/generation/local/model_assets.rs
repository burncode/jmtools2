use std::fs;
use std::path::{Path, PathBuf};
use serde::Deserialize;

use super::activity::{
    clear_local_inference_activity, set_local_inference_activity_detailed, LocalInferencePhase,
};
use super::download_cache::{
    copy_file_to_bundle, copy_file_to_cache, ensure_hf_cache_root, hf_cache_blob_path,
};
use super::download_control::{apply_download_interrupt, check_interrupt, finish_running_task};
use super::download_http::download_http_file;
use super::download_paths::{models_download_part_path, models_download_temp_dir};
use super::download_progress::reset_download_speed_sample;
use super::types::ProfileAssetFileStatus;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelAssetsFile {
    bundles: Vec<ProfileAssetBundle>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfileAssetBundle {
    profile_id: String,
    directory: String,
    cli_args: ProfileCliArgs,
    files: Vec<AssetFileSpec>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProfileCliArgs {
    #[serde(default)]
    pub offload_to_cpu: bool,
    #[serde(default)]
    pub diffusion_fa: bool,
    #[serde(default)]
    pub vae_on_cpu: bool,
}

impl Default for ProfileCliArgs {
    fn default() -> Self {
        Self {
            offload_to_cpu: false,
            diffusion_fa: false,
            vae_on_cpu: false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct EffectiveCliArgs {
    pub offload_to_cpu: bool,
    pub diffusion_fa: bool,
    pub vae_on_cpu: bool,
    pub vae_tiling: bool,
    pub clip_on_cpu: bool,
    pub vae_tile_overlap: Option<f32>,
    pub lora_apply_mode: String,
    pub params_backend: Option<String>,
    pub backend: Option<String>,
}

pub fn resolve_effective_cli_args(
    manifest: &ProfileCliArgs,
    settings: &super::types::LocalInferenceSettings,
) -> EffectiveCliArgs {
    EffectiveCliArgs {
        offload_to_cpu: settings
            .runtime_offload_to_cpu
            .unwrap_or(manifest.offload_to_cpu),
        diffusion_fa: settings
            .runtime_diffusion_fa
            .unwrap_or(manifest.diffusion_fa),
        vae_on_cpu: settings.runtime_vae_on_cpu || manifest.vae_on_cpu,
        vae_tiling: settings.runtime_vae_tiling,
        clip_on_cpu: settings
            .runtime_clip_on_cpu
            .unwrap_or(false),
        vae_tile_overlap: settings.runtime_vae_tile_overlap,
        lora_apply_mode: settings
            .runtime_lora_apply_mode
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "at_runtime".to_string()),
        params_backend: settings
            .runtime_params_backend
            .clone()
            .filter(|value| !value.trim().is_empty()),
        backend: settings
            .runtime_backend
            .clone()
            .filter(|value| !value.trim().is_empty()),
    }
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct AssetFileSpec {
    role: String,
    file_name: String,
    download_url: String,
    #[serde(default)]
    estimated_size_mb: u64,
    #[serde(default)]
    hf_repo: Option<String>,
    #[serde(default)]
    hf_revision: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ResolvedProfileAssets {
    pub bundle_dir: PathBuf,
    pub diffusion_model: PathBuf,
    pub vae: PathBuf,
    pub llm: PathBuf,
    pub cli_args: ProfileCliArgs,
}

fn min_ready_bytes(estimated_bytes: u64) -> u64 {
    if estimated_bytes == 0 {
        return 1024 * 1024;
    }
    let ratio = estimated_bytes.saturating_mul(80) / 100;
    ratio.max(1024 * 1024).min(estimated_bytes)
}

pub fn asset_file_ready(path: &Path, estimated_size_mb: u64) -> bool {
    if !path.is_file() {
        return false;
    }

    let estimated_bytes = estimated_size_mb.saturating_mul(1024 * 1024);
    let min_bytes = min_ready_bytes(estimated_bytes);
    fs::metadata(path)
        .map(|metadata| metadata.len() >= min_bytes)
        .unwrap_or(false)
}

fn bundle_file_ready(bundle_dir: &Path, file: &AssetFileSpec) -> bool {
    asset_file_ready(&bundle_dir.join(&file.file_name), file.estimated_size_mb)
}

pub fn profile_assets_installed(models_root: &Path, profile_id: &str) -> bool {
    find_bundle(profile_id)
        .map(|bundle| {
            let bundle_dir = models_root.join(&bundle.directory);
            bundle.files.iter().all(|file| bundle_file_ready(&bundle_dir, file))
        })
        .unwrap_or(false)
}

pub fn profile_asset_file_statuses(
    models_root: &Path,
    profile_id: &str,
) -> Result<Vec<ProfileAssetFileStatus>, String> {
    let bundle = find_bundle(profile_id)?;
    let bundle_dir = models_root.join(&bundle.directory);
    Ok(bundle
        .files
        .iter()
        .map(|file| ProfileAssetFileStatus {
            role: file.role.clone(),
            file_name: file.file_name.clone(),
            present: bundle_file_ready(&bundle_dir, file),
        })
        .collect())
}

pub fn delete_partial_profile_assets(models_root: &Path, profile_id: &str) -> Result<(), String> {
    if profile_assets_installed(models_root, profile_id) {
        return Err("模型已完整就绪，请通过目录管理卸载。".to_string());
    }

    let bundle = find_bundle(profile_id)?;
    let bundle_dir = models_root.join(&bundle.directory);

    for file in &bundle.files {
        let path = bundle_dir.join(&file.file_name);
        if path.is_file() {
            fs::remove_file(&path)
                .map_err(|error| format!("删除未完成模型文件 {} 失败：{error}", file.file_name))?;
        }
    }

    let temp_dir = models_download_temp_dir(models_root, profile_id);
    if temp_dir.is_dir() {
        fs::remove_dir_all(&temp_dir)
            .map_err(|error| format!("清理下载临时目录失败：{error}"))?;
    }

    Ok(())
}

fn profile_bundle_prepare_message(profile_id: &str, missing_count: usize) -> String {
    if profile_id.starts_with("klein-4b") {
        return format!(
            "正在下载 FLUX.2 Klein 4B 模型包（DiT + VAE + 文本编码器，共 {missing_count} 个文件）…"
        );
    }

    format!("正在准备下载 {profile_id} 模型包（共 {missing_count} 个文件）…")
}

fn asset_role_label(role: &str) -> &'static str {
    match role {
        "diffusion" => "DiT 扩散模型",
        "vae" => "VAE",
        "llm" => "文本编码器",
        _ => "模型文件",
    }
}

pub fn ensure_profile_assets(
    models_root: &Path,
    profile_id: &str,
    hf_endpoint: &str,
) -> Result<ResolvedProfileAssets, String> {
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

    let bundle = find_bundle(profile_id)?;
    let bundle_dir = models_root.join(&bundle.directory);
    fs::create_dir_all(&bundle_dir).map_err(|error| format!("创建模型目录失败：{error}"))?;

    let missing: Vec<_> = bundle
        .files
        .iter()
        .filter(|file| !bundle_file_ready(&bundle_dir, file))
        .collect();

    if missing.is_empty() {
        finish_running_task();
        return resolve_bundle_paths(&bundle_dir, &bundle);
    }

    let bundle_total_bytes: u64 = bundle
        .files
        .iter()
        .map(|file| file.estimated_size_mb.saturating_mul(1024 * 1024))
        .sum();

    let mut completed_bytes = bundle
        .files
        .iter()
        .filter(|file| bundle_file_ready(&bundle_dir, file))
        .map(|file| file.estimated_size_mb.saturating_mul(1024 * 1024))
        .sum();

    reset_download_speed_sample();
    ensure_hf_cache_root(models_root)?;

    let missing_count = missing.len();
    let total_files = bundle.files.len();

    set_local_inference_activity_detailed(
        LocalInferencePhase::Downloading,
        profile_bundle_prepare_message(profile_id, missing_count),
        Some(0),
        Some(completed_bytes),
        Some(bundle_total_bytes),
        Some("downloading".to_string()),
        None,
    );

    for (index, file) in missing.into_iter().enumerate() {
        let part_path = models_download_part_path(models_root, profile_id, file.file_name.as_str());
        propagate_interrupt(Some(&part_path))?;

        let destination = bundle_dir.join(&file.file_name);
        let file_estimated = file.estimated_size_mb.saturating_mul(1024 * 1024);
        let part_existing = fs::metadata(&part_path).map(|meta| meta.len()).unwrap_or(0);
        let progress_bytes = completed_bytes.saturating_add(part_existing);
        let file_index = total_files.saturating_sub(missing_count).saturating_add(index) + 1;
        let role_label = asset_role_label(file.role.as_str());

        set_local_inference_activity_detailed(
            LocalInferencePhase::Downloading,
            format!(
                "正在下载 {role_label} · {}（{file_index}/{total_files}）…",
                file.file_name
            ),
            Some(
                ((progress_bytes.saturating_mul(100)) / bundle_total_bytes.max(1)).min(99) as u8,
            ),
            Some(progress_bytes),
            Some(bundle_total_bytes),
            Some("downloading".to_string()),
            None,
        );

        match download_asset_file(
            models_root,
            profile_id,
            file,
            &part_path,
            &destination,
            &format!("{role_label} · {}", file.file_name),
            completed_bytes,
            bundle_total_bytes,
            file_estimated,
            hf_endpoint,
        ) {
            Ok(()) => {}
            Err(message) if message == super::download_control::DOWNLOAD_PAUSED_MESSAGE => {
                guard.should_clear = false;
                return Err(message);
            }
            Err(message) if message == super::download_control::DOWNLOAD_CANCELLED_MESSAGE => {
                return Err(message);
            }
            Err(message) => return Err(message),
        }

        completed_bytes = completed_bytes.saturating_add(file_estimated);
    }

    let temp_dir = models_download_temp_dir(models_root, profile_id);
    if temp_dir.is_dir() {
        let _ = fs::remove_dir_all(&temp_dir);
    }

    set_local_inference_activity_detailed(
        LocalInferencePhase::Downloading,
        "模型文件下载完成。".to_string(),
        Some(100),
        Some(bundle_total_bytes),
        Some(bundle_total_bytes),
        Some("downloading".to_string()),
        None,
    );

    finish_running_task();
    resolve_bundle_paths(&bundle_dir, &bundle)
}

pub fn import_model_bundle_from_directory(
    models_root: &Path,
    profile_id: &str,
    source_dir: &Path,
) -> Result<ResolvedProfileAssets, String> {
    struct ClearGuard;
    impl Drop for ClearGuard {
        fn drop(&mut self) {
            clear_local_inference_activity();
        }
    }
    let _guard = ClearGuard;

    if !source_dir.is_dir() {
        return Err(format!("找不到模型目录：{}", source_dir.display()));
    }

    let bundle = find_bundle(profile_id)?;
    let bundle_dir = models_root.join(&bundle.directory);
    fs::create_dir_all(&bundle_dir).map_err(|error| format!("创建模型目录失败：{error}"))?;

    let total = bundle.files.len().max(1);

    for (index, file) in bundle.files.iter().enumerate() {
        let source = source_dir.join(&file.file_name);
        if !source.is_file() {
            return Err(format!(
                "目录内缺少文件「{}」。请确认已选择包含 manifest 定义三文件的文件夹。",
                file.file_name
            ));
        }

        let percent = ((index.saturating_mul(100)) / total).min(99) as u8;
        set_local_inference_activity_detailed(
            LocalInferencePhase::Downloading,
            format!("正在复制 {}（{}/{}）…", file.file_name, index + 1, total),
            Some(percent),
            Some(index as u64),
            Some(total as u64),
            Some("copying".to_string()),
            None,
        );

        let destination = bundle_dir.join(&file.file_name);
        fs::copy(&source, &destination)
            .map_err(|error| format!("复制 {} 失败：{error}", file.file_name))?;
    }

    set_local_inference_activity_detailed(
        LocalInferencePhase::Downloading,
        "模型文件导入完成。".to_string(),
        Some(100),
        Some(total as u64),
        Some(total as u64),
        Some("copying".to_string()),
        None,
    );

    resolve_bundle_paths(&bundle_dir, &bundle)
}

pub fn resolve_profile_assets(models_root: &Path, profile_id: &str) -> Result<ResolvedProfileAssets, String> {
    let bundle = find_bundle(profile_id)?;
    let bundle_dir = models_root.join(&bundle.directory);
    resolve_bundle_paths(&bundle_dir, &bundle)
}

fn find_bundle(profile_id: &str) -> Result<ProfileAssetBundle, String> {
    let normalized = profile_id.trim();
    load_assets_file()?
        .bundles
        .into_iter()
        .find(|bundle| bundle.profile_id == normalized)
        .ok_or_else(|| format!("未找到 sd-cpp 模型资产定义：{normalized}"))
}

pub fn manifest_cli_args_for_profile(profile_id: &str) -> Result<ProfileCliArgs, String> {
    Ok(find_bundle(profile_id)?.cli_args)
}

fn load_assets_file() -> Result<ModelAssetsFile, String> {
    serde_json::from_str(include_str!(
        "../../../../resources/local_sd_model_assets.json"
    ))
    .map_err(|error| format!("解析 sd-cpp 模型资产 manifest 失败：{error}"))
}

fn resolve_bundle_paths(
    bundle_dir: &Path,
    bundle: &ProfileAssetBundle,
) -> Result<ResolvedProfileAssets, String> {
    let diffusion_model = bundle_dir.join(
        bundle
            .files
            .iter()
            .find(|file| file.role == "diffusion")
            .ok_or_else(|| "模型资产缺少 diffusion 文件".to_string())?
            .file_name
            .as_str(),
    );
    let vae = bundle_dir.join(
        bundle
            .files
            .iter()
            .find(|file| file.role == "vae")
            .ok_or_else(|| "模型资产缺少 vae 文件".to_string())?
            .file_name
            .as_str(),
    );
    let llm = bundle_dir.join(
        bundle
            .files
            .iter()
            .find(|file| file.role == "llm")
            .ok_or_else(|| "模型资产缺少 llm 文件".to_string())?
            .file_name
            .as_str(),
    );

    let diffusion_spec = bundle
        .files
        .iter()
        .find(|file| file.role == "diffusion")
        .ok_or_else(|| "模型资产缺少 diffusion 文件".to_string())?;
    let vae_spec = bundle
        .files
        .iter()
        .find(|file| file.role == "vae")
        .ok_or_else(|| "模型资产缺少 vae 文件".to_string())?;
    let llm_spec = bundle
        .files
        .iter()
        .find(|file| file.role == "llm")
        .ok_or_else(|| "模型资产缺少 llm 文件".to_string())?;

    if !asset_file_ready(&diffusion_model, diffusion_spec.estimated_size_mb) {
        return Err(format!(
            "模型文件缺失或不完整：{}。请重新下载。",
            diffusion_model.display()
        ));
    }
    if !asset_file_ready(&vae, vae_spec.estimated_size_mb) {
        return Err(format!(
            "模型文件缺失或不完整：{}。请重新下载。",
            vae.display()
        ));
    }
    if !asset_file_ready(&llm, llm_spec.estimated_size_mb) {
        return Err(format!(
            "模型文件缺失或不完整：{}。请重新下载。",
            llm.display()
        ));
    }

    Ok(ResolvedProfileAssets {
        bundle_dir: bundle_dir.to_path_buf(),
        diffusion_model,
        vae,
        llm,
        cli_args: bundle.cli_args.clone(),
    })
}

fn propagate_interrupt(partial_path: Option<&Path>) -> Result<(), String> {
    match check_interrupt() {
        Ok(()) => Ok(()),
        Err(interrupt) => Err(apply_download_interrupt(interrupt, partial_path)),
    }
}

fn finalize_part_to_destination(
    models_root: &Path,
    part_path: &Path,
    destination: &Path,
    file: &AssetFileSpec,
) -> Result<(), String> {
    if !part_path.is_file() {
        return Err(format!(
            "找不到已下载的临时文件：{}",
            part_path.display()
        ));
    }

    if let Some(cache_path) = hf_cache_blob_path(
        models_root,
        file.hf_repo.as_deref(),
        file.hf_revision.as_deref(),
        file.file_name.as_str(),
    ) {
        copy_file_to_cache(part_path, &cache_path)?;
    }

    copy_file_to_bundle(part_path, destination)?;
    fs::remove_file(part_path).map_err(|error| format!("清理临时文件失败：{error}"))?;
    Ok(())
}

fn download_asset_file(
    models_root: &Path,
    profile_id: &str,
    file: &AssetFileSpec,
    part_path: &Path,
    destination: &Path,
    label: &str,
    base_bytes: u64,
    bundle_total_bytes: u64,
    file_estimated_bytes: u64,
    hf_endpoint: &str,
) -> Result<(), String> {
    if let Some(parent) = part_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建下载临时目录失败：{error}"))?;
    }

    if destination.is_file() && asset_file_ready(destination, file.estimated_size_mb) {
        return Ok(());
    }

    download_http_file(
        file.download_url.as_str(),
        part_path,
        label,
        base_bytes,
        bundle_total_bytes,
        file_estimated_bytes,
        hf_endpoint,
        || propagate_interrupt(Some(part_path)),
    )?;

    finalize_part_to_destination(models_root, part_path, destination, file)?;

    let _ = profile_id;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{asset_file_ready, min_ready_bytes};
    use std::path::Path;

    #[test]
    fn min_ready_bytes_uses_ratio_and_floor() {
        assert_eq!(min_ready_bytes(320 * 1024 * 1024), 256 * 1024 * 1024);
        assert_eq!(min_ready_bytes(512 * 1024), 512 * 1024);
    }

    #[test]
    fn asset_file_ready_rejects_missing_path() {
        assert!(!asset_file_ready(
            Path::new("/nonexistent/model.gguf"),
            2800
        ));
    }
}
