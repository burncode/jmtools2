use std::time::Duration;

use crate::storage::database::{ensure_ai_schema, open_app_database};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::AppHandle;

#[derive(Clone)]
struct StoredAiProvider {
    id: String,
    name: String,
    provider_type: String,
    preset: String,
    api_base: String,
    api_key: String,
    text_model: String,
}

#[derive(Clone)]
struct StoredAiModel {
    name: String,
    default_temperature: f64,
    max_output_tokens: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTextGenerationRequest {
    #[serde(default)]
    pub(crate) provider_id: Option<String>,
    #[serde(default)]
    pub(crate) model: Option<String>,
    #[serde(default)]
    pub(crate) system_prompt: Option<String>,
    pub(crate) prompt: String,
    #[serde(default)]
    pub(crate) task_id: Option<String>,
    #[serde(default)]
    pub(crate) temperature: Option<f64>,
    #[serde(default)]
    pub(crate) max_tokens: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTextGenerationResult {
    pub(crate) provider_id: String,
    pub(crate) provider_name: String,
    pub(crate) model: String,
    pub(crate) content: String,
}

#[tauri::command]
pub async fn generate_ai_text(
    app: AppHandle,
    request: AiTextGenerationRequest,
) -> Result<AiTextGenerationResult, String> {
    tauri::async_runtime::spawn_blocking(move || generate_ai_text_blocking(app, request))
        .await
        .map_err(|error| format!("AI 生成任务执行失败：{error}"))?
}

pub(crate) fn generate_ai_text_blocking(
    app: AppHandle,
    request: AiTextGenerationRequest,
) -> Result<AiTextGenerationResult, String> {
    let request = normalize_text_request(request)?;
    let connection = open_app_database(&app)?;
    ensure_ai_schema(&connection)?;
    let provider = load_provider(&connection, request.provider_id.as_deref())?;
    let model = resolve_text_model(&connection, &provider, request.model.as_deref())?;

    tracing::info!(
        provider = %provider.name,
        preset = %provider.preset,
        model = %model.name,
        task_id = request.task_id.as_deref().unwrap_or("untracked"),
        "开始 AI 文本生成"
    );

    match provider.preset.as_str() {
        "ollama" => generate_ollama_text(&provider, &model, &request),
        "openai" | "deepseek" | "qwen" | "openai-compatible" => {
            generate_openai_compatible_text(&provider, &model, &request)
        }
        "anthropic" => Err("Anthropic 文本生成会在专用适配器接入后启用。".to_string()),
        "comfyui" | "sd-webui" => Err("该服务主要用于图像工作流，不适用于文本生成。".to_string()),
        _ => {
            if provider.provider_type != "local" {
                generate_openai_compatible_text(&provider, &model, &request)
            } else {
                Err("本地服务暂未提供对应的文本生成适配器。".to_string())
            }
        }
    }
}

fn generate_openai_compatible_text(
    provider: &StoredAiProvider,
    model: &StoredAiModel,
    request: &AiTextGenerationRequest,
) -> Result<AiTextGenerationResult, String> {
    if provider.api_key.trim().is_empty() {
        return Err("云端或自定义服务需要先配置 API Key。".to_string());
    }

    let mut messages = Vec::new();

    if let Some(system_prompt) = request.system_prompt.as_deref() {
        if !system_prompt.trim().is_empty() {
            messages.push(json!({
                "role": "system",
                "content": system_prompt.trim()
            }));
        }
    }

    messages.push(json!({
        "role": "user",
        "content": request.prompt.trim()
    }));

    let payload = json!({
        "model": model.name,
        "messages": messages,
        "temperature": request.temperature.unwrap_or(model.default_temperature),
        "max_tokens": request.max_tokens.unwrap_or_else(|| normalized_max_output_tokens(model)),
        "stream": false
    });

    let response = http_client()?
        .post(build_openai_chat_endpoint(provider))
        .bearer_auth(provider.api_key.trim())
        .json(&payload)
        .send()
        .map_err(|error| format!("AI 文本生成请求失败：{error}"))?;

    tracing::debug!(
        status = %response.status(),
        task_id = request.task_id.as_deref().unwrap_or("untracked"),
        "OpenAI-compatible 文本生成响应状态"
    );

    parse_text_generation_response(response, provider, model, request.task_id.as_deref())
}

fn generate_ollama_text(
    provider: &StoredAiProvider,
    model: &StoredAiModel,
    request: &AiTextGenerationRequest,
) -> Result<AiTextGenerationResult, String> {
    let mut messages = Vec::new();

    if let Some(system_prompt) = request.system_prompt.as_deref() {
        if !system_prompt.trim().is_empty() {
            messages.push(json!({
                "role": "system",
                "content": system_prompt.trim()
            }));
        }
    }

    messages.push(json!({
        "role": "user",
        "content": request.prompt.trim()
    }));

    let payload = json!({
        "model": model.name,
        "messages": messages,
        "stream": false,
        "options": {
            "temperature": request.temperature.unwrap_or(model.default_temperature),
            "num_predict": request.max_tokens.unwrap_or_else(|| normalized_max_output_tokens(model))
        }
    });

    let response = http_client()?
        .post(format!(
            "{}/api/chat",
            provider.api_base.trim_end_matches('/')
        ))
        .json(&payload)
        .send()
        .map_err(|error| format!("Ollama 文本生成请求失败：{error}"))?;

    tracing::debug!(
        status = %response.status(),
        task_id = request.task_id.as_deref().unwrap_or("untracked"),
        "Ollama 文本生成响应状态"
    );

    parse_text_generation_response(response, provider, model, request.task_id.as_deref())
}

fn parse_text_generation_response(
    response: reqwest::blocking::Response,
    provider: &StoredAiProvider,
    model: &StoredAiModel,
    task_id: Option<&str>,
) -> Result<AiTextGenerationResult, String> {
    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("读取 AI 文本生成响应失败：{error}"))?;

    if !status.is_success() {
        return Err(format!(
            "AI 文本生成失败：HTTP {}，{}",
            status.as_u16(),
            summarize_response_body(&body)
        ));
    }

    let parsed_body: Value = serde_json::from_str(&body)
        .map_err(|error| format!("AI 文本生成响应不是有效 JSON：{error}"))?;
    let content = parsed_body
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .or_else(|| {
            parsed_body
                .pointer("/message/content")
                .and_then(Value::as_str)
        })
        .unwrap_or_default()
        .trim()
        .to_string();

    if content.is_empty() {
        tracing::warn!(
            provider = %provider.name,
            model = %model.name,
            task_id = task_id.unwrap_or("untracked"),
            "AI 文本生成响应为空"
        );
        return Err("AI 服务已响应，但没有返回可识别的文本内容。".to_string());
    }

    tracing::info!(
        provider = %provider.name,
        model = %model.name,
        task_id = task_id.unwrap_or("untracked"),
        chars = content.chars().count(),
        "AI 文本生成完成"
    );

    Ok(AiTextGenerationResult {
        provider_id: provider.id.clone(),
        provider_name: provider.name.clone(),
        model: model.name.clone(),
        content,
    })
}

fn normalize_text_request(
    mut request: AiTextGenerationRequest,
) -> Result<AiTextGenerationRequest, String> {
    request.provider_id = request.provider_id.map(|value| value.trim().to_string());
    request.model = request.model.map(|value| value.trim().to_string());
    request.system_prompt = request.system_prompt.map(|value| value.trim().to_string());
    request.task_id = request.task_id.map(|value| value.trim().to_string());
    request.prompt = request.prompt.trim().to_string();

    if request.prompt.is_empty() {
        return Err("AI 生成提示词不能为空。".to_string());
    }

    if request.prompt.chars().count() > 20_000 {
        return Err("AI 生成提示词过长，请精简后重试。".to_string());
    }

    if let Some(temperature) = request.temperature {
        if !(0.0..=2.0).contains(&temperature) {
            return Err("temperature 必须在 0 到 2 之间。".to_string());
        }
    }

    if let Some(max_tokens) = request.max_tokens {
        if !(1..=16_384).contains(&max_tokens) {
            return Err("maxTokens 必须在 1 到 16384 之间。".to_string());
        }
    }

    Ok(request)
}

fn load_provider(
    connection: &Connection,
    provider_id: Option<&str>,
) -> Result<StoredAiProvider, String> {
    let requested_provider_id = provider_id.unwrap_or_default().trim();

    let sql = if requested_provider_id.is_empty() {
        "SELECT id, name, provider_type, preset, api_base, api_key, text_model
         FROM ai_model_providers
         ORDER BY is_default DESC, updated_at DESC
         LIMIT 1"
    } else {
        "SELECT id, name, provider_type, preset, api_base, api_key, text_model
         FROM ai_model_providers
         WHERE id = ?1
         LIMIT 1"
    };

    let provider = if requested_provider_id.is_empty() {
        connection.query_row(sql, [], map_provider_row).optional()
    } else {
        connection
            .query_row(sql, params![requested_provider_id], map_provider_row)
            .optional()
    }
    .map_err(|error| format!("读取 AI 服务提供商失败：{error}"))?;

    provider.ok_or_else(|| "请先在设置中配置可用的 AI 服务提供商。".to_string())
}

fn resolve_text_model(
    connection: &Connection,
    provider: &StoredAiProvider,
    requested_model: Option<&str>,
) -> Result<StoredAiModel, String> {
    if let Some(model_name) = requested_model {
        if !model_name.trim().is_empty() {
            return Ok(StoredAiModel {
                name: model_name.trim().to_string(),
                default_temperature: 0.7,
                max_output_tokens: 1024,
            });
        }
    }

    if !provider.text_model.trim().is_empty() {
        return Ok(StoredAiModel {
            name: provider.text_model.trim().to_string(),
            default_temperature: 0.7,
            max_output_tokens: 1024,
        });
    }

    let model = connection
        .query_row(
            "SELECT name, default_temperature, max_output_tokens
             FROM ai_provider_models
             WHERE provider_id = ?1
               AND is_enabled = 1
               AND model_kind IN ('text', 'vision')
             ORDER BY is_default DESC, updated_at DESC
             LIMIT 1",
            params![provider.id],
            |row| {
                Ok(StoredAiModel {
                    name: row.get(0)?,
                    default_temperature: row.get(1)?,
                    max_output_tokens: row.get(2)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("读取 AI 文本模型失败：{error}"))?;

    model.ok_or_else(|| "请先为该服务商配置可用的文本模型。".to_string())
}

fn normalized_max_output_tokens(model: &StoredAiModel) -> i64 {
    if model.max_output_tokens > 0 {
        return model.max_output_tokens;
    }

    1024
}

fn map_provider_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<StoredAiProvider> {
    Ok(StoredAiProvider {
        id: row.get(0)?,
        name: row.get(1)?,
        provider_type: row.get(2)?,
        preset: row.get(3)?,
        api_base: row.get(4)?,
        api_key: row.get(5)?,
        text_model: row.get(6)?,
    })
}

fn build_openai_chat_endpoint(provider: &StoredAiProvider) -> String {
    let api_base = provider.api_base.trim_end_matches('/');

    if api_base.ends_with("/chat/completions") {
        return api_base.to_string();
    }

    format!("{api_base}/chat/completions")
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

fn http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|error| format!("初始化 AI HTTP 客户端失败：{error}"))
}
