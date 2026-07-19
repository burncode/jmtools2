use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::AppHandle;

use crate::character::generation::local::{
    begin_lora_download, begin_model_download, build_lora_statuses, build_profile_statuses, clear_local_inference_activity,
    clear_task, delete_partial_profile_assets, download_runtime, ensure_lora_assets, ensure_profile_assets,
    get_download_task, get_local_inference_activity, import_lora_from_file, import_model_bundle_from_directory,
    import_runtime_from_zip, list_backend_evaluations, list_catalog_profiles, list_compatible_loras,
    list_runtime_statuses, load_local_inference_settings, local_models_directory, persist_local_settings,
    read_local_settings, remove_runtime, request_cancel, request_pause, resolve_hardware_profile,
    resolve_hf_endpoint, resume_lora_download, resume_model_download, runtime_directory, save_local_inference_settings,
    set_active_runtime, BackendEvaluationStatus, GenerateImageRequest, HardwareProfile,
    InstalledRuntimeRecord, LocalDiffusionRuntimeStatus, LocalDownloadTask, LocalGenerationLimitsResult,
    LocalInferenceActivity, LocalInferenceRuntime, LocalInferenceSettings, LocalLoraStatus, LocalModelProfileStatus,
    LoraAttachment, ModelProfile, ResolvedHardwareProfile,
};
use crate::character::generation::local::catalog::resolve_models_directory;
use crate::character::generation::local::generation_limits::build_generation_limits_result;
use crate::character::generation::local::resolution::resolve_test_generation_size;
use crate::character::generation::local::sd_cli_capabilities::{
    get_sd_cli_capabilities, invalidate_sd_cli_capabilities_cache, SdCliCapabilities,
};
use crate::storage::database::{ensure_app_settings_schema, open_app_database};
use crate::logging::CommandSpanGuard;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHardwareProbeResult {
    pub hardware: HardwareProfile,
    pub recommended_profile_id: String,
    pub models_directory: String,
    pub disk_usage_mb: u64,
    pub cached: bool,
    pub probed_at: i64,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeLocalHardwareInput {
    #[serde(default)]
    pub force: bool,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLocalInferenceSettingsInput {
    pub settings: LocalInferenceSettings,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestLocalImageGenerationInput {
    pub prompt: String,
    #[serde(default = "default_test_width")]
    pub width: u32,
    #[serde(default = "default_test_height")]
    pub height: u32,
    #[serde(default)]
    pub profile_id: String,
    #[serde(default)]
    pub reference_image_path: String,
    #[serde(default)]
    pub reference_strength: f32,
}

fn default_test_width() -> u32 {
    0
}

fn default_test_height() -> u32 {
    0
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestLocalImageGenerationResult {
    pub absolute_path: String,
    pub width: u32,
    pub height: u32,
    pub message: String,
}

fn build_hardware_probe_result(
    app: &AppHandle,
    resolved: ResolvedHardwareProfile,
) -> Result<LocalHardwareProbeResult, String> {
    let models_dir = local_models_directory(app)?;
    let disk_usage_mb =
        crate::character::generation::local::catalog::directory_size_mb(&models_dir);

    Ok(LocalHardwareProbeResult {
        hardware: resolved.hardware,
        recommended_profile_id: resolved.recommended_profile_id,
        models_directory: models_dir.to_string_lossy().to_string(),
        disk_usage_mb,
        cached: resolved.from_cache,
        probed_at: resolved.probed_at,
    })
}

#[tauri::command]
pub fn probe_local_hardware(
    app: AppHandle,
    input: Option<ProbeLocalHardwareInput>,
) -> Result<LocalHardwareProbeResult, String> {
    let connection = open_app_database(&app)?;
    ensure_app_settings_schema(&connection)?;
    let force = input.map(|value| value.force).unwrap_or(false);
    let resolved = resolve_hardware_profile(&connection, force)?;
    build_hardware_probe_result(&app, resolved)
}

#[tauri::command]
pub fn list_local_model_profiles(app: AppHandle) -> Result<Vec<LocalModelProfileStatus>, String> {
    let connection = open_app_database(&app)?;
    ensure_app_settings_schema(&connection)?;
    let settings = load_local_inference_settings(&connection)?;
    let resolved = resolve_hardware_profile(&connection, false)?;
    let models_dir = local_models_directory(&app)?;
    build_profile_statuses(
        &app,
        &models_dir,
        &settings,
        &resolved.hardware,
        Some(resolved.recommended_profile_id.as_str()),
    )
}

#[tauri::command]
pub fn list_local_loras(app: AppHandle) -> Result<Vec<LocalLoraStatus>, String> {
    let connection = open_app_database(&app)?;
    ensure_app_settings_schema(&connection)?;
    let settings = load_local_inference_settings(&connection)?;
    let models_dir = local_models_directory(&app)?;
    build_lora_statuses(&models_dir, &settings)
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetLocalGenerationLimitsInput {
    #[serde(default)]
    pub profile_id: String,
}

#[tauri::command]
pub fn get_local_generation_limits(
    app: AppHandle,
    input: GetLocalGenerationLimitsInput,
) -> Result<LocalGenerationLimitsResult, String> {
    let connection = open_app_database(&app)?;
    ensure_app_settings_schema(&connection)?;
    let profile_override = input.profile_id.trim();
    let profile_override = if profile_override.is_empty() {
        None
    } else {
        Some(profile_override)
    };
    build_generation_limits_result(&app, &connection, profile_override)
}

#[tauri::command]
pub fn get_sd_cli_capabilities_command(app: AppHandle) -> Result<SdCliCapabilities, String> {
    Ok(get_sd_cli_capabilities(&app))
}

#[tauri::command]
pub fn get_local_inference_settings(app: AppHandle) -> Result<LocalInferenceSettings, String> {
    let connection = open_app_database(&app)?;
    ensure_app_settings_schema(&connection)?;
    read_local_settings(&connection)
}

#[tauri::command]
pub fn save_local_inference_settings_command(
    app: AppHandle,
    input: SaveLocalInferenceSettingsInput,
) -> Result<LocalInferenceSettings, String> {
    let connection = open_app_database(&app)?;
    ensure_app_settings_schema(&connection)?;
    persist_local_settings(&connection, &input.settings)?;
    read_local_settings(&connection)
}

#[tauri::command]
pub fn list_local_model_catalog() -> Result<Vec<ModelProfile>, String> {
    list_catalog_profiles()
}

#[tauri::command]
pub fn list_local_backend_evaluations() -> Result<Vec<BackendEvaluationStatus>, String> {
    Ok(list_backend_evaluations())
}

#[tauri::command]
pub fn get_local_inference_activity_command() -> LocalInferenceActivity {
    get_local_inference_activity()
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadLocalDiffusionRuntimeInput {
    pub runtime_id: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDiffusionRuntimeIdInput {
    pub runtime_id: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportLocalDiffusionRuntimeInput {
    pub runtime_id: String,
    pub zip_path: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportLocalModelBundleInput {
    pub profile_id: String,
    pub source_dir: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadLocalModelProfileInput {
    pub profile_id: String,
}

#[tauri::command]
pub async fn import_local_model_bundle_from_directory(
    app: AppHandle,
    input: ImportLocalModelBundleInput,
) -> Result<(), String> {
    let profile_id = input.profile_id;
    let source_dir = input.source_dir;
    tauri::async_runtime::spawn_blocking(move || {
        let (models_root, _) = resolve_models_root(&app)?;
        import_model_bundle_from_directory(
            &models_root,
            profile_id.as_str(),
            Path::new(source_dir.as_str()),
        )?;
        Ok(())
    })
    .await
    .map_err(|error| format!("导入任务异常终止：{error}"))?
}

#[tauri::command]
pub fn get_local_download_task_command() -> Option<LocalDownloadTask> {
    get_download_task()
}

#[tauri::command]
pub fn pause_local_model_download_command() -> Result<(), String> {
    request_pause()
}

#[tauri::command]
pub fn cancel_local_model_download_command() -> Result<(), String> {
    request_cancel()
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModelProfileIdInput {
    pub profile_id: String,
}

#[tauri::command]
pub async fn resume_local_model_download_command(
    app: AppHandle,
    input: LocalModelProfileIdInput,
) -> Result<(), String> {
    let profile_id = input.profile_id;
    resume_model_download(profile_id.as_str())?;
    tauri::async_runtime::spawn_blocking(move || run_model_profile_download(&app, profile_id.as_str()))
        .await
        .map_err(|error| format!("下载任务异常终止：{error}"))?
}

#[tauri::command]
pub async fn delete_local_model_download_command(
    app: AppHandle,
    input: LocalModelProfileIdInput,
) -> Result<(), String> {
    let profile_id = input.profile_id;
    tauri::async_runtime::spawn_blocking(move || {
        let _ = request_cancel();
        let (models_root, _) = resolve_models_root(&app)?;
        delete_partial_profile_assets(&models_root, profile_id.as_str())?;
        clear_task();
        clear_local_inference_activity();
        Ok(())
    })
    .await
    .map_err(|error| format!("删除任务异常终止：{error}"))?
}

fn run_model_profile_download(app: &AppHandle, profile_id: &str) -> Result<(), String> {
    let (models_root, hf_endpoint) = resolve_models_root(app)?;
    ensure_profile_assets(&models_root, profile_id, hf_endpoint.as_str())?;
    Ok(())
}

fn run_lora_download(app: &AppHandle, lora_id: &str) -> Result<String, String> {
    let (models_root, hf_endpoint) = resolve_models_root(app)?;
    let path = ensure_lora_assets(&models_root, lora_id, hf_endpoint.as_str())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn download_local_model_profile(
    app: AppHandle,
    input: DownloadLocalModelProfileInput,
) -> Result<(), String> {
    let profile_id = input.profile_id;
    begin_model_download(profile_id.as_str())?;
    tauri::async_runtime::spawn_blocking(move || run_model_profile_download(&app, profile_id.as_str()))
        .await
        .map_err(|error| format!("下载任务异常终止：{error}"))?
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalLoraIdInput {
    pub lora_id: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportLocalLoraInput {
    pub lora_id: String,
    pub source_path: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCompatibleLocalLorasInput {
    pub profile_id: String,
}

fn resolve_models_root(app: &AppHandle) -> Result<(std::path::PathBuf, String), String> {
    let connection = open_app_database(app)?;
    ensure_app_settings_schema(&connection)?;
    let settings = load_local_inference_settings(&connection)?;
    let hf_endpoint = resolve_hf_endpoint(settings.huggingface_endpoint.as_str());
    let models_dir = local_models_directory(app)?;
    let models_root = resolve_models_directory(&models_dir, settings.models_directory.as_str());
    Ok((models_root, hf_endpoint))
}

#[tauri::command]
pub fn list_compatible_local_loras(
    input: ListCompatibleLocalLorasInput,
) -> Result<Vec<LoraAttachment>, String> {
    let profile = crate::character::generation::local::catalog::find_model_profile(input.profile_id.as_str())?;
    list_compatible_loras(profile.id.as_str(), profile.preset.as_str())
}

#[tauri::command]
pub async fn download_local_lora_command(
    app: AppHandle,
    input: LocalLoraIdInput,
) -> Result<String, String> {
    let lora_id = input.lora_id;
    begin_lora_download(lora_id.as_str())?;
    tauri::async_runtime::spawn_blocking(move || run_lora_download(&app, lora_id.as_str()))
        .await
        .map_err(|error| format!("LoRA 下载任务异常终止：{error}"))?
}

#[tauri::command]
pub async fn resume_local_lora_download_command(
    app: AppHandle,
    input: LocalLoraIdInput,
) -> Result<String, String> {
    let lora_id = input.lora_id;
    resume_lora_download(lora_id.as_str())?;
    tauri::async_runtime::spawn_blocking(move || run_lora_download(&app, lora_id.as_str()))
        .await
        .map_err(|error| format!("LoRA 下载任务异常终止：{error}"))?
}

#[tauri::command]
pub async fn import_local_lora_command(
    app: AppHandle,
    input: ImportLocalLoraInput,
) -> Result<String, String> {
    let lora_id = input.lora_id;
    let source_path = input.source_path;
    tauri::async_runtime::spawn_blocking(move || {
        let (models_root, _) = resolve_models_root(&app)?;
        let path = import_lora_from_file(&models_root, lora_id.as_str(), Path::new(source_path.as_str()))?;
        Ok(path.to_string_lossy().to_string())
    })
    .await
    .map_err(|error| format!("LoRA 导入任务异常终止：{error}"))?
}

#[tauri::command]
pub fn list_local_diffusion_runtimes(app: AppHandle) -> Result<Vec<LocalDiffusionRuntimeStatus>, String> {
    list_runtime_statuses(&app)
}

#[tauri::command]
pub async fn download_local_diffusion_runtime(
    app: AppHandle,
    input: DownloadLocalDiffusionRuntimeInput,
) -> Result<InstalledRuntimeRecord, String> {
    let runtime_id = input.runtime_id;
    tauri::async_runtime::spawn_blocking(move || download_runtime(&app, runtime_id.as_str()))
        .await
        .map_err(|error| format!("下载任务异常终止：{error}"))?
}

#[tauri::command]
pub async fn import_local_diffusion_runtime_from_zip(
    app: AppHandle,
    input: ImportLocalDiffusionRuntimeInput,
) -> Result<InstalledRuntimeRecord, String> {
    let runtime_id = input.runtime_id;
    let zip_path = input.zip_path;
    tauri::async_runtime::spawn_blocking(move || {
        import_runtime_from_zip(&app, runtime_id.as_str(), zip_path.as_str())
    })
    .await
    .map_err(|error| format!("导入任务异常终止：{error}"))?
}

#[tauri::command]
pub fn remove_local_diffusion_runtime(
    app: AppHandle,
    input: LocalDiffusionRuntimeIdInput,
) -> Result<(), String> {
    remove_runtime(&app, input.runtime_id.as_str())?;
    invalidate_sd_cli_capabilities_cache();
    Ok(())
}

#[tauri::command]
pub fn set_active_local_diffusion_runtime(
    app: AppHandle,
    input: LocalDiffusionRuntimeIdInput,
) -> Result<(), String> {
    set_active_runtime(&app, input.runtime_id.as_str())?;
    invalidate_sd_cli_capabilities_cache();
    Ok(())
}

#[tauri::command]
pub fn get_local_diffusion_runtime_directory(app: AppHandle) -> Result<String, String> {
    runtime_directory(&app)
}

#[tauri::command]
pub async fn test_local_image_generation(
    app: AppHandle,
    input: TestLocalImageGenerationInput,
) -> Result<TestLocalImageGenerationResult, String> {
    tauri::async_runtime::spawn_blocking(move || test_local_image_generation_blocking(app, input))
        .await
        .map_err(|error| format!("生图任务异常终止：{error}"))?
}

fn test_local_image_generation_blocking(
    app: AppHandle,
    input: TestLocalImageGenerationInput,
) -> Result<TestLocalImageGenerationResult, String> {
    let mut span = CommandSpanGuard::enter("test_local_image_generation", "jmtools::commands");
    let profile_id = input.profile_id.trim().to_string();
    if !profile_id.is_empty() {
        span = span.with_task_id(profile_id.clone());
    }

    tracing::info!(
        target = "jmtools::local_inference",
        profile_id = %profile_id,
        width = input.width,
        height = input.height,
        has_reference = !input.reference_image_path.trim().is_empty(),
        "local test image generation started"
    );

    let connection = open_app_database(&app)?;
    ensure_app_settings_schema(&connection)?;
    let mut settings = load_local_inference_settings(&connection)?;

    if !input.profile_id.trim().is_empty() {
        settings.active_profile_id = input.profile_id.trim().to_string();
        save_local_inference_settings(&connection, &settings)?;
    }

    let profile_override = if settings.active_profile_id.trim().is_empty() {
        None
    } else {
        Some(settings.active_profile_id.as_str())
    };
    let limits_result = build_generation_limits_result(&app, &connection, profile_override)?;
    let limits = limits_result.limits;
    let (width, height) = resolve_test_generation_size(&settings, &limits, input.width, input.height);

    let reference_path = input.reference_image_path.trim();
    let reference_image_path = if reference_path.is_empty() {
        None
    } else {
        let path = Path::new(reference_path);
        if !path.is_file() {
            return Err(format!("参考图路径无效：{reference_path}"));
        }
        Some(path.to_path_buf())
    };
    let reference_strength = if reference_image_path.is_some() && input.reference_strength > 0.0 {
        Some(input.reference_strength.clamp(0.05, 1.0))
    } else if reference_image_path.is_some() {
        Some(settings.default_img2img_strength)
    } else {
        None
    };

    let models_dir = local_models_directory(&app)?;
    let preview_dir = models_dir.join("previews");
    std::fs::create_dir_all(&preview_dir)
        .map_err(|error| format!("创建预览目录失败：{error}"))?;

    let request = GenerateImageRequest {
        prompt: input.prompt,
        negative_prompt: None,
        width,
        height,
        seed: 42,
        steps: settings.generation_steps.max(1),
        cfg_scale: settings.generation_cfg_scale.max(0.1),
        lora_ids: settings.enabled_lora_ids.clone(),
        lora_strengths: Vec::new(),
        reference_image_path,
        reference_strength,
    };

    let mut runtime = LocalInferenceRuntime::new(&app, &settings);
    let bytes = runtime.generate_png_bytes(&models_dir, &settings, request, None).map_err(|error| {
        span.mark_failed();
        error
    })?;

    let file_name = format!("test_{}.png", crate::storage::database::current_timestamp());
    let output_path = preview_dir.join(&file_name);
    std::fs::write(&output_path, bytes)
        .map_err(|error| format!("保存测试图片失败：{error}"))?;

    tracing::info!(
        target = "jmtools::local_inference",
        profile_id = %settings.active_profile_id,
        output_path = %output_path.display(),
        width,
        height,
        "local test image generation finished"
    );

    Ok(TestLocalImageGenerationResult {
        absolute_path: output_path.to_string_lossy().to_string(),
        width,
        height,
        message: format!("本地测试出图完成（{width}×{height}）。"),
    })
}
