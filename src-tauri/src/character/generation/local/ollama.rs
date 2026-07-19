use std::path::PathBuf;

use tauri::AppHandle;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::blocking::Client;
use serde_json::json;

use super::engine::LocalInferenceEngine;
use super::types::{GenerateImageRequest, ModelProfile};

pub struct OllamaImageBackend {
    api_base: String,
    ready_profile_id: Option<String>,
}

impl OllamaImageBackend {
    pub fn new(api_base: String) -> Self {
        Self {
            api_base,
            ready_profile_id: None,
        }
    }
}

impl LocalInferenceEngine for OllamaImageBackend {
    fn id(&self) -> &'static str {
        "ollama"
    }

    fn ensure_ready(
        &mut self,
        profile: &ModelProfile,
        _models_root: &PathBuf,
        _app: &AppHandle,
    ) -> Result<(), String> {
        let model = ollama_model_name(profile);
        let client = http_client()?;
        let response = client
            .get(format!("{}/api/tags", normalized_base(&self.api_base)))
            .send()
            .map_err(|error| format!("无法连接 Ollama：{error}"))?;

        if !response.status().is_success() {
            return Err(format!(
                "Ollama 服务不可用（HTTP {}）。请确认 ollama 已启动。",
                response.status().as_u16()
            ));
        }

        let body: serde_json::Value = response
            .json()
            .map_err(|error| format!("解析 Ollama 模型列表失败：{error}"))?;

        let installed = body
            .pointer("/models")
            .and_then(|value| value.as_array())
            .map(|models| {
                models.iter().any(|entry| {
                    entry
                        .pointer("/name")
                        .and_then(|name| name.as_str())
                        .map(|name| name.starts_with(&model) || model.starts_with(name))
                        .unwrap_or(false)
                })
            })
            .unwrap_or(false);

        if !installed {
            return Err(format!(
                "Ollama 未安装模型「{model}」。请运行：ollama pull {model}"
            ));
        }

        self.ready_profile_id = Some(profile.id.clone());
        Ok(())
    }

    fn generate_png(
        &mut self,
        profile: &ModelProfile,
        models_root: &PathBuf,
        request: &GenerateImageRequest,
        _resolved_loras: &[super::lora::ResolvedLora],
        output_path: &PathBuf,
        app: &AppHandle,
    ) -> Result<(), String> {
        let _ = models_root;
        self.ensure_ready(profile, models_root, app)?;

        let model = ollama_model_name(profile);
        let payload = json!({
            "model": model,
            "prompt": request.prompt,
            "size": format!("{}x{}", request.width, request.height),
            "seed": request.seed,
            "steps": request.steps,
        });

        let client = http_client()?;
        let response = client
            .post(format!("{}/v1/images/generations", normalized_base(&self.api_base)))
            .json(&payload)
            .send()
            .map_err(|error| format!("Ollama 图像生成请求失败：{error}"))?;

        let status = response.status();
        let body: serde_json::Value = response
            .json()
            .map_err(|error| format!("解析 Ollama 图像响应失败：{error}"))?;

        if !status.is_success() {
            return Err(format!(
                "Ollama 图像生成失败：HTTP {}，{}",
                status.as_u16(),
                summarize_body(&body)
            ));
        }

        if let Some(url) = body.pointer("/data/0/url").and_then(|value| value.as_str()) {
            let image_bytes = client
                .get(url)
                .send()
                .map_err(|error| format!("下载 Ollama 图片失败：{error}"))?
                .bytes()
                .map_err(|error| format!("读取 Ollama 图片失败：{error}"))?;
            std::fs::write(output_path, image_bytes)
                .map_err(|error| format!("保存 Ollama 图片失败：{error}"))?;
            return Ok(());
        }

        if let Some(encoded) = body.pointer("/data/0/b64_json").and_then(|value| value.as_str()) {
            let bytes = STANDARD
                .decode(encoded)
                .map_err(|error| format!("解码 Ollama base64 图片失败：{error}"))?;
            std::fs::write(output_path, bytes)
                .map_err(|error| format!("保存 Ollama 图片失败：{error}"))?;
            return Ok(());
        }

        Err(format!(
            "Ollama 响应缺少图片数据：{}",
            summarize_body(&body)
        ))
    }
}

fn ollama_model_name(profile: &ModelProfile) -> String {
    if profile.preset.trim().is_empty() {
        "flux2-klein".to_string()
    } else {
        profile.preset.clone()
    }
}

fn normalized_base(api_base: &str) -> String {
    api_base.trim_end_matches('/').to_string()
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|error| format!("初始化 Ollama HTTP 客户端失败：{error}"))
}

fn summarize_body(body: &serde_json::Value) -> String {
    body.pointer("/error/message")
        .or_else(|| body.pointer("/message"))
        .and_then(|value| value.as_str())
        .unwrap_or("未知错误")
        .chars()
        .take(160)
        .collect()
}

pub fn ollama_image_available(api_base: &str) -> bool {
    http_client()
        .ok()
        .and_then(|client| {
            client
                .get(format!("{}/api/tags", normalized_base(api_base)))
                .send()
                .ok()
        })
        .map(|response| response.status().is_success())
        .unwrap_or(false)
}
