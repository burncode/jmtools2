use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use tracing::warn;

use tauri::AppHandle;

use crate::character::generation::local::is_local_image_preset;
use crate::character::generation::local::provider_bridge::request_local_character_image_bytes;
use crate::character::model::*;

pub(crate) use crate::character::model::{StoredImageModel, StoredImageProvider};

pub(crate) fn load_image_provider(
    connection: &Connection,
    requested_provider_id: &str,
) -> Result<StoredImageProvider, String> {
    let provider_id = requested_provider_id.trim();
    let sql = if provider_id.is_empty() {
        "SELECT id, name, provider_type, preset, api_base, api_key, image_model
         FROM ai_model_providers
         ORDER BY is_default DESC, updated_at DESC
         LIMIT 1"
    } else {
        "SELECT id, name, provider_type, preset, api_base, api_key, image_model
         FROM ai_model_providers
         WHERE id = ?1
         LIMIT 1"
    };

    let provider = if provider_id.is_empty() {
        connection.query_row(sql, [], map_image_provider_row)
    } else {
        connection.query_row(sql, params![provider_id], map_image_provider_row)
    }
    .optional()
    .map_err(|error| format!("读取角色图像生成服务商失败：{error}"))?;

    provider.ok_or_else(|| "请先在设置中配置角色图像生成服务商。".to_string())
}

pub(crate) fn map_image_provider_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<StoredImageProvider> {
    Ok(StoredImageProvider {
        id: row.get(0)?,
        name: row.get(1)?,
        provider_type: row.get(2)?,
        preset: row.get(3)?,
        api_base: row.get(4)?,
        api_key: row.get(5)?,
        image_model: row.get(6)?,
    })
}

