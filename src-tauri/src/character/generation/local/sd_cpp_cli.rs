use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

use tauri::AppHandle;
use tracing::{error, info, warn};

use crate::logging::{redact, should_redact_prompts};
use crate::storage::database::{ensure_app_settings_schema, open_app_database};

use super::engine::LocalInferenceEngine;
use super::generation_limits::build_generation_limits;
use super::hardware_cache::resolve_hardware_profile;
use super::lora::{resolve_lora_model_dir, ResolvedLora};
use super::model_assets::{ensure_profile_assets, resolve_effective_cli_args, ResolvedProfileAssets};
use super::resolution::apply_size_to_limits;
use super::runtime_pack::resolve_cli_executable;
use super::sd_cli_capabilities::get_sd_cli_capabilities;
use super::settings::{load_local_inference_settings, resolve_hf_endpoint};
use super::types::{GenerateImageRequest, ModelProfile};

fn hf_endpoint_for_app(app: &AppHandle) -> Result<String, String> {
    let connection = open_app_database(app)?;
    ensure_app_settings_schema(&connection)?;
    let settings = load_local_inference_settings(&connection)?;
    Ok(resolve_hf_endpoint(settings.huggingface_endpoint.as_str()))
}

fn load_settings_for_app(app: &AppHandle) -> Result<super::types::LocalInferenceSettings, String> {
    let connection = open_app_database(app)?;
    ensure_app_settings_schema(&connection)?;
    load_local_inference_settings(&connection)
}

pub struct SdCppCliBackend {
    ready_profile_id: Option<String>,
}

impl SdCppCliBackend {
    pub fn new() -> Self {
        Self {
            ready_profile_id: None,
        }
    }
}

