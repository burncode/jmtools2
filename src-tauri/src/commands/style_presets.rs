use crate::storage::database::{current_timestamp, open_app_database};
use crate::storage::style_presets::{ensure_style_preset_schema, seed_builtin_style_presets};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StylePresetRecord {
    pub id: String,
    pub label: String,
    pub tagline: String,
    pub thumbnail: String,
    pub is_builtin: bool,
    pub params: Value,
    pub tags: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveStylePresetInput {
    pub id: String,
    pub label: String,
    pub tagline: String,
    pub thumbnail: String,
    pub params: Value,
    pub tags: Vec<String>,
}

fn parse_tags_json(raw: &str) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(raw).unwrap_or_default()
}

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<StylePresetRecord> {
    let params_json: String = row.get(5)?;
    let params: Value = serde_json::from_str(&params_json).unwrap_or(Value::Object(Default::default()));
    let tags_json: String = row.get(8).unwrap_or_else(|_| "[]".to_string());

    Ok(StylePresetRecord {
        id: row.get(0)?,
        label: row.get(1)?,
        tagline: row.get(2)?,
        thumbnail: row.get(3)?,
        is_builtin: row.get::<_, i64>(4)? != 0,
        params,
        tags: parse_tags_json(&tags_json),
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn prepare_connection(app: &AppHandle) -> Result<Connection, String> {
    let connection = open_app_database(app)?;
    ensure_style_preset_schema(&connection)?;
    seed_builtin_style_presets(&connection)?;
    Ok(connection)
}

#[tauri::command]
pub fn list_style_presets(app: AppHandle) -> Result<Vec<StylePresetRecord>, String> {
    let connection = prepare_connection(&app)?;
    let mut statement = connection
        .prepare(
            "SELECT id, label, tagline, thumbnail, is_builtin, params_json, created_at, updated_at, tags_json
             FROM style_presets
             ORDER BY is_builtin DESC, updated_at DESC",
        )
        .map_err(|error| format!("准备风格预设查询失败：{error}"))?;

    let rows = statement
        .query_map([], map_row)
        .map_err(|error| format!("查询风格预设失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取风格预设失败：{error}"))?;

    Ok(rows)
}

#[tauri::command]
pub fn get_style_preset(app: AppHandle, id: String) -> Result<Option<StylePresetRecord>, String> {
    let connection = prepare_connection(&app)?;
    let result = connection.query_row(
        "SELECT id, label, tagline, thumbnail, is_builtin, params_json, created_at, updated_at, tags_json
         FROM style_presets WHERE id = ?1",
        params![id],
        map_row,
    );

    match result {
        Ok(record) => Ok(Some(record)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(format!("读取风格预设失败：{error}")),
    }
}

#[tauri::command]
pub fn save_style_preset(app: AppHandle, input: SaveStylePresetInput) -> Result<StylePresetRecord, String> {
    if input.id.trim().is_empty() {
        return Err("预设 ID 不能为空。".to_string());
    }
    if input.label.trim().is_empty() {
        return Err("预设名称不能为空。".to_string());
    }

    let connection = prepare_connection(&app)?;
    let now = current_timestamp();
    let existing_created_at: Option<i64> = connection
        .query_row(
            "SELECT created_at FROM style_presets WHERE id = ?1",
            params![input.id],
            |row| row.get(0),
        )
        .ok();
    let is_builtin: i64 = connection
        .query_row(
            "SELECT is_builtin FROM style_presets WHERE id = ?1",
            params![input.id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if is_builtin != 0 {
        return Err("内置预设不可覆盖。".to_string());
    }

    let created_at = existing_created_at.unwrap_or(now);
    let params_json = input.params.to_string();
    let tags_json = serde_json::to_string(&input.tags).unwrap_or_else(|_| "[]".to_string());

    connection
        .execute(
            "INSERT INTO style_presets (
                id, label, tagline, thumbnail, is_builtin, params_json, created_at, updated_at, tags_json
            ) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?8)
            ON CONFLICT(id) DO UPDATE SET
                label = excluded.label,
                tagline = excluded.tagline,
                thumbnail = excluded.thumbnail,
                params_json = excluded.params_json,
                tags_json = excluded.tags_json,
                updated_at = excluded.updated_at",
            params![
                input.id,
                input.label.trim(),
                input.tagline.trim(),
                input.thumbnail.trim(),
                params_json,
                created_at,
                now,
                tags_json,
            ],
        )
        .map_err(|error| format!("保存风格预设失败：{error}"))?;

    get_style_preset(app, input.id)?.ok_or_else(|| "保存后无法读取风格预设。".to_string())
}

#[tauri::command]
pub fn delete_style_preset(app: AppHandle, id: String) -> Result<(), String> {
    let connection = prepare_connection(&app)?;
    let is_builtin: i64 = connection
        .query_row(
            "SELECT is_builtin FROM style_presets WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if is_builtin != 0 {
        return Err("内置预设不可删除。".to_string());
    }

    connection
        .execute("DELETE FROM style_presets WHERE id = ?1", params![id])
        .map_err(|error| format!("删除风格预设失败：{error}"))?;

    Ok(())
}
