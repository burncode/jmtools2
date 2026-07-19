use rusqlite::Connection;

use crate::character::generation::provider::{load_image_provider, resolve_image_model, StoredImageModel, StoredImageProvider};
use crate::character::model::CharacterGenerationSettings;
use rusqlite::{params, OptionalExtension};

pub(crate) fn load_character_generation_settings(
    connection: &Connection,
) -> Result<CharacterGenerationSettings, String> {
    let settings_json: Option<String> = connection
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params!["app.settings"],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("读取应用设置失败：{error}"))?;

    if let Some(value) = settings_json {
        return serde_json::from_str(&value)
            .map_err(|error| format!("应用设置格式错误，无法读取角色生成模型绑定：{error}"));
    }

    Ok(CharacterGenerationSettings {
        ai_character_model: String::new(),
        ai_character_provider_id: String::new(),
        ai_character_edit_model: String::new(),
        ai_character_edit_provider_id: String::new(),
    })
}

/// 解析图像编辑(img2img)角色绑定：优先用独立的编辑模型绑定，未配置时回退到角色生成绑定。
/// 用于带参考图的视图/turnaround/动作帧生成，避免文生图模型不支持参考图、或编辑模型无法纯文生图的错配。
pub(crate) fn resolve_character_edit_binding(
    connection: &Connection,
    settings: &CharacterGenerationSettings,
) -> Result<(StoredImageProvider, StoredImageModel), String> {
    let provider_id = if settings.ai_character_edit_provider_id.trim().is_empty() {
        settings.ai_character_provider_id.as_str()
    } else {
        settings.ai_character_edit_provider_id.as_str()
    };
    let model_name = if settings.ai_character_edit_model.trim().is_empty() {
        settings.ai_character_model.as_str()
    } else {
        settings.ai_character_edit_model.as_str()
    };

    let provider = load_image_provider(connection, provider_id)?;
    let model = resolve_image_model(connection, &provider, model_name)?;
    Ok((provider, model))
}

pub(crate) fn validate_character_generation_settings(
    settings: &CharacterGenerationSettings,
) -> Result<(), String> {
    if settings.ai_character_provider_id.trim().is_empty() {
        return Err("请先在设置中为“角色生成”绑定服务商。".to_string());
    }

    if settings.ai_character_model.trim().is_empty() {
        return Err("请先在设置中为“角色生成”绑定模型。".to_string());
    }

    Ok(())
}

