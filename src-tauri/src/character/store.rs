use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::character::model::*;
use crate::character::preview::{
    hydrate_character_action_tracks, populate_character_image_paths, strip_character_preview_payload,
    CharacterPreviewScope,
};
use crate::storage::database::{
    current_timestamp, ensure_project_schema, open_project_database,
};

pub(crate) const PROJECT_MANIFEST_FILE_NAME: &str = "jmproject.json";
pub(crate) const CHARACTER_INDEX_FILE_NAME: &str = "index.json";

pub(crate) fn validate_project_root(project_root: &str) -> Result<PathBuf, String> {
    let trimmed_root = project_root.trim();

    if trimmed_root.is_empty() {
        return Err("项目目录不能为空。".to_string());
    }

    let root_path = PathBuf::from(trimmed_root);

    if !root_path.exists() {
        return Err("项目目录不存在。".to_string());
    }

    if !root_path.is_dir() {
        return Err("请选择项目目录，而不是文件。".to_string());
    }

    if !root_path.join(PROJECT_MANIFEST_FILE_NAME).exists() {
        return Err("未找到 jmproject.json，请先打开有效的 JMTools 项目。".to_string());
    }

    root_path
        .canonicalize()
        .map_err(|error| format!("解析项目目录失败：{error}"))
}

pub(crate) fn validate_character_id(character_id: &str) -> Result<String, String> {
    let trimmed_id = character_id.trim();

    if trimmed_id.is_empty() {
        return Err("角色 ID 不能为空。".to_string());
    }

    if !trimmed_id.chars().all(|character| {
        character.is_ascii_lowercase()
            || character.is_ascii_digit()
            || character == '-'
            || character == '_'
    }) {
        return Err("角色 ID 格式不正确。".to_string());
    }

    Ok(trimmed_id.to_string())
}

pub(crate) fn validate_character_input(input: &CreateCharacterAssetInput) -> Result<(), String> {
    if input.draft.name.trim().is_empty() {
        return Err("角色名称不能为空。".to_string());
    }

    if input.draft.description.trim().is_empty() {
        return Err("角色描述不能为空。".to_string());
    }

    if input.master_plan.pixel_prompt.trim().is_empty() {
        return Err("角色母版提示词不能为空，请先生成母版方案。".to_string());
    }

    if input.selected_plan.id.trim().is_empty() {
        return Err("请选择一个生成方案。".to_string());
    }

    Ok(())
}

pub(crate) fn validate_reference_image_path(path: &Path) -> Result<String, String> {
    if !path.is_file() {
        return Err("请选择有效的参考图片文件。".to_string());
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .trim()
        .to_lowercase();

    if matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "webp") {
        Ok(extension)
    } else {
        Err("参考图仅支持 PNG、JPG、JPEG、WEBP。".to_string())
    }
}

pub(crate) fn build_unique_character_id(project_root: &Path, display_name: &str, timestamp: &str) -> String {
    let base_id = normalize_character_id(display_name);
    let mut candidate_id = format!("{base_id}_{timestamp}");
    let character_root = project_root.join("assets").join("characters");
    let mut suffix = 1;

    while character_root.join(&candidate_id).exists() {
        suffix += 1;
        candidate_id = format!("{base_id}_{timestamp}_{suffix}");
    }

    candidate_id
}

pub(crate) fn normalize_cache_segment(value: &str) -> String {
    let normalized: String = value
        .trim()
        .to_lowercase()
        .chars()
        .filter_map(|character| {
            if character.is_ascii_lowercase()
                || character.is_ascii_digit()
                || character == '-'
                || character == '_'
            {
                Some(character)
            } else {
                None
            }
        })
        .collect();

    if normalized.is_empty() {
        "candidate".to_string()
    } else {
        normalized
    }
}

fn normalize_character_id(value: &str) -> String {
    let normalized: String = value
        .trim()
        .to_lowercase()
        .chars()
        .filter_map(|character| {
            if character.is_ascii_lowercase()
                || character.is_ascii_digit()
                || character == '-'
                || character == '_'
            {
                Some(character)
            } else if character.is_whitespace() {
                Some('_')
            } else {
                None
            }
        })
        .collect();

    if normalized.is_empty() {
        "character".to_string()
    } else {
        normalized
    }
}

