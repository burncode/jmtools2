//! 本地生图分辨率策略：按 GPU 显存、后端、档位与用户设置封顶，避免 Vulkan OOM。

use super::model_assets::{ProfileCliArgs, resolve_effective_cli_args};
use super::types::{
    EffectiveRuntimeOptions, HardwareProfile, InferenceBackend, LocalGenerationLimits,
    LocalInferenceSettings, ModelProfile,
};

const MIN_SIDE: u32 = 128;

/// 按探测到的 GPU 显存（MB）返回本地生图允许的最大边长。
pub fn resolve_local_max_side(vram_mb: Option<u64>) -> u32 {
    let vram = vram_mb.unwrap_or(0);
    if vram >= 8 * 1024 {
        1536
    } else if vram >= 6 * 1024 {
        1024
    } else if vram >= 4 * 1024 {
        768
    } else {
        512
    }
}

fn downgrade_side_tier(side: u32) -> u32 {
    if side >= 1536 {
        1024
    } else if side >= 1024 {
        768
    } else if side >= 768 {
        512
    } else {
        512
    }
}

fn is_klein_profile(profile: &ModelProfile) -> bool {
    profile.id.starts_with("klein-4b")
}

pub fn backend_label(backend: &InferenceBackend) -> String {
    match backend {
        InferenceBackend::Cuda => "CUDA".to_string(),
        InferenceBackend::Vulkan => "Vulkan".to_string(),
        InferenceBackend::Metal => "Metal".to_string(),
        InferenceBackend::Cpu => "CPU".to_string(),
        InferenceBackend::Unknown => "未知".to_string(),
    }
}

pub fn resolve_effective_max_side(
    hardware: &HardwareProfile,
    profile: &ModelProfile,
    settings: &LocalInferenceSettings,
    lora_count: usize,
) -> (u32, Vec<String>) {
    let mut warnings = Vec::new();
    let mut max_side = resolve_local_max_side(hardware.vram_mb);

    if matches!(hardware.backend, InferenceBackend::Vulkan) && !hardware.has_nvidia_gpu {
        let lowered = downgrade_side_tier(max_side);
        if lowered < max_side {
            warnings.push(format!(
                "Vulkan 非 NVIDIA 设备，最大边长由 {max_side} 下调至 {lowered} px。"
            ));
            max_side = lowered;
        }
    }

    if is_klein_profile(profile) {
        let klein_cap = if hardware.has_nvidia_gpu
            && matches!(hardware.backend, InferenceBackend::Cuda)
            && hardware.vram_mb.unwrap_or(0) >= 10 * 1024
        {
            1024
        } else {
            512
        };
        if max_side > klein_cap {
            warnings.push(format!("Klein 档位在当前设备上推荐最大边长 {klein_cap} px。"));
            max_side = klein_cap;
        }
    }

    if lora_count > 0 {
        let with_lora = max_side.saturating_sub(128).max(MIN_SIDE);
        if with_lora < max_side {
            warnings.push(format!(
                "已启用 {lora_count} 个 LoRA，最大边长下调至 {with_lora} px。"
            ));
            max_side = with_lora;
        }
    }

    if settings.max_generation_side > 0 {
        let user_cap = settings.max_generation_side;
        if user_cap < max_side {
            warnings.push(format!("已应用用户设置的最大边长 {user_cap} px。"));
        }
        max_side = max_side.min(user_cap);
    }

    (max_side, warnings)
}

pub fn resolve_generation_limits(
    hardware: &HardwareProfile,
    profile: &ModelProfile,
    settings: &LocalInferenceSettings,
    lora_count: usize,
) -> LocalGenerationLimits {
    let (max_side, warnings) =
        resolve_effective_max_side(hardware, profile, settings, lora_count);

    let base_width = if settings.generation_width > 0 {
        settings.generation_width
    } else {
        profile.default_width.max(MIN_SIDE)
    };
    let base_height = if settings.generation_height > 0 {
        settings.generation_height
    } else {
        profile.default_height.max(MIN_SIDE)
    };

    let (recommended_width, recommended_height) =
        clamp_local_generation_size(base_width, base_height, max_side);

    LocalGenerationLimits {
        max_side,
        recommended_width,
        recommended_height,
        capped_from: None,
        warnings,
    }
}

/// 等比缩小，使较长边不超过 `max_side`。
pub fn clamp_local_generation_size(width: u32, height: u32, max_side: u32) -> (u32, u32) {
    let width = width.max(MIN_SIDE);
    let height = height.max(MIN_SIDE);
    let longest = width.max(height);
    if longest <= max_side {
        return (width, height);
    }

    let scale = max_side as f64 / longest as f64;
    let scaled_width = ((width as f64 * scale).round() as u32).clamp(MIN_SIDE, max_side);
    let scaled_height = ((height as f64 * scale).round() as u32).clamp(MIN_SIDE, max_side);
    (scaled_width, scaled_height)
}

pub fn apply_size_to_limits(
    width: u32,
    height: u32,
    limits: &LocalGenerationLimits,
) -> (u32, u32, Option<(u32, u32)>) {
    let requested = (width.max(MIN_SIDE), height.max(MIN_SIDE));
    let (clamped_width, clamped_height) =
        clamp_local_generation_size(requested.0, requested.1, limits.max_side);
    let capped_from = if (clamped_width, clamped_height) != requested {
        Some(requested)
    } else {
        None
    };
    (clamped_width, clamped_height, capped_from)
}

