use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

const PROJECT_MANIFEST_FILE_NAME: &str = "jmproject.json";

#[derive(Deserialize, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGenerationTemplate {
    #[serde(default)]
    pub background: String,
    #[serde(default)]
    pub perspective: String,
    #[serde(default)]
    pub proportion: String,
    #[serde(default, rename = "walkCycleHints")]
    pub walk_cycle_hints: String,
}

#[derive(Deserialize, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCharacterGenerationSettings {
    #[serde(default)]
    pub generation_template: ProjectGenerationTemplate,
    #[serde(default)]
    pub layout_anchor_character_id: String,
    #[serde(default)]
    pub layout_anchor_description: String,
    #[serde(default)]
    pub style_anchor: String,
    #[serde(default)]
    pub style_anchor_variants: BTreeMap<String, String>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectManifestPatch {
    #[serde(default)]
    character_generation: ProjectCharacterGenerationSettings,
}

pub fn read_project_character_generation(
    project_root: &Path,
) -> Result<ProjectCharacterGenerationSettings, String> {
    let manifest_path = project_root.join(PROJECT_MANIFEST_FILE_NAME);
    let content = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("读取项目清单失败：{error}"))?;
    let manifest: ProjectManifestPatch = serde_json::from_str(&content)
        .map_err(|error| format!("项目清单格式错误：{error}"))?;
    Ok(manifest.character_generation)
}

pub fn write_project_character_generation(
    project_root: &Path,
    settings: &ProjectCharacterGenerationSettings,
) -> Result<ProjectCharacterGenerationSettings, String> {
    let manifest_path = project_root.join(PROJECT_MANIFEST_FILE_NAME);
    let content = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("读取项目清单失败：{error}"))?;
    let mut manifest: serde_json::Value = serde_json::from_str(&content)
        .map_err(|error| format!("项目清单格式错误：{error}"))?;
    let settings_value = serde_json::to_value(settings)
        .map_err(|error| format!("序列化角色生成配置失败：{error}"))?;
    manifest["characterGeneration"] = settings_value;

    if let Some(updated_at) = manifest.get_mut("updatedAt") {
        *updated_at = serde_json::Value::String(current_timestamp());
    }

    let temp_path = project_root.join("jmproject.json.tmp");
    let next_content = serde_json::to_string_pretty(&manifest)
        .map_err(|error| format!("序列化项目清单失败：{error}"))?;
    fs::write(&temp_path, next_content)
        .map_err(|error| format!("写入临时项目清单失败：{error}"))?;
    fs::rename(&temp_path, &manifest_path)
        .map_err(|error| format!("写入项目清单失败：{error}"))?;
    Ok(settings.clone())
}

pub fn compose_style_anchor_prefix(
    settings: &ProjectCharacterGenerationSettings,
    variant_key: Option<&str>,
) -> String {
    let mut parts = Vec::new();

    let default_anchor = settings.style_anchor.trim();
    if !default_anchor.is_empty() {
        parts.push(format!("STYLE ANCHOR: {default_anchor}"));
    }

    if let Some(key) = variant_key.map(str::trim).filter(|value| !value.is_empty()) {
        if let Some(variant) = settings.style_anchor_variants.get(key) {
            let trimmed = variant.trim();
            if !trimmed.is_empty() {
                parts.push(format!("STYLE VARIANT ({key}): {trimmed}"));
            }
        }
    }

    parts.join("\n")
}

pub fn compose_generation_template_block(
    template: &ProjectGenerationTemplate,
    action_id: Option<&str>,
) -> String {
    let mut parts = Vec::new();

    if !template.perspective.trim().is_empty() {
        parts.push(format!("Perspective: {}", template.perspective.trim()));
    }
    if !template.proportion.trim().is_empty() {
        parts.push(format!("Proportion: {}", template.proportion.trim()));
    }
    if !template.background.trim().is_empty() {
        parts.push(format!("Background: {}", template.background.trim()));
    }
    if action_id == Some("walk") && !template.walk_cycle_hints.trim().is_empty() {
        parts.push(format!("Walk cycle: {}", template.walk_cycle_hints.trim()));
    }

    parts.join("\n")
}

pub fn compose_layout_anchor_suffix(
    settings: &ProjectCharacterGenerationSettings,
    current_character_id: &str,
    anchor_display_name: &str,
) -> String {
    let anchor_id = settings.layout_anchor_character_id.trim();
    if anchor_id.is_empty() || anchor_id == current_character_id {
        return String::new();
    }

    let name = anchor_display_name.trim();
    if name.is_empty() {
        return String::new();
    }

    let description = settings.layout_anchor_description.trim();
    if description.is_empty() {
        format!("Match layout and art style of {name}.")
    } else {
        format!("Match layout and art style of {name} — {description}")
    }
}

pub fn augment_character_prompt(
    base: String,
    settings: &ProjectCharacterGenerationSettings,
    variant_key: Option<&str>,
    action_id: Option<&str>,
    layout_suffix: &str,
) -> String {
    let mut sections = Vec::new();
    let prefix = compose_style_anchor_prefix(settings, variant_key);
    if !prefix.is_empty() {
        sections.push(prefix);
    }

    let template = compose_generation_template_block(&settings.generation_template, action_id);
    if !template.is_empty() {
        sections.push(template);
    }

    sections.push(base);

    if !layout_suffix.trim().is_empty() {
        sections.push(layout_suffix.trim().to_string());
    }

    sections.join("\n\n")
}

fn current_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_default()
}

pub fn validate_project_root_for_generation(project_root: &str) -> Result<PathBuf, String> {
    let trimmed = project_root.trim();
    if trimmed.is_empty() {
        return Err("项目目录不能为空。".to_string());
    }

    let path = PathBuf::from(trimmed);
    if !path.is_dir() {
        return Err("请选择有效的项目目录。".to_string());
    }
    if !path.join(PROJECT_MANIFEST_FILE_NAME).exists() {
        return Err("未找到 jmproject.json。".to_string());
    }

    path.canonicalize()
        .map_err(|error| format!("解析项目目录失败：{error}"))
}

#[tauri::command]
pub fn get_project_character_generation(
    project_root: String,
) -> Result<ProjectCharacterGenerationSettings, String> {
    let root = validate_project_root_for_generation(&project_root)?;
    read_project_character_generation(&root)
}

#[tauri::command]
pub fn update_project_character_generation(
    project_root: String,
    settings: ProjectCharacterGenerationSettings,
) -> Result<ProjectCharacterGenerationSettings, String> {
    let root = validate_project_root_for_generation(&project_root)?;
    write_project_character_generation(&root, &settings)
}

#[tauri::command]
pub fn set_project_layout_anchor_character(
    project_root: String,
    character_id: Option<String>,
) -> Result<ProjectCharacterGenerationSettings, String> {
    let root = validate_project_root_for_generation(&project_root)?;
    let mut settings = read_project_character_generation(&root)?;
    settings.layout_anchor_character_id = character_id.unwrap_or_default().trim().to_string();
    write_project_character_generation(&root, &settings)
}
