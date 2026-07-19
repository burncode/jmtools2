use std::path::{Path, PathBuf};

use serde::Deserialize;

use super::types::{LoraAttachment, ModelProfile};

#[derive(Debug, Deserialize)]
struct ModelCatalogFile {
    profiles: Vec<ModelProfile>,
}

#[derive(Debug, Deserialize)]
struct LoraCatalogFile {
    loras: Vec<LoraAttachment>,
}

pub fn load_model_catalog() -> Result<Vec<ModelProfile>, String> {
    let parsed: ModelCatalogFile = serde_json::from_str(include_str!(
        "../../../../resources/local_model_catalog.json"
    ))
    .map_err(|error| format!("解析本地模型目录失败：{error}"))?;

    Ok(parsed.profiles)
}

pub fn load_lora_catalog() -> Result<Vec<LoraAttachment>, String> {
    let parsed: LoraCatalogFile = serde_json::from_str(include_str!(
        "../../../../resources/local_lora_catalog.json"
    ))
    .map_err(|error| format!("解析 LoRA 目录失败：{error}"))?;

    Ok(parsed.loras)
}

pub fn find_model_profile(profile_id: &str) -> Result<ModelProfile, String> {
    let normalized = profile_id.trim();
    load_model_catalog()?
        .into_iter()
        .find(|profile| profile.id == normalized)
        .ok_or_else(|| format!("未找到本地模型档位：{normalized}"))
}

pub fn find_lora_attachment(lora_id: &str) -> Result<LoraAttachment, String> {
    let normalized = lora_id.trim();
    load_lora_catalog()?
        .into_iter()
        .find(|lora| lora.id == normalized)
        .ok_or_else(|| format!("未找到 LoRA：{normalized}"))
}

pub fn resolve_models_directory(app_models_dir: &Path, override_path: &str) -> PathBuf {
    let trimmed = override_path.trim();
    if trimmed.is_empty() {
        app_models_dir.to_path_buf()
    } else {
        PathBuf::from(trimmed)
    }
}

pub fn profile_models_subdirectory(profile: &ModelProfile) -> String {
    format!("{}__{}", profile.preset, profile.weight)
}

pub fn lora_subdirectory(lora: &LoraAttachment) -> String {
    lora.id.clone()
}

pub fn directory_size_mb(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }

    fn walk(path: &Path, total: &mut u64) {
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if entry_path.is_file() {
                    if let Ok(metadata) = entry_path.metadata() {
                        *total += metadata.len();
                    }
                } else if entry_path.is_dir() {
                    walk(&entry_path, total);
                }
            }
        }
    }

    let mut total_bytes = 0u64;
    walk(path, &mut total_bytes);
    total_bytes / 1024 / 1024
}

pub fn directory_has_files(path: &Path) -> bool {
    if !path.is_dir() {
        return false;
    }

    std::fs::read_dir(path)
        .map(|entries| entries.flatten().any(|entry| entry.path().is_file()))
        .unwrap_or(false)
}