impl Default for SdCppCliBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl LocalInferenceEngine for SdCppCliBackend {
    fn id(&self) -> &'static str {
        "sd-cpp-cli"
    }

    fn ensure_ready(
        &mut self,
        profile: &ModelProfile,
        models_root: &PathBuf,
        app: &AppHandle,
    ) -> Result<(), String> {
        info!(
            target = "jmtools::local_inference",
            profile_id = %profile.id,
            models_root = %models_root.display(),
            "sd-cpp ensure_ready started"
        );
        let _executable = resolve_cli_executable(app)?;
        std::fs::create_dir_all(models_root)
            .map_err(|error| format!("创建本地模型目录失败：{error}"))?;
        let hf_endpoint = hf_endpoint_for_app(app)?;
        let _assets = ensure_profile_assets(models_root, profile.id.as_str(), hf_endpoint.as_str())?;
        self.ready_profile_id = Some(profile.id.clone());
        info!(
            target = "jmtools::local_inference",
            profile_id = %profile.id,
            "sd-cpp ensure_ready finished"
        );
        Ok(())
    }

    fn generate_png(
        &mut self,
        profile: &ModelProfile,
        models_root: &PathBuf,
        request: &GenerateImageRequest,
        resolved_loras: &[ResolvedLora],
        output_path: &PathBuf,
        app: &AppHandle,
    ) -> Result<(), String> {
        self.ensure_ready(profile, models_root, app)?;

        let executable = resolve_cli_executable(app)?;
        let hf_endpoint = hf_endpoint_for_app(app)?;
        let settings = load_settings_for_app(app)?;
        let assets = ensure_profile_assets(models_root, profile.id.as_str(), hf_endpoint.as_str())?;
        let capabilities = get_sd_cli_capabilities(app);
        let cli_args = resolve_effective_cli_args(&assets.cli_args, &settings);

        if let Some(parent) = output_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("创建输出目录失败：{error}"))?;
        }

        let has_reference = request
            .reference_image_path
            .as_ref()
            .is_some_and(|path| path.is_file());
        if has_reference && !capabilities.img2img_supported {
            return Err(
                "当前 sd-cpp Runtime 版本不支持 img2img，请升级 Runtime 或移除参考图。".to_string(),
            );
        }

        let mut attempt_width = request.width;
        let mut attempt_height = request.height;
        let mut last_error = String::new();
        let redact_prompts = should_redact_prompts(app);
        let generation_started = Instant::now();

        info!(
            target = "jmtools::local_inference",
            profile_id = %profile.id,
            width = request.width,
            height = request.height,
            steps = request.steps,
            has_reference,
            prompt = %redact::redact_prompt(&request.prompt, redact_prompts),
            "sd-cpp generate_png started"
        );

        for attempt in 0..2 {
            match run_sd_cli_generation(
                &executable,
                models_root,
                &assets,
                request,
                resolved_loras,
                output_path,
                &cli_args,
                &capabilities,
                attempt_width,
                attempt_height,
                has_reference,
                redact_prompts,
            ) {
                Ok(()) => {
                    info!(
                        target = "jmtools::local_inference",
                        profile_id = %profile.id,
                        width = attempt_width,
                        height = attempt_height,
                        attempt = attempt + 1,
                        duration_ms = generation_started.elapsed().as_millis() as u64,
                        output_path = %output_path.display(),
                        "sd-cpp generate_png finished"
                    );
                    return Ok(());
                }
                Err(error) => {
                    let combined = error.clone();
                    if attempt == 0 && is_vulkan_device_memory_error(&combined) {
                        warn!(
                            target = "jmtools::local_inference",
                            profile_id = %profile.id,
                            width = attempt_width,
                            height = attempt_height,
                            attempt = attempt + 1,
                            "sd-cpp OOM detected, retrying with reduced resolution"
                        );
                        let connection = open_app_database(app)?;
                        ensure_app_settings_schema(&connection)?;
                        let hardware = resolve_hardware_profile(&connection, false)?;
                        let limits = build_generation_limits(
                            &hardware.hardware,
                            &settings,
                            Some(profile.id.as_str()),
                        )?;
                        let retry_max = limits.max_side.saturating_sub(128).max(384);
                        let (retry_width, retry_height, _) =
                            apply_size_to_limits(attempt_width, attempt_height, &limits);
                        let (retry_width, retry_height) = clamp_to_max_side(
                            retry_width,
                            retry_height,
                            retry_max,
                        );
                        if retry_width == attempt_width && retry_height == attempt_height {
                            return Err(error);
                        }
                        attempt_width = retry_width;
                        attempt_height = retry_height;
                        last_error = format!(
                            "{error}\n\n已自动将分辨率降至 {attempt_width}×{attempt_height} 并重试…"
                        );
                        continue;
                    }
                    return Err(error);
                }
            }
        }

        error!(
            target = "jmtools::local_inference",
            profile_id = %profile.id,
            duration_ms = generation_started.elapsed().as_millis() as u64,
            error = %last_error,
            "sd-cpp generate_png failed after retries"
        );
        Err(last_error)
    }
}

