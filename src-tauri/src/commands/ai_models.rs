use std::time::Duration;

use crate::character::generation::local::{
    build_profile_statuses, list_runtime_statuses, load_local_inference_settings,
    local_models_directory, resolve_hardware_profile,
};
use crate::storage::database::{current_timestamp, ensure_ai_schema, ensure_app_settings_schema, open_app_database};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::AppHandle;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModelProvider {
    id: String,
    name: String,
    provider_type: String,
    preset: String,
    api_base: String,
    #[serde(default)]
    api_key: String,
    #[serde(default)]
    text_model: String,
    #[serde(default)]
    image_model: String,
    #[serde(default)]
    is_default: bool,
    #[serde(default)]
    created_at: i64,
    #[serde(default)]
    updated_at: i64,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderModel {
    id: String,
    provider_id: String,
    name: String,
    display_name: String,
    model_kind: String,
    #[serde(default)]
    context_length: i64,
    #[serde(default)]
    max_output_tokens: i64,
    #[serde(default)]
    default_temperature: f64,
    #[serde(default)]
    default_width: i64,
    #[serde(default)]
    default_height: i64,
    #[serde(default)]
    is_enabled: bool,
    #[serde(default)]
    is_default: bool,
    #[serde(default)]
    created_at: i64,
    #[serde(default)]
    updated_at: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderTestResult {
    ok: bool,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderRemoteModel {
    name: String,
    display_name: String,
    model_kind: String,
    #[serde(default)]
    default_width: u32,
    #[serde(default)]
    default_height: u32,
    #[serde(default)]
    ready: bool,
}

#[tauri::command]
pub fn list_ai_model_providers(app: AppHandle) -> Result<Vec<AiModelProvider>, String> {
    let connection = open_app_database(&app)?;
    ensure_ai_schema(&connection)?;

    let mut statement = connection
        .prepare(
            "SELECT id, name, provider_type, preset, api_base, api_key, text_model, image_model,
                    is_default, created_at, updated_at
             FROM ai_model_providers
             ORDER BY is_default DESC, updated_at DESC",
        )
        .map_err(|error| format!("读取 AI 服务提供商失败：{error}"))?;

    let providers = statement
        .query_map([], |row| {
            Ok(AiModelProvider {
                id: row.get(0)?,
                name: row.get(1)?,
                provider_type: row.get(2)?,
                preset: row.get(3)?,
                api_base: row.get(4)?,
                api_key: row.get(5)?,
                text_model: row.get(6)?,
                image_model: row.get(7)?,
                is_default: row.get::<_, i64>(8)? == 1,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|error| format!("读取 AI 服务提供商失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("解析 AI 服务提供商失败：{error}"))?;

    Ok(providers)
}

#[tauri::command]
pub fn list_ai_provider_models(
    app: AppHandle,
    provider_id: Option<String>,
) -> Result<Vec<AiProviderModel>, String> {
    let connection = open_app_database(&app)?;
    ensure_ai_schema(&connection)?;
    seed_models_from_legacy_provider_fields(&connection)?;

    let provider_id = provider_id.unwrap_or_default().trim().to_string();

    let sql = if provider_id.is_empty() {
        "SELECT id, provider_id, name, display_name, model_kind, context_length,
                max_output_tokens, default_temperature, default_width, default_height,
                is_enabled, is_default, created_at, updated_at
         FROM ai_provider_models
         ORDER BY provider_id ASC, is_default DESC, model_kind ASC, updated_at DESC"
    } else {
        "SELECT id, provider_id, name, display_name, model_kind, context_length,
                max_output_tokens, default_temperature, default_width, default_height,
                is_enabled, is_default, created_at, updated_at
         FROM ai_provider_models
         WHERE provider_id = ?1
         ORDER BY is_default DESC, model_kind ASC, updated_at DESC"
    };

    let mut statement = connection
        .prepare(sql)
        .map_err(|error| format!("读取 AI 模型列表失败：{error}"))?;

    let rows = if provider_id.is_empty() {
        statement
            .query_map([], map_provider_model_row)
            .map_err(|error| format!("读取 AI 模型列表失败：{error}"))?
            .collect::<Result<Vec<_>, _>>()
    } else {
        statement
            .query_map(params![provider_id], map_provider_model_row)
            .map_err(|error| format!("读取 AI 模型列表失败：{error}"))?
            .collect::<Result<Vec<_>, _>>()
    };

    rows.map_err(|error| format!("解析 AI 模型列表失败：{error}"))
}

#[tauri::command]
pub fn save_ai_model_provider(
    app: AppHandle,
    provider: AiModelProvider,
) -> Result<AiModelProvider, String> {
    let mut normalized_provider = normalize_provider(provider)?;
    let connection = open_app_database(&app)?;
    ensure_ai_schema(&connection)?;
    let now = current_timestamp();

    if normalized_provider.created_at == 0 {
        normalized_provider.created_at = now;
    }

    normalized_provider.updated_at = now;

    if normalized_provider.is_default {
        connection
            .execute("UPDATE ai_model_providers SET is_default = 0", [])
            .map_err(|error| format!("更新默认 AI 服务提供商失败：{error}"))?;
    }

    connection
        .execute(
            "INSERT INTO ai_model_providers (
                id, name, provider_type, preset, api_base, api_key, text_model, image_model,
                is_default, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                provider_type = excluded.provider_type,
                preset = excluded.preset,
                api_base = excluded.api_base,
                api_key = excluded.api_key,
                text_model = excluded.text_model,
                image_model = excluded.image_model,
                is_default = excluded.is_default,
                updated_at = excluded.updated_at",
            params![
                normalized_provider.id,
                normalized_provider.name,
                normalized_provider.provider_type,
                normalized_provider.preset,
                normalized_provider.api_base,
                normalized_provider.api_key,
                normalized_provider.text_model,
                normalized_provider.image_model,
                if normalized_provider.is_default { 1 } else { 0 },
                normalized_provider.created_at,
                normalized_provider.updated_at,
            ],
        )
        .map_err(|error| format!("保存 AI 服务提供商失败：{error}"))?;

    seed_provider_models(&connection, &normalized_provider)?;

    Ok(normalized_provider)
}

#[tauri::command]
pub fn delete_ai_model_provider(app: AppHandle, provider_id: String) -> Result<(), String> {
    let id = provider_id.trim();

    if id.is_empty() {
        return Err("AI 服务提供商标识不能为空。".to_string());
    }

    let connection = open_app_database(&app)?;
    ensure_ai_schema(&connection)?;

    connection
        .execute(
            "DELETE FROM ai_provider_models WHERE provider_id = ?1",
            params![id],
        )
        .map_err(|error| format!("删除 AI 模型列表失败：{error}"))?;

    connection
        .execute("DELETE FROM ai_model_providers WHERE id = ?1", params![id])
        .map_err(|error| format!("删除 AI 服务提供商失败：{error}"))?;

    Ok(())
}

#[tauri::command]
pub fn save_ai_provider_model(
    app: AppHandle,
    model: AiProviderModel,
) -> Result<AiProviderModel, String> {
    let mut normalized_model = normalize_model(model)?;
    let connection = open_app_database(&app)?;
    ensure_ai_schema(&connection)?;
    let now = current_timestamp();

    if normalized_model.created_at == 0 {
        normalized_model.created_at = now;
    }

    normalized_model.updated_at = now;

    if normalized_model.is_default {
        connection
            .execute(
                "UPDATE ai_provider_models SET is_default = 0 WHERE provider_id = ?1 AND model_kind = ?2",
                params![normalized_model.provider_id, normalized_model.model_kind],
            )
            .map_err(|error| format!("更新默认 AI 模型失败：{error}"))?;
    }

    connection
        .execute(
            "INSERT INTO ai_provider_models (
                id, provider_id, name, display_name, model_kind, context_length,
                max_output_tokens, default_temperature, default_width, default_height,
                is_enabled, is_default, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
            ON CONFLICT(provider_id, name) DO UPDATE SET
                display_name = excluded.display_name,
                model_kind = excluded.model_kind,
                context_length = excluded.context_length,
                max_output_tokens = excluded.max_output_tokens,
                default_temperature = excluded.default_temperature,
                default_width = excluded.default_width,
                default_height = excluded.default_height,
                is_enabled = excluded.is_enabled,
                is_default = excluded.is_default,
                updated_at = excluded.updated_at",
            params![
                normalized_model.id,
                normalized_model.provider_id,
                normalized_model.name,
                normalized_model.display_name,
                normalized_model.model_kind,
                normalized_model.context_length,
                normalized_model.max_output_tokens,
                normalized_model.default_temperature,
                normalized_model.default_width,
                normalized_model.default_height,
                if normalized_model.is_enabled { 1 } else { 0 },
                if normalized_model.is_default { 1 } else { 0 },
                normalized_model.created_at,
                normalized_model.updated_at,
            ],
        )
        .map_err(|error| format!("保存 AI 模型失败：{error}"))?;

    Ok(normalized_model)
}

#[tauri::command]
pub fn delete_ai_provider_model(app: AppHandle, model_id: String) -> Result<(), String> {
    let id = model_id.trim();

    if id.is_empty() {
        return Err("AI 模型标识不能为空。".to_string());
    }

    let connection = open_app_database(&app)?;
    ensure_ai_schema(&connection)?;

    connection
        .execute("DELETE FROM ai_provider_models WHERE id = ?1", params![id])
        .map_err(|error| format!("删除 AI 模型失败：{error}"))?;

    Ok(())
}

#[tauri::command]
pub fn refresh_ai_provider_models(
    app: AppHandle,
    provider: AiModelProvider,
) -> Result<Vec<AiProviderRemoteModel>, String> {
    let provider = normalize_provider(provider)?;

    match provider.preset.as_str() {
        "ollama" => fetch_ollama_models(&provider),
        "local-diffusion" => fetch_local_diffusion_models(&app),
        "openai" | "deepseek" | "qwen" | "openai-compatible" => {
            fetch_openai_compatible_models(&provider)
        }
        "anthropic" => Err("Anthropic 模型刷新会在专用适配器接入后启用。".to_string()),
        "comfyui" | "sd-webui" => Err("该服务主要使用工作流，不支持通过模型列表刷新。".to_string()),
        _ => {
            if provider.provider_type != "local" {
                fetch_openai_compatible_models(&provider)
            } else {
                Err("本地服务暂未提供对应的模型刷新适配器。".to_string())
            }
        }
    }
}

#[tauri::command]
pub fn test_ai_model_provider(
    app: AppHandle,
    provider: AiModelProvider,
) -> Result<AiProviderTestResult, String> {
    let provider = normalize_provider(provider)?;

    if provider.preset.as_str() == "local-diffusion" {
        return test_local_diffusion_provider(&app);
    }

    if provider.text_model.trim().is_empty() {
        return Ok(failed_test_result("请先为该服务商配置一个文本模型。"));
    }

    match provider.preset.as_str() {
        "ollama" => test_ollama_provider(&provider),
        "openai" | "deepseek" | "qwen" | "openai-compatible" => {
            test_openai_compatible_provider(&provider)
        }
        "anthropic" => Ok(failed_test_result(
            "Anthropic 的真实连接验证会在专用适配器接入后启用。",
        )),
        "comfyui" | "sd-webui" => Ok(failed_test_result(
            "该服务主要用于图像工作流，不适用于文本模型连接测试。",
        )),
        _ => {
            if provider.provider_type != "local" {
                test_openai_compatible_provider(&provider)
            } else {
                Ok(failed_test_result("本地服务暂未提供对应的连接测试适配器。"))
            }
        }
    }
}

fn fetch_openai_compatible_models(
    provider: &AiModelProvider,
) -> Result<Vec<AiProviderRemoteModel>, String> {
    if provider.api_key.trim().is_empty() {
        return Err("刷新云端模型列表需要先填写 API Key。".to_string());
    }

    let endpoint = build_models_endpoint(provider);
    let response = http_client()?
        .get(&endpoint)
        .bearer_auth(provider.api_key.trim())
        .send()
        .map_err(|error| format!("刷新模型列表失败：{error}"))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("读取模型列表响应失败：{error}"))?;

    if !status.is_success() {
        return Err(format!(
            "刷新模型列表失败：HTTP {}，{}",
            status.as_u16(),
            summarize_response_body(&body)
        ));
    }

    let parsed_body: Value =
        serde_json::from_str(&body).map_err(|error| format!("模型列表响应格式错误：{error}"))?;
    let models = parsed_body
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| "模型列表响应中没有 data 数组。".to_string())?;

    Ok(models
        .iter()
        .filter_map(|model| model.get("id").and_then(Value::as_str))
        .map(remote_model_from_name)
        .collect())
}

fn fetch_local_diffusion_models(app: &AppHandle) -> Result<Vec<AiProviderRemoteModel>, String> {
    let connection = open_app_database(app)?;
    ensure_app_settings_schema(&connection)?;
    let settings = load_local_inference_settings(&connection)?;
    let resolved = resolve_hardware_profile(&connection, false)?;
    let models_dir = local_models_directory(app)?;
    let statuses = build_profile_statuses(
        app,
        &models_dir,
        &settings,
        &resolved.hardware,
        Some(resolved.recommended_profile_id.as_str()),
    )?;

    Ok(statuses
        .into_iter()
        .filter(|status| status.profile.backend == "sd-cpp")
        .map(|status| {
            let suffix = if status.ready {
                " · 已就绪"
            } else if status.installed {
                " · 未就绪"
            } else {
                " · 未下载"
            };

            AiProviderRemoteModel {
                name: status.profile.id.clone(),
                display_name: format!("{}{suffix}", status.profile.label),
                model_kind: "image".to_string(),
                default_width: status.profile.default_width,
                default_height: status.profile.default_height,
                ready: status.ready,
            }
        })
        .collect())
}

fn test_local_diffusion_provider(app: &AppHandle) -> Result<AiProviderTestResult, String> {
    let runtimes = list_runtime_statuses(app)?;
    let installed_runtime = runtimes.iter().any(|runtime| runtime.installed);

    if !installed_runtime {
        return Ok(failed_test_result(
            "本地生图 Runtime 尚未安装。请先在「设置 → 本地生图 → 运行环境」中安装 stable-diffusion.cpp。",
        ));
    }

    let connection = open_app_database(app)?;
    ensure_app_settings_schema(&connection)?;
    let settings = load_local_inference_settings(&connection)?;
    let resolved = resolve_hardware_profile(&connection, false)?;
    let models_dir = local_models_directory(app)?;
    let statuses = build_profile_statuses(
        app,
        &models_dir,
        &settings,
        &resolved.hardware,
        Some(resolved.recommended_profile_id.as_str()),
    )?;
    let ready_count = statuses
        .iter()
        .filter(|status| status.profile.backend == "sd-cpp" && status.ready)
        .count();

    if ready_count == 0 {
        return Ok(AiProviderTestResult {
            ok: true,
            message: "本地生图 Runtime 已安装，但尚无就绪的 sd-cpp 模型档位。请在「本地生图 → 模型管理」中下载或导入模型。".to_string(),
        });
    }

    Ok(AiProviderTestResult {
        ok: true,
        message: format!(
            "本地生图服务可用：已安装 Runtime，{ready_count} 个 sd-cpp 档位就绪。请在下方添加图像模型并保存。"
        ),
    })
}

fn fetch_ollama_models(provider: &AiModelProvider) -> Result<Vec<AiProviderRemoteModel>, String> {
    let endpoint = format!("{}/api/tags", provider.api_base.trim_end_matches('/'));
    let response = http_client()?
        .get(endpoint)
        .send()
        .map_err(|error| format!("刷新 Ollama 模型列表失败：{error}"))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("读取 Ollama 模型列表失败：{error}"))?;

    if !status.is_success() {
        return Err(format!(
            "刷新 Ollama 模型列表失败：HTTP {}，{}",
            status.as_u16(),
            summarize_response_body(&body)
        ));
    }

    let parsed_body: Value = serde_json::from_str(&body)
        .map_err(|error| format!("Ollama 模型列表响应格式错误：{error}"))?;
    let models = parsed_body
        .get("models")
        .and_then(Value::as_array)
        .ok_or_else(|| "Ollama 响应中没有 models 数组。".to_string())?;

    Ok(models
        .iter()
        .filter_map(|model| model.get("name").and_then(Value::as_str))
        .map(remote_model_from_name)
        .collect())
}

fn remote_model_from_name(name: &str) -> AiProviderRemoteModel {
    AiProviderRemoteModel {
        name: name.to_string(),
        display_name: name.to_string(),
        model_kind: guess_model_kind(name).to_string(),
        default_width: 0,
        default_height: 0,
        ready: false,
    }
}

fn guess_model_kind(model_name: &str) -> &str {
    let lower_name = model_name.to_lowercase();

    if lower_name.contains("imageedit")
        || lower_name.contains("image-edit")
        || lower_name.contains("image_edit")
        || (lower_name.contains("edit")
            && (lower_name.contains("image") || lower_name.contains("wanx")))
    {
        return "image-edit";
    }

    if lower_name.contains("embedding") || lower_name.contains("embed-") || lower_name.contains("/embed") {
        return "embedding";
    }

    if lower_name.contains("rerank") {
        return "rerank";
    }

    if lower_name.contains("tts")
        || lower_name.contains("whisper")
        || lower_name.contains("audio")
        || lower_name.contains("speech")
        || lower_name.contains("cosyvoice")
    {
        return "audio";
    }

    if lower_name.contains("vision")
        || lower_name.contains("-vl")
        || lower_name.contains("vl-")
        || lower_name.contains("vl_")
        || lower_name.contains("qwen-vl")
        || lower_name.contains("multimodal")
    {
        return "vision";
    }

    if lower_name.contains("image")
        || lower_name.contains("gpt-image")
        || lower_name.contains("wanx")
        || lower_name.contains("dall")
        || lower_name.contains("flux")
        || lower_name.contains("diffusion")
        || lower_name.contains("stable-diffusion")
    {
        return "image";
    }

    "text"
}

fn test_openai_compatible_provider(
    provider: &AiModelProvider,
) -> Result<AiProviderTestResult, String> {
    if provider.api_key.trim().is_empty() {
        return Ok(failed_test_result("云端或自定义服务需要先填写 API Key。"));
    }

    let endpoint = build_openai_chat_endpoint(provider);
    let payload = json!({
        "model": provider.text_model,
        "messages": [
            {
                "role": "system",
                "content": "You are a connectivity test endpoint for JMTools. Reply briefly."
            },
            {
                "role": "user",
                "content": "请回复：JMTools AI 连接正常"
            }
        ],
        "temperature": 0,
        "max_tokens": 32,
        "stream": false
    });

    let response = http_client()?
        .post(&endpoint)
        .bearer_auth(provider.api_key.trim())
        .json(&payload)
        .send()
        .map_err(|error| format!("AI 连接请求失败：{error}"))?;

    parse_chat_test_response(response, &provider.name)
}

fn test_ollama_provider(provider: &AiModelProvider) -> Result<AiProviderTestResult, String> {
    let endpoint = format!("{}/api/chat", provider.api_base.trim_end_matches('/'));
    let payload = json!({
        "model": provider.text_model,
        "messages": [
            {
                "role": "user",
                "content": "请回复：JMTools AI 连接正常"
            }
        ],
        "stream": false
    });

    let response = http_client()?
        .post(endpoint)
        .json(&payload)
        .send()
        .map_err(|error| format!("Ollama 连接请求失败：{error}"))?;

    parse_chat_test_response(response, &provider.name)
}

fn parse_chat_test_response(
    response: reqwest::blocking::Response,
    provider_name: &str,
) -> Result<AiProviderTestResult, String> {
    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("读取 AI 响应失败：{error}"))?;

    if !status.is_success() {
        return Ok(failed_test_result(&format!(
            "{provider_name} 连接失败：HTTP {}，{}",
            status.as_u16(),
            summarize_response_body(&body)
        )));
    }

    let parsed_body: Value =
        serde_json::from_str(&body).map_err(|error| format!("AI 响应不是有效 JSON：{error}"))?;

    let content = parsed_body
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .or_else(|| {
            parsed_body
                .pointer("/message/content")
                .and_then(Value::as_str)
        })
        .unwrap_or_default()
        .trim();

    if content.is_empty() {
        return Ok(failed_test_result(
            "服务已响应，但没有返回可识别的文本内容。请检查模型名称是否正确。",
        ));
    }

    Ok(AiProviderTestResult {
        ok: true,
        message: format!("{provider_name} 连接正常，模型已返回文本响应。"),
    })
}

fn build_openai_chat_endpoint(provider: &AiModelProvider) -> String {
    let api_base = provider.api_base.trim_end_matches('/');

    if api_base.ends_with("/chat/completions") {
        return api_base.to_string();
    }

    if provider.preset == "deepseek" {
        return format!("{api_base}/chat/completions");
    }

    format!("{api_base}/chat/completions")
}

fn build_models_endpoint(provider: &AiModelProvider) -> String {
    let api_base = provider.api_base.trim_end_matches('/');

    if api_base.ends_with("/models") {
        return api_base.to_string();
    }

    format!("{api_base}/models")
}

fn summarize_response_body(body: &str) -> String {
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

fn failed_test_result(message: &str) -> AiProviderTestResult {
    AiProviderTestResult {
        ok: false,
        message: message.to_string(),
    }
}

fn http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| format!("初始化 AI HTTP 客户端失败：{error}"))
}

fn normalize_provider(mut provider: AiModelProvider) -> Result<AiModelProvider, String> {
    provider.id = provider.id.trim().to_string();
    provider.name = provider.name.trim().to_string();
    provider.provider_type = provider.provider_type.trim().to_string();
    provider.preset = provider.preset.trim().to_string();
    provider.api_base = provider.api_base.trim().to_string();
    provider.text_model = provider.text_model.trim().to_string();
    provider.image_model = provider.image_model.trim().to_string();

    if provider.id.is_empty() {
        return Err("AI 服务提供商标识不能为空。".to_string());
    }

    if provider.name.is_empty() {
        return Err("AI 服务提供商名称不能为空。".to_string());
    }

    if !matches!(
        provider.provider_type.as_str(),
        "foreign" | "domestic" | "local" | "custom"
    ) {
        return Err("AI 服务提供商分类不受支持。".to_string());
    }

    if provider.preset.is_empty() {
        return Err("AI 服务提供商预设不能为空。".to_string());
    }

    if provider.api_base.is_empty() {
        return Err("API Base 不能为空。".to_string());
    }

    Ok(provider)
}

fn normalize_model(mut model: AiProviderModel) -> Result<AiProviderModel, String> {
    model.id = model.id.trim().to_string();
    model.provider_id = model.provider_id.trim().to_string();
    model.name = model.name.trim().to_string();
    model.display_name = model.display_name.trim().to_string();
    model.model_kind = model.model_kind.trim().to_string();

    if model.id.is_empty() {
        return Err("AI 模型标识不能为空。".to_string());
    }

    if model.provider_id.is_empty() {
        return Err("AI 模型必须绑定服务提供商。".to_string());
    }

    if model.name.is_empty() {
        return Err("AI 模型名称不能为空。".to_string());
    }

    if model.display_name.is_empty() {
        model.display_name = model.name.clone();
    }

    if !matches!(
        model.model_kind.as_str(),
        "text" | "image" | "image-edit" | "audio" | "embedding" | "rerank" | "vision"
    ) {
        return Err("AI 模型用途类型不受支持。".to_string());
    }

    Ok(model)
}

fn map_provider_model_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<AiProviderModel> {
    Ok(AiProviderModel {
        id: row.get(0)?,
        provider_id: row.get(1)?,
        name: row.get(2)?,
        display_name: row.get(3)?,
        model_kind: row.get(4)?,
        context_length: row.get(5)?,
        max_output_tokens: row.get(6)?,
        default_temperature: row.get(7)?,
        default_width: row.get(8)?,
        default_height: row.get(9)?,
        is_enabled: row.get::<_, i64>(10)? == 1,
        is_default: row.get::<_, i64>(11)? == 1,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

fn seed_models_from_legacy_provider_fields(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare(
            "SELECT id, name, provider_type, preset, api_base, api_key, text_model, image_model,
                    is_default, created_at, updated_at
             FROM ai_model_providers",
        )
        .map_err(|error| format!("读取 AI 服务提供商失败：{error}"))?;

    let providers = statement
        .query_map([], |row| {
            Ok(AiModelProvider {
                id: row.get(0)?,
                name: row.get(1)?,
                provider_type: row.get(2)?,
                preset: row.get(3)?,
                api_base: row.get(4)?,
                api_key: row.get(5)?,
                text_model: row.get(6)?,
                image_model: row.get(7)?,
                is_default: row.get::<_, i64>(8)? == 1,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|error| format!("读取 AI 服务提供商失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("解析 AI 服务提供商失败：{error}"))?;

    for provider in providers {
        seed_provider_models(connection, &provider)?;
    }

    Ok(())
}

fn seed_provider_models(connection: &Connection, provider: &AiModelProvider) -> Result<(), String> {
    if !provider.text_model.trim().is_empty() {
        upsert_seed_model(connection, provider, provider.text_model.trim(), "text")?;
    }

    if !provider.image_model.trim().is_empty() {
        upsert_seed_model(connection, provider, provider.image_model.trim(), "image")?;
    }

    Ok(())
}

fn upsert_seed_model(
    connection: &Connection,
    provider: &AiModelProvider,
    model_name: &str,
    model_kind: &str,
) -> Result<(), String> {
    let now = current_timestamp();
    let model_id = format!(
        "{}::{}::{}",
        provider.id,
        model_kind,
        model_name.replace([' ', '/', '\\', ':'], "_")
    );

    connection
        .execute(
            "INSERT INTO ai_provider_models (
                id, provider_id, name, display_name, model_kind, context_length,
                max_output_tokens, default_temperature, default_width, default_height,
                is_enabled, is_default, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, 0, 0, 0, 1, 1, ?6, ?6)
            ON CONFLICT(provider_id, name) DO UPDATE SET
                display_name = excluded.display_name,
                model_kind = excluded.model_kind,
                is_enabled = 1,
                updated_at = excluded.updated_at",
            params![
                model_id,
                provider.id,
                model_name,
                model_name,
                model_kind,
                now,
            ],
        )
        .map_err(|error| format!("初始化 AI 模型失败：{error}"))?;

    Ok(())
}
