use std::path::PathBuf;

use tauri::AppHandle;
use tauri::Manager;
use tracing::info;

use crate::logging::{redact, should_redact_prompts};

use super::catalog::find_model_profile;
use super::generation_limits::build_generation_limits;
use super::hardware_cache::resolve_hardware_profile;
use super::resolution::{apply_size_to_limits, resolve_effective_img2img_max_side};
use super::runtime::LocalInferenceRuntime;
use super::sd_cli_capabilities::get_sd_cli_capabilities;
use super::settings::load_local_inference_settings;
use super::types::{GenerateImageRequest, LocalGenerationLimits};
use crate::character::generation::provider::StoredImageModel;
use crate::storage::database::{ensure_app_settings_schema, open_app_database};

pub fn is_local_image_preset(preset: &str) -> bool {
    matches!(
        preset.trim(),
        "local" | "local-diffusion" | "local-inference" | "jmtools-local"
    )
}

pub(crate) fn request_local_character_image_bytes(
    app: &AppHandle,
    model: &StoredImageModel,
    prompt: &str,
    size_override: Option<(u32, u32)>,
    seed: Option<u64>,
    reference_png: Option<&[u8]>,
    reference_strength: Option<f64>,
) -> Result<Vec<u8>, String> {
    let connection = open_app_database(app)?;
    ensure_app_settings_schema(&connection)?;
    let settings = load_local_inference_settings(&connection)?;
    let models_dir = local_models_directory(app)?;

    let hardware = resolve_hardware_profile(&connection, false)?;
    let profile_override = model.name.trim();
    let profile_override = if profile_override.is_empty() {
        None
    } else {
        Some(profile_override)
    };
    let limits = build_generation_limits(
        &hardware.hardware,
        &settings,
        profile_override,
    )?;

    let (requested_width, requested_height) = resolve_generation_size(model, size_override, &settings);
    let (width, height, _) = if reference_png.is_some() {
        let profile = resolve_profile_for_request(profile_override, &settings)?;
        let img2img_max = resolve_effective_img2img_max_side(
            &hardware.hardware,
            &profile,
            &settings,
            limits.max_side,
        );
        let img2img_limits = LocalGenerationLimits {
            max_side: img2img_max,
            recommended_width: limits.recommended_width.min(img2img_max),
            recommended_height: limits.recommended_height.min(img2img_max),
            capped_from: None,
            warnings: limits.warnings.clone(),
        };
        apply_size_to_limits(requested_width, requested_height, &img2img_limits)
    } else {
        apply_size_to_limits(requested_width, requested_height, &limits)
    };

    let reference_path = if let Some(bytes) = reference_png {
        let capabilities = get_sd_cli_capabilities(app);
        if !capabilities.img2img_supported {
            return Err("当前 sd-cpp Runtime 不支持参考图 img2img，请升级 Runtime 或改用纯文生图。".to_string());
        }
        Some(write_temp_reference_png(&models_dir, bytes)?)
    } else {
        None
    };

    let strength = reference_strength
        .map(|value| value as f32)
        .or(if reference_png.is_some() {
            Some(settings.default_img2img_strength)
        } else {
            None
        });

    let request = GenerateImageRequest {
        prompt: prompt.to_string(),
        negative_prompt: Some(
            "低清晰度、低质量、肢体错乱、文字、水印、复杂背景、模糊、变形".to_string(),
        ),
        width,
        height,
        seed: seed.unwrap_or_else(random_seed),
        steps: settings.generation_steps.max(1),
        cfg_scale: settings.generation_cfg_scale.max(0.1),
        lora_ids: settings.enabled_lora_ids.clone(),
        lora_strengths: Vec::new(),
        reference_image_path: reference_path.clone(),
        reference_strength: strength,
    };

    info!(
        target = "jmtools::local_inference",
        profile_id = profile_override.unwrap_or(settings.active_profile_id.as_str()),
        width,
        height,
        has_reference = reference_png.is_some(),
        prompt = %redact::redact_prompt(prompt, should_redact_prompts(app)),
        "local character image generation requested"
    );

    let mut runtime = LocalInferenceRuntime::new(app, &settings);
    let result = runtime.generate_png_bytes(&models_dir, &settings, request, profile_override);

    if let Some(path) = reference_path {
        let _ = std::fs::remove_file(path);
    }

    if let Err(error) = &result {
        tracing::error!(
            target = "jmtools::local_inference",
            error = %error,
            "local character image generation failed"
        );
    }

    result
}

fn resolve_profile_for_request(
    profile_override: Option<&str>,
    settings: &super::types::LocalInferenceSettings,
) -> Result<super::types::ModelProfile, String> {
    if let Some(id) = profile_override.filter(|value| !value.is_empty()) {
        return find_model_profile(id);
    }
    find_model_profile(settings.active_profile_id.as_str())
}

fn write_temp_reference_png(models_dir: &PathBuf, bytes: &[u8]) -> Result<PathBuf, String> {
    let temp_dir = models_dir.join(".tmp");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|error| format!("创建临时目录失败：{error}"))?;
    let path = temp_dir.join(format!(
        "ref_{}.png",
        crate::storage::database::current_timestamp()
    ));
    std::fs::write(&path, bytes).map_err(|error| format!("写入参考图临时文件失败：{error}"))?;
    Ok(path)
}

pub fn local_models_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("获取应用数据目录失败：{error}"))?;

    Ok(base.join("models"))
}

fn resolve_generation_size(
    model: &StoredImageModel,
    size_override: Option<(u32, u32)>,
    settings: &super::types::LocalInferenceSettings,
) -> (u32, u32) {
    if let Some(size) = size_override {
        return size;
    }

    if settings.generation_width > 0 && settings.generation_height > 0 {
        return (settings.generation_width, settings.generation_height);
    }

    if model.default_width > 0 && model.default_height > 0 {
        return (model.default_width, model.default_height);
    }

    find_model_profile(model.name.trim())
        .map(|profile| (profile.default_width, profile.default_height))
        .unwrap_or((512, 512))
}

fn random_seed() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};

    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos() as u64)
        .unwrap_or(42)
}