#[allow(clippy::too_many_arguments)]
fn run_sd_cli_generation(
    executable: &Path,
    models_root: &Path,
    assets: &ResolvedProfileAssets,
    request: &GenerateImageRequest,
    resolved_loras: &[ResolvedLora],
    output_path: &Path,
    cli_args: &super::model_assets::EffectiveCliArgs,
    capabilities: &super::sd_cli_capabilities::SdCliCapabilities,
    width: u32,
    height: u32,
    has_reference: bool,
    redact_prompts: bool,
) -> Result<(), String> {
    let started = Instant::now();
    let command_summary = summarize_sd_cli_command(
        executable,
        width,
        height,
        request.steps,
        has_reference,
        resolved_loras.len(),
        cli_args,
    );

    info!(
        target = "jmtools::local_inference",
        command = %command_summary,
        prompt = %redact::redact_prompt(&request.prompt, redact_prompts),
        "sd-cli subprocess starting"
    );

    let mut command = Command::new(executable);
    command
        .arg("--diffusion-model")
        .arg(&assets.diffusion_model)
        .arg("--vae")
        .arg(&assets.vae)
        .arg("--llm")
        .arg(&assets.llm)
        .arg("-W")
        .arg(width.to_string())
        .arg("-H")
        .arg(height.to_string())
        .arg("--steps")
        .arg(request.steps.to_string())
        .arg("--cfg-scale")
        .arg(request.cfg_scale.to_string())
        .arg("-p")
        .arg(&request.prompt)
        .arg("-o")
        .arg(output_path);

    if capabilities
        .supported_flags
        .iter()
        .any(|flag| flag == "seed")
    {
        command
            .arg("--seed")
            .arg(request.seed.to_string());
    }

    if has_reference {
        append_img2img_args(&mut command, request, capabilities);
    }

    if let Some(lora_dir) = resolve_lora_model_dir(models_root, resolved_loras) {
        command
            .arg("--lora-model-dir")
            .arg(lora_dir)
            .arg("--lora-apply-mode")
            .arg(cli_args.lora_apply_mode.as_str());
    }

    if let Some(negative) = request
        .negative_prompt
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        command.arg("-n").arg(negative);
    }

    if cli_args.offload_to_cpu
        && capabilities
            .supported_flags
            .iter()
            .any(|flag| flag == "offloadToCpu")
    {
        command.arg("--offload-to-cpu");
    }
    if cli_args.diffusion_fa
        && capabilities
            .supported_flags
            .iter()
            .any(|flag| flag == "diffusionFa")
    {
        command.arg("--diffusion-fa");
    }
    if cli_args.vae_on_cpu
        && capabilities
            .supported_flags
            .iter()
            .any(|flag| flag == "vaeOnCpu")
    {
        command.arg("--vae-on-cpu");
    }
    if cli_args.vae_tiling
        && capabilities
            .supported_flags
            .iter()
            .any(|flag| flag == "vaeTiling")
    {
        command.arg("--vae-tiling");
        if let Some(overlap) = cli_args.vae_tile_overlap {
            command.arg("--vae-tile-overlap").arg(overlap.to_string());
        }
    }
    if cli_args.clip_on_cpu
        && capabilities
            .supported_flags
            .iter()
            .any(|flag| flag == "clipOnCpu")
    {
        command.arg("--clip-on-cpu");
    }
    if let Some(params_backend) = cli_args.params_backend.as_ref() {
        if capabilities
            .supported_flags
            .iter()
            .any(|flag| flag == "paramsBackend")
        {
            command.arg("--params-backend").arg(params_backend);
        }
    }
    if let Some(backend) = cli_args.backend.as_ref() {
        if capabilities
            .supported_flags
            .iter()
            .any(|flag| flag == "backend")
        {
            command.arg("--backend").arg(backend);
        }
    }

    let output = command
        .output()
        .map_err(|error| format!("启动 sd-cli 失败：{error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let exit_code = output
            .status
            .code()
            .map(|code| code.to_string())
            .unwrap_or_else(|| "unknown".to_string());
        error!(
            target = "jmtools::local_inference",
            exit_code = %exit_code,
            duration_ms = started.elapsed().as_millis() as u64,
            stderr = %redact::truncate_stderr(&stderr),
            stdout = %redact::truncate_stderr(&stdout),
            width,
            height,
            "sd-cli subprocess failed"
        );
        return Err(format_sd_cli_failure(
            &exit_code,
            &stdout,
            &stderr,
            width,
            height,
            resolved_loras.len(),
        ));
    }

    if !output_path.is_file() {
        error!(
            target = "jmtools::local_inference",
            output_path = %output_path.display(),
            duration_ms = started.elapsed().as_millis() as u64,
            "sd-cli finished but output PNG missing"
        );
        return Err("生图完成但未找到输出 PNG。".to_string());
    }

    info!(
        target = "jmtools::local_inference",
        duration_ms = started.elapsed().as_millis() as u64,
        output_path = %output_path.display(),
        "sd-cli subprocess finished"
    );

    Ok(())
}