pub(crate) fn upsert_character_index(
    project_root: &Path,
    record: &CharacterAssetRecord,
) -> Result<(), String> {
    let character_root = project_root.join("assets").join("characters");
    let index_path = character_root.join(CHARACTER_INDEX_FILE_NAME);

    fs::create_dir_all(&character_root)
        .map_err(|error| format!("创建角色索引目录失败：{error}"))?;

    let mut records = read_character_index(&index_path)?;
    records.retain(|item| item.id != record.id);
    let mut sanitized = record.clone();
    strip_character_preview_payload(&mut sanitized);
    records.insert(0, sanitized);

    write_json_file(&index_path, &records)
}

pub(crate) fn remove_character_from_index(project_root: &Path, character_id: &str) -> Result<(), String> {
    let character_root = project_root.join("assets").join("characters");
    let index_path = character_root.join(CHARACTER_INDEX_FILE_NAME);
    let mut records = read_character_index(&index_path)?;

    records.retain(|item| item.id != character_id);
    write_json_file(&index_path, &records)
}

pub(crate) fn read_character_index(index_path: &Path) -> Result<Vec<CharacterAssetRecord>, String> {
    if !index_path.exists() {
        return Ok(Vec::new());
    }

    let content =
        fs::read_to_string(index_path).map_err(|error| format!("读取角色索引失败：{error}"))?;
    let mut records = serde_json::from_str::<Vec<CharacterAssetRecord>>(&content)
        .map_err(|error| format!("角色索引格式错误：{error}"))?;

    for record in &mut records {
        hydrate_character_action_tracks(record);
    }

    Ok(records)
}

pub(crate) fn write_json_file<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let content = serde_json::to_string_pretty(value)
        .map_err(|error| format!("序列化角色资产失败：{error}"))?;
    let temp_path = path.with_extension("json.tmp");

    fs::write(&temp_path, content).map_err(|error| format!("写入临时角色文件失败：{error}"))?;
    fs::rename(&temp_path, path).map_err(|error| format!("写入角色文件失败：{error}"))
}

pub(crate) fn write_character_record(
    project_root: &Path,
    record: &CharacterAssetRecord,
) -> Result<(), String> {
    let character_path = project_root
        .join("assets")
        .join("characters")
        .join(&record.id)
        .join("character.json");
    let mut sanitized = record.clone();
    strip_character_preview_payload(&mut sanitized);

    write_json_file(&character_path, &sanitized)
}

pub(crate) fn upsert_character_database(
    project_root: &Path,
    record: &CharacterAssetRecord,
) -> Result<(), String> {
    let connection = open_project_database(project_root)?;
    ensure_project_schema(&connection)?;

    upsert_character_record(&connection, record)
}

pub(crate) fn delete_character_database_record(project_root: &Path, character_id: &str) -> Result<(), String> {
    let connection = open_project_database(project_root)?;
    ensure_project_schema(&connection)?;

    connection
        .execute(
            "DELETE FROM character_assets WHERE id = ?1",
            params![character_id],
        )
        .map_err(|error| format!("删除角色资产数据库记录失败：{error}"))?;

    Ok(())
}

fn upsert_character_record(
    connection: &Connection,
    record: &CharacterAssetRecord,
) -> Result<(), String> {
    let record_json = serde_json::to_string(record)
        .map_err(|error| format!("序列化角色资产数据库记录失败：{error}"))?;
    let visual_keywords_json = serde_json::to_string(&record.visual_keywords)
        .map_err(|error| format!("序列化角色关键词失败：{error}"))?;
    let palette_json = serde_json::to_string(&record.palette)
        .map_err(|error| format!("序列化角色色板失败：{error}"))?;

    connection
        .execute(
            "INSERT INTO character_assets (
                id,
                display_name,
                status,
                style,
                size,
                direction,
                project_relative_path,
                selected_plan_name,
                selected_plan_score,
                provider_name,
                model,
                summary,
                description,
                visual_keywords_json,
                palette_json,
                record_json,
                created_at,
                updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
            ON CONFLICT(id) DO UPDATE SET
                display_name = excluded.display_name,
                status = excluded.status,
                style = excluded.style,
                size = excluded.size,
                direction = excluded.direction,
                project_relative_path = excluded.project_relative_path,
                selected_plan_name = excluded.selected_plan_name,
                selected_plan_score = excluded.selected_plan_score,
                provider_name = excluded.provider_name,
                model = excluded.model,
                summary = excluded.summary,
                description = excluded.description,
                visual_keywords_json = excluded.visual_keywords_json,
                palette_json = excluded.palette_json,
                record_json = excluded.record_json,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at;",
            params![
                record.id,
                record.display_name,
                record.status,
                record.style,
                record.size,
                record.direction,
                record.project_relative_path,
                record.selected_plan_name,
                record.selected_plan_score,
                record.provider_name,
                record.model,
                record.summary,
                record.description,
                visual_keywords_json,
                palette_json,
                record_json,
                parse_timestamp(&record.created_at),
                parse_timestamp(&record.updated_at),
            ],
        )
        .map_err(|error| format!("写入角色资产数据库失败：{error}"))?;

    Ok(())
}