pub(crate) fn resolve_image_model(
    connection: &Connection,
    provider: &StoredImageProvider,
    requested_model: &str,
) -> Result<StoredImageModel, String> {
    let requested_model = requested_model.trim();

    if !requested_model.is_empty() {
        let (default_width, default_height) =
            lookup_model_dimensions(connection, &provider.id, requested_model).unwrap_or((1024, 1024));
        return Ok(StoredImageModel {
            default_height,
            default_width,
            name: requested_model.to_string(),
        });
    }

    let provider_image_model = provider.image_model.trim();
    if !provider_image_model.is_empty() {
        let (default_width, default_height) =
            lookup_model_dimensions(connection, &provider.id, provider_image_model)
                .unwrap_or((1024, 1024));
        return Ok(StoredImageModel {
            default_height,
            default_width,
            name: provider_image_model.to_string(),
        });
    }

    let model = connection
        .query_row(
            "SELECT name, default_width, default_height
             FROM ai_provider_models
             WHERE provider_id = ?1
               AND is_enabled = 1
               AND model_kind = 'image'
             ORDER BY is_default DESC, updated_at DESC
             LIMIT 1",
            params![provider.id],
            |row| {
                let width = row.get::<_, i64>(1)?;
                let height = row.get::<_, i64>(2)?;

                Ok(StoredImageModel {
                    default_height: normalize_image_side(height),
                    default_width: normalize_image_side(width),
                    name: row.get(0)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("读取角色图像生成模型失败：{error}"))?;

    model.ok_or_else(|| "请先为角色图像生成服务商配置可用的图像模型。".to_string())
}

/// 按 (provider_id, model_name) 查模型登记的默认宽高；查不到或非法返回 None，由调用方决定回退。
pub(crate) fn lookup_model_dimensions(
    connection: &Connection,
    provider_id: &str,
    model_name: &str,
) -> Option<(u32, u32)> {
    connection
        .query_row(
            "SELECT default_width, default_height
             FROM ai_provider_models
             WHERE provider_id = ?1 AND name = ?2 AND model_kind IN ('image', 'image-edit')
             LIMIT 1",
            params![provider_id, model_name],
            |row| {
                let width = row.get::<_, i64>(0)?;
                let height = row.get::<_, i64>(1)?;
                Ok((width, height))
            },
        )
        .optional()
        .ok()
        .flatten()
        .filter(|(width, height)| *width > 0 && *height > 0)
        .map(|(width, height)| (normalize_image_side(width), normalize_image_side(height)))
}

pub(crate) fn normalize_image_side(value: i64) -> u32 {
    if value > 0 {
        value.clamp(128, 2048) as u32
    } else {
        1024
    }
}

pub(crate) fn request_character_view_image_url(
    app: Option<&AppHandle>,
    provider: &StoredImageProvider,
    model: &StoredImageModel,
    prompt: &str,
    reference_png: Option<&[u8]>,
    seed: Option<u64>,
    reference_strength: Option<f64>,
    size_override: Option<(u32, u32)>,
) -> Result<String, String> {
    if provider.api_key.trim().is_empty() && provider.provider_type != "local" {
        return Err("角色图像生成需要先配置 API Key。".to_string());
    }

    if matches!(provider.preset.as_str(), "comfyui" | "sd-webui") {
        return Err("ComfyUI / SD WebUI 图像生成适配器还未接入。".to_string());
    }

    if is_local_image_preset(provider.preset.as_str()) {
        let app = app.ok_or_else(|| "本地生图需要应用上下文。".to_string())?;
        let bytes = request_local_character_image_bytes(
            app,
            model,
            prompt,
            size_override,
            seed,
            reference_png,
            reference_strength,
        )?;
        return Ok(build_image_data_url(&bytes));
    }

    if provider.preset == "qwen" {
        // 携带参考图时关闭 prompt_extend，避免服务端扩写造成角色漂移。
        return request_qwen_image_url_inner(
            provider,
            model,
            prompt,
            reference_png,
            seed,
            reference_png.is_none(),
            reference_strength,
            size_override,
        );
    }

    if reference_png.is_some() {
        warn!(
            target = "jmtools::characters",
            provider = %provider.name,
            "当前服务商暂不支持图像参考条件化，已回退为纯文生图，多视图一致性可能下降"
        );
    }

    request_character_image_url(app, provider, model, prompt, size_override)
}

pub(crate) fn request_character_image_url(
    app: Option<&AppHandle>,
    provider: &StoredImageProvider,
    model: &StoredImageModel,
    prompt: &str,
    size_override: Option<(u32, u32)>,
) -> Result<String, String> {
    if provider.api_key.trim().is_empty() && provider.provider_type != "local" {
        return Err("角色图像生成需要先配置 API Key。".to_string());
    }

    if matches!(provider.preset.as_str(), "comfyui" | "sd-webui") {
        return Err("ComfyUI / SD WebUI 图像生成适配器还未接入。".to_string());
    }

    if is_local_image_preset(provider.preset.as_str()) {
        let app = app.ok_or_else(|| "本地生图需要应用上下文。".to_string())?;
        let bytes = request_local_character_image_bytes(
            app,
            model,
            prompt,
            size_override,
            None,
            None,
            None,
        )?;
        return Ok(build_image_data_url(&bytes));
    }

    if provider.preset == "qwen" {
        return request_qwen_image_url(provider, model, prompt, size_override);
    }

    let (width, height) = size_override.unwrap_or((model.default_width, model.default_height));
    let payload = json!({
        "model": model.name,
        "prompt": prompt,
        "n": 1,
        "size": format!("{}x{}", width, height),
        "response_format": "url"
    });
    let mut request = http_client()?
        .post(build_openai_image_endpoint(provider))
        .json(&payload);

    if !provider.api_key.trim().is_empty() {
        request = request.bearer_auth(provider.api_key.trim());
    }

    let response = request
        .send()
        .map_err(|error| format!("角色图像生成请求失败：{error}"))?;
    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("读取角色图像生成响应失败：{error}"))?;

    if !status.is_success() {
        return Err(format!(
            "角色图像生成失败：HTTP {}，{}",
            status.as_u16(),
            summarize_response_body(&body)
        ));
    }

    let parsed_body: Value = serde_json::from_str(&body)
        .map_err(|error| format!("角色图像生成响应不是有效 JSON：{error}"))?;

    if let Some(url) = parsed_body.pointer("/data/0/url").and_then(Value::as_str) {
        if !url.trim().is_empty() {
            return Ok(url.trim().to_string());
        }
    }

    if parsed_body
        .pointer("/data/0/b64_json")
        .and_then(Value::as_str)
        .is_some()
    {
        return Err(
            "图像服务返回了 base64 图片；当前版本先支持 URL 下载，base64 落盘会在下一步接入。"
                .to_string(),
        );
    }

    warn!(
        target = "jmtools::characters",
        response = %summarize_response_body(&body),
        "unrecognized image generation response"
    );
    Err("图像服务已响应，但没有返回可下载的图片 URL。".to_string())
}

/// 依据模型名判断是否为图像编辑(image-edit / img2img)类模型。
pub(crate) fn model_name_is_image_edit(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.contains("imageedit")
        || lower.contains("image-edit")
        || lower.contains("image_edit")
        || lower.contains("edit")
}

pub(crate) fn request_qwen_image_url(
    provider: &StoredImageProvider,
    model: &StoredImageModel,
    prompt: &str,
    size_override: Option<(u32, u32)>,
) -> Result<String, String> {
    request_qwen_image_url_inner(provider, model, prompt, None, None, true, None, size_override)
}

pub(crate) fn request_qwen_image_url_inner(
    provider: &StoredImageProvider,
    model: &StoredImageModel,
    prompt: &str,
    reference_png: Option<&[u8]>,
    seed: Option<u64>,
    prompt_extend: bool,
    reference_strength: Option<f64>,
    size_override: Option<(u32, u32)>,
) -> Result<String, String> {
    // 图像编辑(image-edit)模型在 DashScope multimodal-generation 端点要求 1~3 张输入图；
    // 候选图/母版这类纯文生图链路没有参考图，会被服务端拒绝（HTTP 400）。
    if reference_png.is_none() && model_name_is_image_edit(&model.name) {
        return Err(format!(
            "当前角色生成模型「{}」是图像编辑(image-edit)模型，需要参考图才能生成；候选图/母版属于纯文生图步骤，请在 设置 → AI → 模型用途绑定 中为「角色生成」改用文生图模型（图生图步骤可单独绑定图像编辑模型）。",
            model.name
        ));
    }

    let mut content: Vec<Value> = Vec::new();
    if let Some(reference) = reference_png {
        content.push(json!({ "image": build_image_data_url(reference) }));
    }
    content.push(json!({ "text": truncate_prompt(prompt, 1400) }));

    let (width, height) = size_override.unwrap_or((model.default_width, model.default_height));
    let mut parameters = json!({
        "negative_prompt": "低清晰度、低质量、肢体错乱、角色残缺、文字、水印、UI边框、复杂背景、过度平滑、模糊、变形、与参考图角色不一致、换装、换发色、换配色",
        "prompt_extend": prompt_extend,
        "watermark": false,
        "size": format!("{}*{}", width, height)
    });
    if let Some(seed) = seed {
        // DashScope seed 接受 32 位无符号范围内的整数。
        parameters["seed"] = json!(seed % 2_147_483_647);
    }
    // 仅在携带参考图时附带强度（DashScope img2img 用 strength 控制对参考图的偏离程度）。
    if reference_png.is_some() {
        if let Some(strength) = reference_strength {
            parameters["strength"] = json!(strength.clamp(0.0, 1.0));
        }
    }

    let payload = json!({
        "model": model.name,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": content
                }
            ]
        },
        "parameters": parameters
    });
    let mut last_rate_limit_message = String::new();

    for attempt in 0..3 {
        let response = http_client()?
            .post(build_qwen_image_endpoint(provider))
            .bearer_auth(provider.api_key.trim())
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .map_err(|error| format!("通义千问图像生成请求失败：{error}"))?;
        let status = response.status();
        let body = response
            .text()
            .map_err(|error| format!("读取通义千问图像生成响应失败：{error}"))?;

        if status.as_u16() == 429 {
            last_rate_limit_message = summarize_response_body(&body);
            let wait_seconds = 6 + attempt * 6;

            warn!(
                target = "jmtools::characters",
                attempt = attempt + 1,
                wait_seconds,
                message = %last_rate_limit_message,
                "qwen image generation rate limited"
            );
            thread::sleep(Duration::from_secs(wait_seconds));
            continue;
        }

        if !status.is_success() {
            return Err(format!(
                "通义千问图像生成失败：HTTP {}，{}",
                status.as_u16(),
                summarize_response_body(&body)
            ));
        }

        let parsed_body: Value = serde_json::from_str(&body)
            .map_err(|error| format!("通义千问图像生成响应不是有效 JSON：{error}"))?;

        if let Some(url) = parsed_body
            .pointer("/output/choices/0/message/content/0/image")
            .and_then(Value::as_str)
        {
            if !url.trim().is_empty() {
                return Ok(url.trim().to_string());
            }
        }

        if let Some(url) = parsed_body
            .pointer("/output/results/0/url")
            .and_then(Value::as_str)
        {
            if !url.trim().is_empty() {
                return Ok(url.trim().to_string());
            }
        }

        warn!(
            target = "jmtools::characters",
            response = %summarize_response_body(&body),
            "unrecognized qwen image generation response"
        );
        return Err("通义千问已响应，但没有返回可下载的图片 URL。".to_string());
    }

    Err(format!(
        "通义千问图像生成被限流，请稍后重试。{}",
        if last_rate_limit_message.is_empty() {
            "服务商返回 HTTP 429。".to_string()
        } else {
            last_rate_limit_message
        }
    ))
}

