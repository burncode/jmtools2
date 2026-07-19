use std::path::PathBuf;
use std::sync::Mutex;

use tauri::AppHandle;

use super::activity::{
    clear_local_inference_activity, set_local_inference_activity, LocalInferencePhase,
};
use super::catalog::{
    find_model_profile, load_lora_catalog, load_model_catalog, resolve_models_directory,
};
#[cfg(feature = "local-diffusion")]
use super::diffusion_rs::DiffusionRsBackend;
use super::engine::LocalInferenceEngine;
use super::lora::{
    append_lora_prompt_tags, inject_lora_triggers, lora_installed, resolve_loras_for_request,
    ResolvedLora,
};
use super::lora_assets::ensure_lora_assets;
use super::model_assets;
use super::ollama::OllamaImageBackend;
use super::recommender::{rank_profiles_for_hardware, recommend_profile};
use super::runtime_pack::diffusion_runtime_available;
use super::sd_cpp_cli::SdCppCliBackend;
use super::settings::{
    load_local_inference_settings, resolve_hf_endpoint, save_local_inference_settings,
};
use super::types::{
    GenerateImageRequest, HardwareProfile, LocalInferenceSettings, LocalLoraStatus,
    LocalModelProfileStatus,
};

static ENGINE_MUTEX: Mutex<()> = Mutex::new(());

pub struct LocalInferenceRuntime {
    app: AppHandle,
    sd_cpp_cli: SdCppCliBackend,
    #[cfg(feature = "local-diffusion")]
    diffusion_embedded: DiffusionRsBackend,
    ollama: OllamaImageBackend,
}

impl LocalInferenceRuntime {
    pub fn new(app: &AppHandle, settings: &LocalInferenceSettings) -> Self {
        Self {
            app: app.clone(),
            sd_cpp_cli: SdCppCliBackend::new(),
            #[cfg(feature = "local-diffusion")]
            diffusion_embedded: DiffusionRsBackend::new(),
            ollama: OllamaImageBackend::new(settings.ollama_api_base.clone()),
        }
    }

    pub fn generate_png_bytes(
        &mut self,
        app_models_dir: &PathBuf,
        settings: &LocalInferenceSettings,
        request: GenerateImageRequest,
        profile_id_override: Option<&str>,
    ) -> Result<Vec<u8>, String> {
        let _lock = ENGINE_MUTEX
            .lock()
            .map_err(|_| "本地推理引擎正忙，请稍后重试。".to_string())?;

        let profile_id = profile_id_override
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(settings.active_profile_id.as_str());
        let profile = find_model_profile(profile_id)?;
        let profile = resolve_runtime_profile(&self.app, &profile)?;
        let models_root = resolve_models_directory(app_models_dir, settings.models_directory.as_str());
        std::fs::create_dir_all(&models_root)
            .map_err(|error| format!("创建模型目录失败：{error}"))?;

        if profile_id_override.is_some() {
            validate_profile_ready_for_pipeline(&self.app, &profile, &models_root, settings)?;
        }

        let loras = resolve_loras_for_request(
            &models_root,
            profile.id.as_str(),
            profile.preset.as_str(),
            &settings.enabled_lora_ids,
            settings.default_lora_strength,
            &request,
        )?;

        let hf_endpoint = resolve_hf_endpoint(settings.huggingface_endpoint.as_str());
        for lora in &loras {
            ensure_lora_assets(&models_root, lora.attachment.id.as_str(), hf_endpoint.as_str())?;
        }

        let mut enriched_request = request;
        enriched_request.prompt =
            inject_lora_triggers(&enriched_request.prompt, &loras);
        enriched_request.prompt =
            append_lora_prompt_tags(&enriched_request.prompt, &loras);

        let temp_dir = models_root.join(".tmp");
        std::fs::create_dir_all(&temp_dir)
            .map_err(|error| format!("创建临时目录失败：{error}"))?;
        let output_path = temp_dir.join(format!("gen_{}.png", enriched_request.seed));

        let assets_installed = is_sd_cpp_backend(&profile)
            && model_assets::profile_assets_installed(&models_root, profile.id.as_str());
        if is_sd_cpp_backend(&profile) && !assets_installed {
            set_local_inference_activity(
                LocalInferencePhase::Downloading,
                "正在下载模型（首次生图需从 HuggingFace 拉取权重，可能需要数分钟）…",
            );
        } else {
            set_local_inference_activity(LocalInferencePhase::Generating, "正在本地生图…");
        }

        struct ClearActivityGuard;
        impl Drop for ClearActivityGuard {
            fn drop(&mut self) {
                clear_local_inference_activity();
            }
        }
        let _activity_guard = ClearActivityGuard;

        match profile.backend.as_str() {
            "sd-cpp" | "diffusion-rs" => self.generate_sd_cpp_png(
                &profile,
                &models_root,
                &enriched_request,
                &loras,
                &output_path,
            )?,
            "ollama" => self.ollama.generate_png(
                &profile,
                &models_root,
                &enriched_request,
                &loras,
                &output_path,
                &self.app,
            )?,
            other => {
                return Err(format!(
                    "后端「{other}」尚未集成。请在设置中切换到 Klein 或 Ollama 档位。"
                ));
            }
        }

        let bytes = std::fs::read(&output_path)
            .map_err(|error| format!("读取本地生成图片失败：{error}"))?;
        let _ = std::fs::remove_file(&output_path);
        Ok(bytes)
    }