fn append_img2img_args(
    command: &mut Command,
    request: &GenerateImageRequest,
    capabilities: &super::sd_cli_capabilities::SdCliCapabilities,
) {
    let reference_path = request
        .reference_image_path
        .as_ref()
        .expect("img2img requires reference path");
    let strength = request
        .reference_strength
        .unwrap_or(0.42)
        .clamp(0.05, 1.0);

    if let Some(mode_flag) = capabilities.img2img_mode_flag.as_ref() {
        command.arg(mode_flag).arg("img2img");
    }

    if let Some(init_flag) = capabilities.img2img_init_flag.as_ref() {
        command.arg(init_flag).arg(reference_path);
    } else {
        command.arg("--init-img").arg(reference_path);
    }

    if capabilities
        .supported_flags
        .iter()
        .any(|flag| flag == "strength")
    {
        command.arg("--strength").arg(strength.to_string());
    }
}

fn summarize_sd_cli_command(
    executable: &Path,
    width: u32,
    height: u32,
    steps: u32,
    has_reference: bool,
    lora_count: usize,
    cli_args: &super::model_assets::EffectiveCliArgs,
) -> String {
    format!(
        "{} -W {width} -H {height} --steps {steps} img2img={has_reference} loras={lora_count} offload={} vae_cpu={} tiling={}",
        executable.display(),
        cli_args.offload_to_cpu,
        cli_args.vae_on_cpu,
        cli_args.vae_tiling
    )
}

fn clamp_to_max_side(width: u32, height: u32, max_side: u32) -> (u32, u32) {
    super::resolution::clamp_local_generation_size(width, height, max_side)
}

fn is_vulkan_device_memory_error(combined_output: &str) -> bool {
    combined_output.contains("ErrorOutOfDeviceMemory")
        || combined_output.contains("failed to allocate Vulkan")
        || combined_output.contains("Device memory allocation")
}

fn format_sd_cli_failure(
    exit_code: &str,
    stdout: &str,
    stderr: &str,
    width: u32,
    height: u32,
    lora_count: usize,
) -> String {
    let combined = format!("{stdout}\n{stderr}");
    if is_vulkan_device_memory_error(&combined) {
        return format_vulkan_oom_message(width, height, lora_count);
    }

    format!("sd-cli 生图失败（exit {exit_code}）。\nstdout:\n{stdout}\nstderr:\n{stderr}")
}

fn format_vulkan_oom_message(width: u32, height: u32, lora_count: usize) -> String {
    let mut lines = vec![
        format!("GPU 显存不足，无法在 {width}×{height} 下完成本地生图（Vulkan ErrorOutOfDeviceMemory）。"),
        "建议按顺序尝试：".to_string(),
        "1. 在「设置 → 本地生图 → 生图 Runtime」应用低显存预设。".to_string(),
        "2. 将生图分辨率降至 512×512 或 768×768 后重试。".to_string(),
        "3. 在「设置 → 本地生图」暂时关闭全部 LoRA。".to_string(),
        "4. 换用更小档位（如 sdxs-512），或 4–6GB 显存避免 Klein。".to_string(),
        "5. 角色工坊若使用四向/八向 turnaround，会显著抬高显存；低显存设备请改单向前向。".to_string(),
        "6. 关闭占用 GPU 的其他程序，并在任务管理器中确认专用 GPU 显存余量。".to_string(),
    ];

    if lora_count > 0 {
        lines.insert(
            3,
            format!("当前启用了 {lora_count} 个 LoRA，会额外占用显存。"),
        );
    }

    lines.join("\n")
}

#[allow(dead_code)]
fn summarize_assets(assets: &ResolvedProfileAssets) -> String {
    format!(
        "diffusion={}, vae={}, llm={}",
        assets.diffusion_model.display(),
        assets.vae.display(),
        assets.llm.display()
    )
}
