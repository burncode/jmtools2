use super::catalog::load_model_catalog;
use super::types::{HardwareProfile, ModelProfile};

pub fn recommend_profile(
    hardware: &HardwareProfile,
    override_profile_id: Option<&str>,
) -> Result<ModelProfile, String> {
    if let Some(profile_id) = override_profile_id.filter(|value| !value.trim().is_empty()) {
        return super::catalog::find_model_profile(profile_id);
    }

    let profiles = load_model_catalog()?;
    let vram = hardware.vram_mb.unwrap_or(0);

    let recommended_id = if vram >= 10_240 || hardware.total_ram_mb >= 24_768 {
        "klein-4b-q8"
    } else if vram >= 6_144 {
        "klein-4b-q4"
    } else if vram >= 4_096 {
        "sdxs-512"
    } else if hardware.total_ram_mb >= 8_192 {
        "ollama-flux2-klein"
    } else {
        "pixel-forge-anvil"
    };

    profiles
        .into_iter()
        .find(|profile| profile.id == recommended_id)
        .ok_or_else(|| "模型目录缺少推荐档位。".to_string())
}

pub fn rank_profiles_for_hardware(hardware: &HardwareProfile) -> Result<Vec<ModelProfile>, String> {
    let profiles = load_model_catalog()?;
    let vram = hardware.vram_mb.unwrap_or(0);

    let mut ranked = profiles;
    ranked.sort_by(|left, right| {
        let left_score = profile_fit_score(left, vram, hardware);
        let right_score = profile_fit_score(right, vram, hardware);
        right_score.cmp(&left_score)
    });

    Ok(ranked)
}

fn profile_fit_score(profile: &ModelProfile, vram_mb: u64, hardware: &HardwareProfile) -> i32 {
    let mut score = 0;

    if profile.backend == "sd-cpp" || profile.backend == "diffusion-rs" {
        score += 100;
    } else if profile.backend == "ollama" {
        score += 60;
    } else {
        score += 20;
    }

    if vram_mb >= profile.min_vram_mb {
        score += 50;
    } else if profile.min_vram_mb == 0 {
        score += 30;
    } else {
        score -= 40;
    }

    if profile.id == "klein-4b-q4" {
        score += 10;
    }

    if hardware.has_nvidia_gpu && (profile.backend == "sd-cpp" || profile.backend == "diffusion-rs") {
        score += 15;
    }

    score
}