    fn generate_sd_cpp_png(
        &mut self,
        profile: &super::types::ModelProfile,
        models_root: &PathBuf,
        request: &GenerateImageRequest,
        resolved_loras: &[ResolvedLora],
        output_path: &PathBuf,
    ) -> Result<(), String> {
        if diffusion_runtime_available(&self.app) {
            return self.sd_cpp_cli.generate_png(
                profile,
                models_root,
                request,
                resolved_loras,
                output_path,
                &self.app,
            );
        }

        #[cfg(feature = "local-diffusion")]
        {
            return self.diffusion_embedded.generate_png(
                profile,
                models_root,
                request,
                resolved_loras,
                output_path,
                &self.app,
            );
        }

        #[cfg(not(feature = "local-diffusion"))]
        {
            let _ = (profile, models_root, request, resolved_loras, output_path);
            Err(
                "未安装生图 Runtime。请前往 设置 → 本地生图 → 生图 Runtime 下载 stable-diffusion.cpp 扩展包。"
                    .to_string(),
            )
        }
    }
}

fn is_sd_cpp_backend(profile: &super::types::ModelProfile) -> bool {
    profile.backend == "sd-cpp" || profile.backend == "diffusion-rs"
}

pub fn build_profile_statuses(
    app: &AppHandle,
    app_models_dir: &PathBuf,
    settings: &LocalInferenceSettings,
    hardware: &HardwareProfile,
    recommended_profile_id: Option<&str>,
) -> Result<Vec<LocalModelProfileStatus>, String> {
    let recommended_id = if let Some(id) = recommended_profile_id.filter(|value| !value.is_empty()) {
        id.to_string()
    } else {
        recommend_profile(hardware, None)?.id
    };
    let models_root = resolve_models_directory(app_models_dir, settings.models_directory.as_str());
    let ranked = rank_profiles_for_hardware(hardware)?;

    Ok(ranked
        .into_iter()
        .map(|profile| {
            let installed = profile_installed(&profile, &models_root);
            let ready = profile_ready(app, &profile, &models_root, settings);
            let asset_files = if is_sd_cpp_backend(&profile) {
                model_assets::profile_asset_file_statuses(&models_root, profile.id.as_str())
                    .unwrap_or_default()
            } else {
                Vec::new()
            };
            LocalModelProfileStatus {
                recommended: profile.id == recommended_id,
                installed,
                ready,
                detail: profile_status_detail(app, &profile, installed, ready),
                profile,
                asset_files,
            }
        })
        .collect())
}

pub fn build_lora_statuses(
    app_models_dir: &PathBuf,
    settings: &LocalInferenceSettings,
) -> Result<Vec<LocalLoraStatus>, String> {
    let models_root = resolve_models_directory(app_models_dir, settings.models_directory.as_str());
    Ok(load_lora_catalog()?
        .into_iter()
        .map(|lora| {
            let installed = lora_installed(&models_root, &lora);
            LocalLoraStatus {
                detail: if installed {
                    "LoRA 文件已就绪。".to_string()
                } else {
                    "尚未下载；请使用下方「在线下载」或「选择本地文件」。".to_string()
                },
                installed,
                lora,
            }
        })
        .collect())
}