pub(crate) fn request_character_image_bytes(
    app: &AppHandle,
    provider: &StoredImageProvider,
    model: &StoredImageModel,
    prompt: &str,
    size_override: Option<(u32, u32)>,
    seed: Option<u64>,
    reference_png: Option<&[u8]>,
    reference_strength: Option<f64>,
) -> Result<Vec<u8>, String> {
    if is_local_image_preset(provider.preset.as_str()) {
        return request_local_character_image_bytes(
            app,
            model,
            prompt,
            size_override,
            seed,
            reference_png,
            reference_strength,
        );
    }

    if reference_png.is_some() {
        let image_url = request_character_view_image_url(
            Some(app),
            provider,
            model,
            prompt,
            reference_png,
            seed,
            reference_strength,
            size_override,
        )?;
        if image_url.starts_with("data:image/") {
            return decode_data_url_image(&image_url);
        }
        return download_generated_image(&image_url);
    }

    let image_url = request_character_image_url(Some(app), provider, model, prompt, size_override)?;
    if image_url.starts_with("data:image/") {
        return decode_data_url_image(&image_url);
    }

    download_generated_image(&image_url)
}

fn decode_data_url_image(data_url: &str) -> Result<Vec<u8>, String> {
    let payload = data_url
        .split_once(",")
        .map(|(_, encoded)| encoded)
        .ok_or_else(|| "无效的图片 data URL。".to_string())?;
    STANDARD
        .decode(payload)
        .map_err(|error| format!("解码图片 data URL 失败：{error}"))
}

