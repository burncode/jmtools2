use rusqlite::{params, Connection};
use serde_json::Value;

use crate::storage::database::current_timestamp;

const BUILTIN_PIXEL_RETRO: &str = include_str!("../../../shared/style-presets/pixel_retro_16.json");
const BUILTIN_ANIME_CEL: &str = include_str!("../../../shared/style-presets/anime_cel.json");
const BUILTIN_REALISTIC_SOFT: &str = include_str!("../../../shared/style-presets/realistic_soft.json");
const BUILTIN_HAND_PAINT: &str = include_str!("../../../shared/style-presets/hand_paint.json");
const BUILTIN_LOW_POLY_FLAT: &str = include_str!("../../../shared/style-presets/low_poly_flat.json");

const BUILTIN_SOURCES: &[&str] = &[
    BUILTIN_PIXEL_RETRO,
    BUILTIN_ANIME_CEL,
    BUILTIN_REALISTIC_SOFT,
    BUILTIN_HAND_PAINT,
    BUILTIN_LOW_POLY_FLAT,
];

const TAGLINES: &[(&str, &str)] = &[
    ("pixel_retro_16", "16 色 · 平光 · 复古 RPG"),
    ("anime_cel", "赛璐璐 · 柔光 · 角色立绘"),
    ("realistic_soft", "柔光 · 电影感 · 写实插画"),
    ("hand_paint", "手绘笔触 · 暖色 · 风格化"),
    ("low_poly_flat", "低模 · 平光 · 几何块面"),
];

const BUILTIN_TAGS: &[(&str, &str)] = &[
    ("pixel_retro_16", "[\"像素\",\"复古\",\"RPG\"]"),
    ("anime_cel", "[\"动漫\",\"立绘\"]"),
    ("realistic_soft", "[\"写实\",\"场景\"]"),
    ("hand_paint", "[\"手绘\",\"场景\"]"),
    ("low_poly_flat", "[\"低模\",\"场景\"]"),
];

fn ensure_tags_json_column(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(style_presets)")
        .map_err(|error| format!("读取风格预设表结构失败：{error}"))?;

    let has_tags = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("读取风格预设表结构失败：{error}"))?
        .filter_map(Result::ok)
        .any(|name| name == "tags_json");

    if has_tags {
        return Ok(());
    }

    connection
        .execute(
            "ALTER TABLE style_presets ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'",
            [],
        )
        .map_err(|error| format!("添加风格预设 tags_json 列失败：{error}"))?;

    Ok(())
}

fn seed_builtin_preset_tags(connection: &Connection) -> Result<(), String> {
    for (preset_id, tags_json) in BUILTIN_TAGS {
        connection
            .execute(
                "UPDATE style_presets SET tags_json = ?2 WHERE id = ?1 AND (tags_json IS NULL OR tags_json = '[]')",
                params![preset_id, tags_json],
            )
            .map_err(|error| format!("写入内置风格预设标签失败：{error}"))?;
    }

    Ok(())
}

pub fn ensure_style_preset_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS style_presets (
                id TEXT PRIMARY KEY NOT NULL,
                label TEXT NOT NULL,
                tagline TEXT NOT NULL DEFAULT '',
                thumbnail TEXT NOT NULL DEFAULT '',
                is_builtin INTEGER NOT NULL DEFAULT 0,
                params_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_style_presets_updated
                ON style_presets(updated_at DESC);",
        )
        .map_err(|error| format!("初始化风格预设数据库失败：{error}"))?;

    ensure_tags_json_column(connection)?;
    seed_builtin_preset_tags(connection)
}

pub fn seed_builtin_style_presets(connection: &Connection) -> Result<(), String> {
    ensure_style_preset_schema(connection)?;

    let count: i64 = connection
        .query_row("SELECT COUNT(*) FROM style_presets", [], |row| row.get(0))
        .map_err(|error| format!("读取风格预设数量失败：{error}"))?;

    if count > 0 {
        return Ok(());
    }

    let now = current_timestamp();
    for source in BUILTIN_SOURCES {
        let parsed: Value = serde_json::from_str(source)
            .map_err(|error| format!("解析内置风格预设失败：{error}"))?;
        let id = parsed
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "内置风格预设缺少 id。".to_string())?;
        let label = parsed
            .get("label")
            .and_then(Value::as_str)
            .unwrap_or(id);
        let params = parsed
            .get("params")
            .cloned()
            .unwrap_or_else(|| Value::Object(Default::default()));
        let tagline = TAGLINES
            .iter()
            .find(|(preset_id, _)| *preset_id == id)
            .map(|(_, text)| *text)
            .unwrap_or(label);
        let tags_json = BUILTIN_TAGS
            .iter()
            .find(|(preset_id, _)| *preset_id == id)
            .map(|(_, tags)| *tags)
            .unwrap_or("[]");

        connection
            .execute(
                "INSERT INTO style_presets (
                    id, label, tagline, thumbnail, is_builtin, params_json, created_at, updated_at, tags_json
                ) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6, ?6, ?7)
                ON CONFLICT(id) DO UPDATE SET
                    label = excluded.label,
                    tagline = excluded.tagline,
                    thumbnail = excluded.thumbnail,
                    params_json = excluded.params_json,
                    updated_at = excluded.updated_at",
                params![
                    id,
                    label,
                    tagline,
                    id,
                    params.to_string(),
                    now,
                    tags_json,
                ],
            )
            .map_err(|error| format!("写入内置风格预设失败：{error}"))?;
    }

    Ok(())
}

pub fn load_style_preset_params(
    connection: &Connection,
    preset_id: &str,
) -> Result<Option<Value>, String> {
    ensure_style_preset_schema(connection)?;
    seed_builtin_style_presets(connection)?;

    let result = connection.query_row(
        "SELECT params_json FROM style_presets WHERE id = ?1",
        params![preset_id],
        |row| row.get::<_, String>(0),
    );

    match result {
        Ok(params_json) => {
            let parsed: Value = serde_json::from_str(&params_json)
                .map_err(|error| format!("解析风格预设参数失败：{error}"))?;
            Ok(Some(parsed))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(format!("读取风格预设失败：{error}")),
    }
}

pub fn load_builtin_preset_params(preset_id: &str) -> Option<Value> {
    for source in BUILTIN_SOURCES {
        if let Ok(parsed) = serde_json::from_str::<Value>(source) {
            if parsed.get("id").and_then(Value::as_str) == Some(preset_id) {
                return parsed.get("params").cloned();
            }
        }
    }
    None
}

pub fn resolve_style_preset_params(
    connection: Option<&Connection>,
    preset_id: &str,
) -> Option<Value> {
    if let Some(connection) = connection {
        if let Ok(Some(params)) = load_style_preset_params(connection, preset_id) {
            return Some(params);
        }
    }

    load_builtin_preset_params(preset_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_builtin_pixel_preset() {
        let params = load_builtin_preset_params("pixel_retro_16").expect("preset");
        assert_eq!(
            params.get("renderType").and_then(Value::as_str),
            Some("pixel")
        );
    }
}
