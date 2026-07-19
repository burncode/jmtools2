use rusqlite::{params, Connection, OptionalExtension};

use super::types::LocalInferenceSettings;

const LOCAL_INFERENCE_SETTINGS_KEY: &str = "local.inference.settings";
pub const DEFAULT_HF_ENDPOINT: &str = "https://huggingface.co";

pub fn resolve_hf_endpoint(raw: &str) -> String {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        DEFAULT_HF_ENDPOINT.to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn normalize_huggingface_endpoint(input: &str) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }

    if !trimmed.starts_with("https://") {
        return Err("HuggingFace 端点必须是 https:// 开头的 URL。".to_string());
    }

    let host = trimmed
        .strip_prefix("https://")
        .unwrap_or(trimmed)
        .trim_end_matches('/');

    if host.is_empty() {
        return Err("HuggingFace 端点不能为空。".to_string());
    }

    if host.contains('/') {
        return Err("HuggingFace 端点只需填写域名，不要包含路径。".to_string());
    }

    if host.contains('?') || host.contains('#') {
        return Err("HuggingFace 端点不能包含查询参数。".to_string());
    }

    Ok(format!("https://{host}"))
}

pub fn rewrite_huggingface_url(url: &str, endpoint: &str) -> String {
    let resolved = resolve_hf_endpoint(endpoint);
    url.replace("https://huggingface.co", resolved.as_str())
        .replace("http://huggingface.co", resolved.as_str())
        .replace("https://hf.co", resolved.as_str())
        .replace("http://hf.co", resolved.as_str())
}

pub fn load_local_inference_settings(connection: &Connection) -> Result<LocalInferenceSettings, String> {
    let stored: Option<String> = connection
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![LOCAL_INFERENCE_SETTINGS_KEY],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("读取本地生图设置失败：{error}"))?;

    if let Some(json) = stored {
        return serde_json::from_str(&json)
            .map_err(|error| format!("本地生图设置格式错误：{error}"));
    }

    Ok(LocalInferenceSettings::default())
}

pub fn save_local_inference_settings(
    connection: &Connection,
    settings: &LocalInferenceSettings,
) -> Result<(), String> {
    let mut normalized = settings.clone();
    normalized.huggingface_endpoint =
        normalize_huggingface_endpoint(settings.huggingface_endpoint.as_str())?;
    normalize_generation_settings(&mut normalized)?;

    let json = serde_json::to_string(&normalized)
        .map_err(|error| format!("序列化本地生图设置失败：{error}"))?;
    let timestamp = crate::storage::database::current_timestamp();

    connection
        .execute(
            "INSERT INTO app_settings (key, value, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![LOCAL_INFERENCE_SETTINGS_KEY, json, timestamp],
        )
        .map_err(|error| format!("保存本地生图设置失败：{error}"))?;

    Ok(())
}

fn normalize_generation_settings(settings: &mut LocalInferenceSettings) -> Result<(), String> {
    settings.generation_width = settings.generation_width.clamp(128, 2048);
    settings.generation_height = settings.generation_height.clamp(128, 2048);
    if settings.test_width > 0 {
        settings.test_width = settings.test_width.clamp(128, 2048);
    }
    if settings.test_height > 0 {
        settings.test_height = settings.test_height.clamp(128, 2048);
    }
    if settings.max_generation_side > 0
        && !matches!(settings.max_generation_side, 512 | 768 | 1024 | 1536)
    {
        return Err("最大边长仅支持 512、768、1024、1536，或 0（自动）。".to_string());
    }
    settings.generation_steps = settings.generation_steps.clamp(1, 50);
    settings.generation_cfg_scale = settings.generation_cfg_scale.clamp(0.1, 20.0);
    settings.default_img2img_strength = settings.default_img2img_strength.clamp(0.05, 1.0);
    if settings.max_img2img_side > 0
        && !matches!(settings.max_img2img_side, 384 | 512 | 768 | 1024)
    {
        return Err("参考图生图最大边长仅支持 384、512、768、1024，或 0（自动）。".to_string());
    }
    if let Some(overlap) = settings.runtime_vae_tile_overlap {
        if !(0.0..=0.9).contains(&overlap) {
            return Err("VAE 分块重叠系数需在 0.0–0.9 之间。".to_string());
        }
    }
    if let Some(mode) = settings.runtime_lora_apply_mode.as_ref() {
        let trimmed = mode.trim();
        if !trimmed.is_empty()
            && !matches!(trimmed, "auto" | "at_runtime" | "immediately")
        {
            return Err("LoRA 应用模式仅支持 auto、at_runtime、immediately。".to_string());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{normalize_huggingface_endpoint, resolve_hf_endpoint, rewrite_huggingface_url};

    #[test]
    fn resolves_official_endpoint_by_default() {
        assert_eq!(resolve_hf_endpoint(""), "https://huggingface.co");
    }

    #[test]
    fn rewrites_hf_urls_to_mirror() {
        let rewritten = rewrite_huggingface_url(
            "https://huggingface.co/unsloth/model/resolve/main/file.gguf",
            "https://hf-mirror.com",
        );
        assert_eq!(
            rewritten,
            "https://hf-mirror.com/unsloth/model/resolve/main/file.gguf"
        );
    }

    #[test]
    fn rejects_endpoint_with_path() {
        assert!(normalize_huggingface_endpoint("https://hf-mirror.com/foo").is_err());
    }
}