pub(crate) fn download_generated_image(image_url: &str) -> Result<Vec<u8>, String> {
    let response = http_client()?
        .get(image_url)
        .send()
        .map_err(|error| format!("下载角色母版图失败：{error}"))?;
    let status = response.status();

    if !status.is_success() {
        return Err(format!("下载角色母版图失败：HTTP {}", status.as_u16()));
    }

    let bytes = response
        .bytes()
        .map_err(|error| format!("读取角色母版图失败：{error}"))?;

    if bytes.is_empty() {
        return Err("下载到的角色母版图为空。".to_string());
    }

    Ok(bytes.to_vec())
}

pub(crate) fn build_openai_image_endpoint(provider: &StoredImageProvider) -> String {
    let api_base = provider.api_base.trim_end_matches('/');

    if api_base.ends_with("/images/generations") {
        return api_base.to_string();
    }

    format!("{api_base}/images/generations")
}

pub(crate) fn build_qwen_image_endpoint(provider: &StoredImageProvider) -> String {
    let api_base = provider.api_base.trim_end_matches('/');

    if api_base.ends_with("/services/aigc/multimodal-generation/generation") {
        return api_base.to_string();
    }

    let normalized_base = api_base
        .replace("/compatible-mode/v1", "/api/v1")
        .trim_end_matches('/')
        .to_string();

    if normalized_base.ends_with("/api/v1") {
        return format!("{normalized_base}/services/aigc/multimodal-generation/generation");
    }

    format!("{normalized_base}/api/v1/services/aigc/multimodal-generation/generation")
}