pub(crate) fn list_character_records_from_database(
    project_root: &Path,
) -> Result<Vec<CharacterAssetRecord>, String> {
    let connection = open_project_database(project_root)?;
    ensure_project_schema(&connection)?;
    let mut statement = connection
        .prepare(
            "SELECT record_json FROM character_assets ORDER BY updated_at DESC, created_at DESC",
        )
        .map_err(|error| format!("读取角色资产数据库失败：{error}"))?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| format!("查询角色资产数据库失败：{error}"))?;
    let mut records = Vec::new();

    for row in rows {
        let record_json = row.map_err(|error| format!("读取角色资产数据库行失败：{error}"))?;
        let mut record = serde_json::from_str::<CharacterAssetRecord>(&record_json)
            .map_err(|error| format!("角色资产数据库记录格式错误：{error}"))?;
        hydrate_character_action_tracks(&mut record);
        records.push(record);
    }

    Ok(records)
}

pub(crate) fn get_character_record_from_database(
    project_root: &Path,
    character_id: &str,
) -> Result<CharacterAssetRecord, String> {
    let connection = open_project_database(project_root)?;
    ensure_project_schema(&connection)?;
    let mut statement = connection
        .prepare("SELECT record_json FROM character_assets WHERE id = ?1 LIMIT 1")
        .map_err(|error| format!("准备读取角色资产详情失败：{error}"))?;
    let record_json = statement
        .query_row(params![character_id], |row| row.get::<_, String>(0))
        .map_err(|error| format!("未找到角色资产详情：{error}"))?;
    serde_json::from_str::<CharacterAssetRecord>(&record_json)
        .map_err(|error| format!("角色资产详情格式错误：{error}"))
}

pub(crate) fn sync_project_profile_to_database(project_root: &Path) -> Result<(), String> {
    let manifest_path = project_root.join(PROJECT_MANIFEST_FILE_NAME);
    let manifest_content =
        fs::read_to_string(&manifest_path).map_err(|error| format!("读取项目清单失败：{error}"))?;
    let connection = open_project_database(project_root)?;
    ensure_project_schema(&connection)?;

    connection
        .execute(
            "INSERT INTO project_profile (key, value, updated_at)
             VALUES ('manifest', ?1, ?2)
             ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at;",
            params![manifest_content, current_timestamp()],
        )
        .map_err(|error| format!("写入项目数据库档案失败：{error}"))?;

    Ok(())
}

fn parse_timestamp(value: &str) -> i64 {
    value
        .trim()
        .parse::<i64>()
        .unwrap_or_else(|_| current_timestamp())
}

pub(crate) fn normalize_strings(values: Vec<String>) -> Vec<String> {
    values
        .into_iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect()
}

pub(crate) fn get_character_asset(
    project_root: String,
    character_id: String,
) -> Result<CharacterAssetRecord, String> {
    let project_root = validate_project_root(&project_root)?;
    let character_id = validate_character_id(&character_id)?;
    let character_path = project_root
        .join("assets")
        .join("characters")
        .join(&character_id)
        .join("character.json");

    if character_path.exists() {
        let content = fs::read_to_string(&character_path)
            .map_err(|error| format!("读取角色资产详情失败：{error}"))?;
        let mut record = serde_json::from_str::<CharacterAssetRecord>(&content)
            .map_err(|error| format!("角色资产详情格式错误：{error}"))?;
        hydrate_character_action_tracks(&mut record);
        populate_character_image_paths(&project_root, &mut record, CharacterPreviewScope::Views);

        return Ok(record);
    }

    let mut record = get_character_record_from_database(&project_root, &character_id)?;
    hydrate_character_action_tracks(&mut record);
    populate_character_image_paths(&project_root, &mut record, CharacterPreviewScope::Views);
    Ok(record)
}

