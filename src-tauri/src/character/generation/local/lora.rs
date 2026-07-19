use std::path::Path;

use super::catalog::{find_lora_attachment, load_lora_catalog, lora_subdirectory};
use super::lora_assets::{lora_assets_installed, lora_destination_path};
use super::types::{GenerateImageRequest, LoraAttachment};

pub fn resolve_loras_for_request(
    models_root: &Path,
    profile_id: &str,
    preset_name: &str,
    enabled_lora_ids: &[String],
    default_strength: f32,
    request: &GenerateImageRequest,
) -> Result<Vec<ResolvedLora>, String> {
    let mut resolved = Vec::new();

    let lora_ids: Vec<String> = if request.lora_ids.is_empty() {
        enabled_lora_ids.to_vec()
    } else {
        request.lora_ids.clone()
    };

    for (index, lora_id) in lora_ids.iter().enumerate() {
        let attachment = find_lora_attachment(lora_id)?;
        if !attachment.compatible_profile_ids.is_empty()
            && !attachment.compatible_profile_ids.iter().any(|id| id == profile_id)
        {
            continue;
        }
        if !attachment.compatible_presets.is_empty()
            && !attachment
                .compatible_presets
                .iter()
                .any(|preset| preset == preset_name)
        {
            continue;
        }

        let strength = request
            .lora_strengths
            .get(index)
            .copied()
            .unwrap_or(default_strength)
            .clamp(0.0, 2.0);

        resolved.push(ResolvedLora {
            attachment: attachment.clone(),
            directory: models_root.join("loras").join(lora_subdirectory(&attachment)),
            strength,
        });
    }

    Ok(resolved)
}

pub fn inject_lora_triggers(prompt: &str, loras: &[ResolvedLora]) -> String {
    let mut triggers = Vec::new();
    for lora in loras {
        for trigger in &lora.attachment.trigger_words {
            if !prompt.contains(trigger) {
                triggers.push(trigger.as_str());
            }
        }
    }

    if triggers.is_empty() {
        return prompt.to_string();
    }

    format!("{}, {}", triggers.join(", "), prompt)
}

pub fn list_compatible_loras(profile_id: &str, preset_name: &str) -> Result<Vec<LoraAttachment>, String> {
    Ok(load_lora_catalog()?
        .into_iter()
        .filter(|lora| {
            (lora.compatible_profile_ids.is_empty()
                || lora.compatible_profile_ids.iter().any(|id| id == profile_id))
                && (lora.compatible_presets.is_empty()
                    || lora
                        .compatible_presets
                        .iter()
                        .any(|preset| preset == preset_name))
        })
        .collect())
}

#[derive(Clone, Debug)]
pub struct ResolvedLora {
    pub attachment: LoraAttachment,
    pub directory: std::path::PathBuf,
    pub strength: f32,
}

pub fn lora_installed(models_root: &Path, lora: &LoraAttachment) -> bool {
    lora_assets_installed(models_root, lora.id.as_str())
}

pub fn resolve_lora_file_path(models_root: &Path, lora_id: &str) -> Result<std::path::PathBuf, String> {
    lora_destination_path(models_root, lora_id)
}

pub fn append_lora_prompt_tags(prompt: &str, loras: &[ResolvedLora]) -> String {
    let mut output = prompt.to_string();
    for lora in loras {
        output.push_str(&format!(
            "<lora:{}:{:.2}>",
            lora.attachment.file_stem, lora.strength
        ));
    }
    output
}

pub fn resolve_lora_model_dir(models_root: &Path, loras: &[ResolvedLora]) -> Option<std::path::PathBuf> {
    if loras.is_empty() {
        return None;
    }
    if loras.len() == 1 {
        return Some(loras[0].directory.clone());
    }
    Some(models_root.join("loras"))
}