/// 四向 turnaround 拼图边长：单格 ×2，且不超过本地显存上限。
pub fn resolve_local_turnaround_sheet_side(cell_size: u32, max_side: u32) -> u32 {
    cell_size
        .saturating_mul(2)
        .clamp(256, max_side.max(256))
}

pub fn resolve_effective_runtime_options(
    manifest: &ProfileCliArgs,
    settings: &LocalInferenceSettings,
    capabilities: &super::sd_cli_capabilities::SdCliCapabilities,
) -> EffectiveRuntimeOptions {
    let cli = resolve_effective_cli_args(manifest, settings);
    let flag_supported = |id: &str| {
        capabilities
            .supported_flags
            .iter()
            .any(|entry| entry == id)
    };
    EffectiveRuntimeOptions {
        offload_to_cpu: cli.offload_to_cpu,
        diffusion_fa: cli.diffusion_fa,
        vae_on_cpu: cli.vae_on_cpu && flag_supported("vaeOnCpu"),
        vae_on_cpu_supported: flag_supported("vaeOnCpu"),
        vae_tiling: cli.vae_tiling && flag_supported("vaeTiling"),
        vae_tiling_supported: flag_supported("vaeTiling"),
        clip_on_cpu: cli.clip_on_cpu && flag_supported("clipOnCpu"),
        clip_on_cpu_supported: flag_supported("clipOnCpu"),
        vae_tile_overlap: cli.vae_tile_overlap.filter(|_| flag_supported("vaeTileOverlap")),
        lora_apply_mode: cli.lora_apply_mode,
    }
}

pub fn resolve_effective_img2img_max_side(
    hardware: &HardwareProfile,
    profile: &ModelProfile,
    settings: &LocalInferenceSettings,
    txt2img_max_side: u32,
) -> u32 {
    let mut max_side = txt2img_max_side.saturating_sub(128).max(MIN_SIDE);
    if is_klein_profile(profile) && max_side > 512 {
        max_side = 512;
    }
    if settings.max_img2img_side > 0 {
        max_side = max_side.min(settings.max_img2img_side);
    }
    let _ = hardware;
    max_side
}

pub fn resolve_test_generation_size(
    settings: &LocalInferenceSettings,
    limits: &LocalGenerationLimits,
    input_width: u32,
    input_height: u32,
) -> (u32, u32) {
    let width = if input_width > 0 {
        input_width
    } else if settings.test_width > 0 {
        settings.test_width
    } else {
        limits.recommended_width
    };
    let height = if input_height > 0 {
        input_height
    } else if settings.test_height > 0 {
        settings.test_height
    } else {
        limits.recommended_height
    };
    let (width, height, _) = apply_size_to_limits(width, height, limits);
    (width, height)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character::generation::local::types::LocalInferenceSettings;

    fn sample_hardware(vram_mb: u64, backend: InferenceBackend) -> HardwareProfile {
        let has_nvidia_gpu = matches!(backend, InferenceBackend::Cuda);
        HardwareProfile {
            total_ram_mb: 16_384,
            gpu_name: Some("Test GPU".to_string()),
            vram_mb: Some(vram_mb),
            backend,
            has_nvidia_gpu,
            os: "windows".to_string(),
        }
    }

    fn klein_profile() -> ModelProfile {
        ModelProfile {
            id: "klein-4b-q4".to_string(),
            label: "Klein".to_string(),
            backend: "sd-cpp".to_string(),
            preset: "Flux2Klein4B".to_string(),
            weight: "Q4_0".to_string(),
            min_vram_mb: 6144,
            default_width: 512,
            default_height: 512,
            default_steps: 4,
            default_cfg_scale: 1.0,
            estimated_size_mb: 3500,
            description: String::new(),
            default_lora_ids: Vec::new(),
        }
    }

    #[test]
    fn max_side_tiers() {
        assert_eq!(resolve_local_max_side(Some(3 * 1024)), 512);
        assert_eq!(resolve_local_max_side(Some(5 * 1024)), 768);
        assert_eq!(resolve_local_max_side(Some(7 * 1024)), 1024);
        assert_eq!(resolve_local_max_side(Some(12 * 1024)), 1536);
        assert_eq!(resolve_local_max_side(None), 512);
    }

    #[test]
    fn klein_vulkan_caps_at_512() {
        let hardware = sample_hardware(7 * 1024, InferenceBackend::Vulkan);
        let settings = LocalInferenceSettings::default();
        let limits = resolve_generation_limits(&hardware, &klein_profile(), &settings, 0);
        assert_eq!(limits.max_side, 512);
    }

    #[test]
    fn user_max_side_overrides_auto() {
        let hardware = sample_hardware(12 * 1024, InferenceBackend::Cuda);
        let settings = LocalInferenceSettings {
            max_generation_side: 768,
            ..LocalInferenceSettings::default()
        };
        let limits = resolve_generation_limits(&hardware, &klein_profile(), &settings, 0);
        assert_eq!(limits.max_side, 768);
    }

    #[test]
    fn clamp_preserves_aspect_and_caps_longest() {
        assert_eq!(clamp_local_generation_size(672, 1008, 1024), (672, 1008));
        assert_eq!(clamp_local_generation_size(672, 1008, 768), (512, 768));
        assert_eq!(clamp_local_generation_size(2016, 2016, 1024), (1024, 1024));
    }

    #[test]
    fn turnaround_sheet_caps_at_max_side() {
        assert_eq!(resolve_local_turnaround_sheet_side(1008, 1024), 1024);
        assert_eq!(resolve_local_turnaround_sheet_side(512, 1536), 1024);
    }
}
