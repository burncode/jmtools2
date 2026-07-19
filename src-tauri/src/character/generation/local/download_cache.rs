use std::fs;
use std::path::{Path, PathBuf};

pub const HF_CACHE_SEGMENT: &str = ".cache/huggingface";

pub fn models_hf_cache_root(models_root: &Path) -> PathBuf {
    models_root.join(HF_CACHE_SEGMENT)
}

pub fn ensure_hf_cache_root(models_root: &Path) -> Result<PathBuf, String> {
    let root = models_hf_cache_root(models_root);
    fs::create_dir_all(&root).map_err(|error| format!("创建 HuggingFace 缓存目录失败：{error}"))?;
    std::env::set_var("HF_HOME", root.as_os_str());
    Ok(root)
}

pub fn hf_cache_blob_path(
    models_root: &Path,
    hf_repo: Option<&str>,
    hf_revision: Option<&str>,
    file_name: &str,
) -> Option<PathBuf> {
    let repo_id = hf_repo.filter(|value| !value.trim().is_empty())?;
    let revision = hf_revision
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("main");
    let mut path = models_hf_cache_root(models_root)
        .join("blobs")
        .join(repo_id.replace('/', "--"))
        .join(revision);
    for segment in file_name.split('/') {
        if !segment.is_empty() {
            path = path.join(segment);
        }
    }
    Some(path)
}

pub fn copy_file_to_cache(source: &Path, cache_path: &Path) -> Result<(), String> {
    if let Some(parent) = cache_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建 HF 缓存目录失败：{error}"))?;
    }
    fs::copy(source, cache_path).map_err(|error| format!("写入 HF 缓存失败：{error}"))?;
    Ok(())
}

pub fn copy_file_to_bundle(source: &Path, destination: &Path) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建模型目录失败：{error}"))?;
    }
    if destination.exists() {
        fs::remove_file(destination).map_err(|error| format!("替换模型文件失败：{error}"))?;
    }
    fs::copy(source, destination).map_err(|error| format!("写入模型文件失败：{error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_hf_cache_blob_path_with_nested_filename() {
        let root = PathBuf::from(r"C:\models");
        let path = hf_cache_blob_path(
            &root,
            Some("Comfy-Org/flux2-dev"),
            Some("main"),
            "split_files/vae/flux2-vae.safetensors",
        )
        .expect("path");
        assert!(path.to_string_lossy().contains(".cache"));
        assert!(path.to_string_lossy().contains("flux2-vae.safetensors"));
    }
}