pub(crate) fn truncate_prompt(prompt: &str, max_chars: usize) -> String {
    prompt.chars().take(max_chars).collect()
}

pub(crate) fn select_character_view_index(
    record: &CharacterAssetRecord,
    requested_view_id: Option<&str>,
) -> Result<usize, String> {
    if let Some(view_id) = requested_view_id {
        let normalized_view_id = view_id.trim();

        if normalized_view_id.is_empty() {
            return Err("视图 ID 不能为空。".to_string());
        }

        return record
            .views
            .iter()
            .position(|view| view.id == normalized_view_id)
            .ok_or_else(|| "未找到指定角色视图。".to_string());
    }

    record
        .views
        .iter()
        .position(|view| view.raw_image.is_some())
        .or_else(|| record.views.first().map(|_| 0))
        .ok_or_else(|| "角色没有可处理的视图。".to_string())
}

pub(crate) fn resolve_project_image_path(
    project_root: &Path,
    image: &CharacterImageAsset,
) -> Result<PathBuf, String> {
    let candidate_path = if !image.project_relative_path.trim().is_empty() {
        project_root.join(image.project_relative_path.trim())
    } else if !image.absolute_path.trim().is_empty() {
        PathBuf::from(image.absolute_path.trim())
    } else {
        return Err("图片缺少可读取的文件路径。".to_string());
    };

    let canonical_path = candidate_path
        .canonicalize()
        .map_err(|error| format!("解析图片路径失败：{error}"))?;

    if !canonical_path.starts_with(project_root) {
        return Err("图片路径不在当前项目目录内。".to_string());
    }

    Ok(canonical_path)
}

pub(crate) fn build_image_data_url(image_bytes: &[u8]) -> String {
    build_image_data_url_with_mime(image_bytes, "image/png")
}

pub(crate) fn build_image_data_url_with_mime(image_bytes: &[u8], mime_type: &str) -> String {
    format!("data:{mime_type};base64,{}", STANDARD.encode(image_bytes))
}

pub(crate) fn infer_image_mime(extension: &str) -> &'static str {
    match extension {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        _ => "image/png",
    }
}

pub(crate) fn summarize_response_body(body: &str) -> String {
    let trimmed_body = body.trim();

    if trimmed_body.is_empty() {
        return "响应体为空".to_string();
    }

    if let Ok(value) = serde_json::from_str::<Value>(trimmed_body) {
        if let Some(message) = value.pointer("/error/message").and_then(Value::as_str) {
            return message.chars().take(160).collect();
        }

        if let Some(message) = value.pointer("/message").and_then(Value::as_str) {
            return message.chars().take(160).collect();
        }
    }

    trimmed_body.chars().take(160).collect()
}

pub(crate) fn http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|error| format!("初始化 AI HTTP 客户端失败：{error}"))
}
