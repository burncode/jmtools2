use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::character::store::validate_project_root;

const ARCHETYPE_DIR: &str = ".jmtools/character-archetypes";

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCharacterArchetype {
    pub description: String,
    pub id: String,
    pub label: String,
    pub patch: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListProjectCharacterArchetypesInput {
    pub project_root: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProjectCharacterArchetypeInput {
    pub archetype: ProjectCharacterArchetype,
    pub project_root: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProjectCharacterArchetypeInput {
    pub id: String,
    pub project_root: String,
}

#[tauri::command]
pub fn list_project_character_archetypes(
    input: ListProjectCharacterArchetypesInput,
) -> Result<Vec<ProjectCharacterArchetype>, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let directory = archetype_directory(&project_root);

    if !directory.exists() {
        return Ok(Vec::new());
    }

    let mut templates = Vec::new();
    let entries = fs::read_dir(&directory)
        .map_err(|error| format!("读取项目角色模板目录失败：{error}"))?;

    for entry in entries {
        let entry = entry.map_err(|error| format!("读取项目角色模板条目失败：{error}"))?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }

        let content = fs::read_to_string(&path)
            .map_err(|error| format!("读取项目角色模板失败：{error}"))?;
        let template: ProjectCharacterArchetype = serde_json::from_str(&content)
            .map_err(|error| format!("解析项目角色模板失败：{error}"))?;

        if template.id.trim().is_empty() || template.label.trim().is_empty() {
            continue;
        }

        templates.push(template);
    }

    templates.sort_by(|left, right| left.label.cmp(&right.label));
    Ok(templates)
}

#[tauri::command]
pub fn save_project_character_archetype(
    input: SaveProjectCharacterArchetypeInput,
) -> Result<ProjectCharacterArchetype, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let id = sanitize_archetype_id(&input.archetype.id)?;
    let label = input.archetype.label.trim();
    if label.is_empty() {
        return Err("角色模板名称不能为空。".to_string());
    }

    let template = ProjectCharacterArchetype {
        description: input.archetype.description.trim().chars().take(160).collect(),
        id: id.clone(),
        label: label.chars().take(32).collect(),
        patch: input.archetype.patch,
    };

    let directory = archetype_directory(&project_root);
    fs::create_dir_all(&directory)
        .map_err(|error| format!("创建项目角色模板目录失败：{error}"))?;

    let file_path = directory.join(format!("{id}.json"));
    let content = serde_json::to_string_pretty(&template)
        .map_err(|error| format!("序列化项目角色模板失败：{error}"))?;
    fs::write(&file_path, content)
        .map_err(|error| format!("写入项目角色模板失败：{error}"))?;

    Ok(template)
}

#[tauri::command]
pub fn delete_project_character_archetype(
    input: DeleteProjectCharacterArchetypeInput,
) -> Result<(), String> {
    let project_root = validate_project_root(&input.project_root)?;
    let id = sanitize_archetype_id(&input.id)?;
    let file_path = archetype_directory(&project_root).join(format!("{id}.json"));

    if !file_path.exists() {
        return Err("项目角色模板不存在。".to_string());
    }

    fs::remove_file(&file_path).map_err(|error| format!("删除项目角色模板失败：{error}"))
}

fn archetype_directory(project_root: &Path) -> PathBuf {
    project_root.join(ARCHETYPE_DIR)
}

fn sanitize_archetype_id(raw_id: &str) -> Result<String, String> {
    let normalized = raw_id
        .trim()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .chars()
        .take(64)
        .collect::<String>();

    if normalized.is_empty() {
        return Err("角色模板 ID 无效。".to_string());
    }

    Ok(normalized)
}