fn profile_installed(profile: &super::types::ModelProfile, models_root: &PathBuf) -> bool {
    match profile.backend.as_str() {
        "sd-cpp" | "diffusion-rs" => {
            model_assets::profile_assets_installed(models_root, profile.id.as_str())
        }
        "ollama" => super::ollama::ollama_image_available("http://127.0.0.1:11434"),
        _ => false,
    }
}

fn profile_ready(
    app: &AppHandle,
    profile: &super::types::ModelProfile,
    models_root: &PathBuf,
    settings: &LocalInferenceSettings,
) -> bool {
    match profile.backend.as_str() {
        "sd-cpp" | "diffusion-rs" => {
            diffusion_runtime_available(app)
                && model_assets::profile_assets_installed(models_root, profile.id.as_str())
        }
        "ollama" => super::ollama::ollama_image_available(settings.ollama_api_base.as_str()),
        _ => false,
    }
}

fn profile_status_detail(
    app: &AppHandle,
    profile: &super::types::ModelProfile,
    installed: bool,
    ready: bool,
) -> String {
    if ready {
        return format!("{} · 可用", profile.label);
    }

    if is_sd_cpp_backend(profile) && !diffusion_runtime_available(app) {
        return "请先在设置页下载 stable-diffusion.cpp 生图 Runtime 扩展包。".to_string();
    }

    if is_sd_cpp_backend(profile) && !installed {
        return format!(
            "{} · 约 {}MB · 首次生图将自动下载",
            profile.description, profile.estimated_size_mb
        );
    }

    if !installed {
        return format!(
            "{} · 约 {}MB · 首次生图将自动下载",
            profile.description, profile.estimated_size_mb
        );
    }

    format!("{} · 已安装，等待就绪检查", profile.description)
}

pub fn persist_local_settings(
    connection: &rusqlite::Connection,
    settings: &LocalInferenceSettings,
) -> Result<(), String> {
    save_local_inference_settings(connection, settings)
}

pub fn read_local_settings(connection: &rusqlite::Connection) -> Result<LocalInferenceSettings, String> {
    load_local_inference_settings(connection)
}

pub fn list_catalog_profiles() -> Result<Vec<super::types::ModelProfile>, String> {
    load_model_catalog()
}

fn resolve_runtime_profile(
    app: &AppHandle,
    profile: &super::types::ModelProfile,
) -> Result<super::types::ModelProfile, String> {
    if is_sd_cpp_backend(profile) && !diffusion_runtime_available(app) {
        #[cfg(not(feature = "local-diffusion"))]
        {
            return Err(
                "未安装生图 Runtime。请前往 设置 → 本地生图 → 运行环境，下载 stable-diffusion.cpp 扩展包。"
                    .to_string(),
            );
        }

        #[cfg(feature = "local-diffusion")]
        {
            if !super::diffusion_rs::diffusion_rs_available() {
                return Err(
                    "未安装生图 Runtime。请前往 设置 → 本地生图 → 运行环境，下载 stable-diffusion.cpp 扩展包。"
                        .to_string(),
                );
            }
        }
    }

    Ok(profile.clone())
}

fn validate_profile_ready_for_pipeline(
    app: &AppHandle,
    profile: &super::types::ModelProfile,
    models_root: &PathBuf,
    settings: &LocalInferenceSettings,
) -> Result<(), String> {
    if profile_ready(app, profile, models_root, settings) {
        return Ok(());
    }

    if is_sd_cpp_backend(profile) && !diffusion_runtime_available(app) {
        return Err(
            "未安装生图 Runtime。请前往 设置 → 本地生图 → 运行环境，下载 stable-diffusion.cpp 扩展包。"
                .to_string(),
        );
    }

    if is_sd_cpp_backend(profile)
        && !model_assets::profile_assets_installed(models_root, profile.id.as_str())
    {
        return Err(format!(
            "模型档位「{}」尚未就绪。请前往 设置 → 本地生图 → 模型管理，下载或导入该档位的 DiT / VAE / LLM 三文件。",
            profile.label
        ));
    }

    Err(format!(
        "模型档位「{}」尚未就绪。请先在 设置 → 本地生图 中完成 Runtime 与模型配置。",
        profile.label
    ))
}
