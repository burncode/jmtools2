use rusqlite::Connection;
use tauri::AppHandle;
use tracing::debug;

use super::catalog::find_model_profile;
use super::hardware_cache::resolve_hardware_profile;
use super::model_assets::{manifest_cli_args_for_profile, ProfileCliArgs};
use super::resolution::{
    backend_label, resolve_effective_img2img_max_side, resolve_effective_runtime_options,
    resolve_generation_limits,
};
use super::sd_cli_capabilities::{get_sd_cli_capabilities, SdCliCapabilities};
use super::settings::load_local_inference_settings;
use super::types::{
    EffectiveRuntimeOptions, HardwareProfile, LocalGenerationLimits,
    LocalGenerationLimitsResult, LocalInferenceSettings,
};

pub fn sd_cli_supports_vae_on_cpu(app: &AppHandle) -> bool {
    let capabilities = get_sd_cli_capabilities(app);
    capabilities
        .supported_flags
        .iter()
        .any(|flag| flag == "vaeOnCpu")
}

pub fn resolve_profile_for_settings(
    settings: &LocalInferenceSettings,
    profile_id_override: Option<&str>,
) -> Result<super::types::ModelProfile, String> {
    let profile_id = profile_id_override
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(settings.active_profile_id.as_str());
    find_model_profile(profile_id)
}

pub fn build_generation_limits(
    hardware: &HardwareProfile,
    settings: &LocalInferenceSettings,
    profile_id_override: Option<&str>,
) -> Result<LocalGenerationLimits, String> {
    let profile = resolve_profile_for_settings(settings, profile_id_override)?;
    let lora_count = settings.enabled_lora_ids.len();
    Ok(resolve_generation_limits(
        hardware,
        &profile,
        settings,
        lora_count,
    ))
}

pub fn build_generation_limits_result(
    app: &AppHandle,
    connection: &Connection,
    profile_id_override: Option<&str>,
) -> Result<LocalGenerationLimitsResult, String> {
    let hardware = resolve_hardware_profile(connection, false)?;
    let settings = load_local_inference_settings(connection)?;
    let profile = resolve_profile_for_settings(&settings, profile_id_override)?;
    let limits = resolve_generation_limits(
        &hardware.hardware,
        &profile,
        &settings,
        settings.enabled_lora_ids.len(),
    );

    let manifest_cli = if profile.backend == "sd-cpp" {
        manifest_cli_args_for_profile(profile.id.as_str()).unwrap_or_default()
    } else {
        ProfileCliArgs::default()
    };
    let capabilities = if profile.backend == "sd-cpp" {
        get_sd_cli_capabilities(app)
    } else {
        SdCliCapabilities {
            available: false,
            runtime_version: None,
            supported_flags: Vec::new(),
            img2img_supported: false,
            img2img_init_flag: None,
            img2img_mode_flag: None,
        }
    };
    let effective_runtime = resolve_effective_runtime_options(
        &manifest_cli,
        &settings,
        &capabilities,
    );
    let img2img_max_side = resolve_effective_img2img_max_side(
        &hardware.hardware,
        &profile,
        &settings,
        limits.max_side,
    );

    let result = LocalGenerationLimitsResult {
        backend_label: backend_label(&hardware.hardware.backend),
        effective_runtime,
        limits,
        img2img_supported: capabilities.img2img_supported && profile.backend == "sd-cpp",
        img2img_max_side,
    };

    debug!(
        target = "jmtools::local_inference",
        profile_id = %profile.id,
        max_side = result.limits.max_side,
        recommended_width = result.limits.recommended_width,
        recommended_height = result.limits.recommended_height,
        img2img_max_side = result.img2img_max_side,
        lora_count = settings.enabled_lora_ids.len(),
        "generation limits resolved"
    );

    Ok(result)
}

pub fn effective_runtime_for_profile(
    app: &AppHandle,
    settings: &LocalInferenceSettings,
    profile_id: &str,
) -> Result<EffectiveRuntimeOptions, String> {
    let profile = resolve_profile_for_settings(settings, Some(profile_id))?;
    let manifest_cli = if profile.backend == "sd-cpp" {
        manifest_cli_args_for_profile(profile_id).unwrap_or_default()
    } else {
        ProfileCliArgs::default()
    };
    let capabilities = if profile.backend == "sd-cpp" {
        get_sd_cli_capabilities(app)
    } else {
        SdCliCapabilities {
            available: false,
            runtime_version: None,
            supported_flags: Vec::new(),
            img2img_supported: false,
            img2img_init_flag: None,
            img2img_mode_flag: None,
        }
    };
    Ok(resolve_effective_runtime_options(
        &manifest_cli,
        settings,
        &capabilities,
    ))
}
