use std::path::PathBuf;

use diffusion_rs::api::gen_img;
use diffusion_rs::preset::{Flux2Klein4BWeight, Preset, PresetBuilder};

use crate::character::generation::local::lora::{inject_lora_triggers, resolve_loras_for_request, ResolvedLora};
use crate::character::generation::local::types::{GenerateImageRequest, ModelProfile};

use super::download_cache::models_hf_cache_root;

fn ensure_parent_directory(path: &PathBuf) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| format!("创建输出目录失败：{error}"))?;
    }
    Ok(())
}

pub fn warmup_profile(profile: &ModelProfile, models_root: &PathBuf) -> Result<(), String> {
    let _preset = build_preset(profile)?;
    std::env::set_var("HF_HOME", models_hf_cache_root(models_root));
    Ok(())
}

pub fn generate_png(
    profile: &ModelProfile,
    models_root: &PathBuf,
    request: &GenerateImageRequest,
    output_path: &PathBuf,
) -> Result<(), String> {
    ensure_parent_directory(output_path)?;
    std::env::set_var("HF_HOME", models_hf_cache_root(models_root));

    let loras = resolve_loras_for_request(
        models_root,
        profile.id.as_str(),
        profile.preset.as_str(),
        &[],
        0.9,
        request,
    )?;

    let prompt = inject_lora_triggers(&request.prompt, &loras);
    let preset = build_preset(profile)?;

    let mut builder = PresetBuilder::default();
    builder.preset(preset);
    builder.prompt(prompt);
    builder.width(request.width as i32);
    builder.height(request.height as i32);
    builder.steps(request.steps as i32);
    builder.seed(request.seed as i64);
    builder.cfg_scale(request.cfg_scale);
    builder.output(output_path.clone());

    if let Some(negative) = request.negative_prompt.as_ref().filter(|value| !value.trim().is_empty())
    {
        builder.negative_prompt(negative.clone());
    }

    if !loras.is_empty() {
        let lora_specs = build_lora_specs(&loras);
        let lora_dir = loras[0].directory.parent().unwrap_or(models_root).to_path_buf();
        builder.with_modifier(move |configs| {
            configs.lora_models(lora_dir, lora_specs);
            Ok(configs)
        });
    }

    let (config, mut model_config) = builder
        .build()
        .map_err(|error| format!("构建 diffusion-rs 配置失败：{error}"))?;

    gen_img(&config, &mut model_config)
        .map_err(|error| format!("本地 diffusion-rs 生图失败：{error}"))?;

    if !output_path.exists() {
        return Err("生图完成但未找到输出 PNG。".to_string());
    }

    Ok(())
}

fn build_preset(profile: &ModelProfile) -> Result<Preset, String> {
    match profile.preset.as_str() {
        "Flux2Klein4B" => {
            let weight = match profile.weight.as_str() {
                "Q8_0" => Flux2Klein4BWeight::Q8_0,
                "BF16" => Flux2Klein4BWeight::BF16,
                _ => Flux2Klein4BWeight::Q4_0,
            };
            Ok(Preset::Flux2Klein4B(weight))
        }
        "SDXS512DreamShaper" => Ok(Preset::SDXS512DreamShaper),
        "SDTurbo" => Ok(Preset::SDTurbo),
        "SDXLTurbo1_0" => Ok(Preset::SDXLTurbo1_0),
        other => Err(format!("diffusion-rs 暂不支持的 preset：{other}")),
    }
}

fn build_lora_specs(loras: &[ResolvedLora]) -> Vec<diffusion_rs::api::LoraSpec> {
    loras
        .iter()
        .map(|lora| diffusion_rs::api::LoraSpec {
            file_name: lora.attachment.file_stem.clone(),
            multiplier: lora.strength,
            is_high_noise: false,
        })
        .collect()
}
