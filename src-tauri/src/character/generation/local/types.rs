use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum InferenceBackend {
    Cuda,
    Vulkan,
    Metal,
    Cpu,
    Unknown,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareProfile {
    pub total_ram_mb: u64,
    pub gpu_name: Option<String>,
    pub vram_mb: Option<u64>,
    pub backend: InferenceBackend,
    pub has_nvidia_gpu: bool,
    pub os: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProfile {
    pub id: String,
    pub label: String,
    pub backend: String,
    pub preset: String,
    pub weight: String,
    pub min_vram_mb: u64,
    pub default_width: u32,
    pub default_height: u32,
    pub default_steps: u32,
    pub default_cfg_scale: f32,
    pub estimated_size_mb: u64,
    pub description: String,
    #[serde(default)]
    pub default_lora_ids: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoraAttachment {
    pub id: String,
    pub label: String,
    pub hf_repo: String,
    pub file_stem: String,
    pub compatible_presets: Vec<String>,
    pub compatible_profile_ids: Vec<String>,
    pub default_strength: f32,
    pub trigger_words: Vec<String>,
    pub estimated_size_mb: u64,
    pub description: String,
}

#[derive(Clone, Debug)]
pub struct GenerateImageRequest {
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub width: u32,
    pub height: u32,
    pub seed: u64,
    pub steps: u32,
    pub cfg_scale: f32,
    pub lora_ids: Vec<String>,
    pub lora_strengths: Vec<f32>,
    pub reference_image_path: Option<std::path::PathBuf>,
    pub reference_strength: Option<f32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileAssetFileStatus {
    pub role: String,
    pub file_name: String,
    pub present: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModelProfileStatus {
    pub profile: ModelProfile,
    pub recommended: bool,
    pub installed: bool,
    pub ready: bool,
    pub detail: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub asset_files: Vec<ProfileAssetFileStatus>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalLoraStatus {
    pub lora: LoraAttachment,
    pub installed: bool,
    pub detail: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendEvaluationStatus {
    pub id: String,
    pub label: String,
    pub phase: String,
    pub integrated: bool,
    pub summary: String,
    pub recommendation: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalInferenceSettings {
    #[serde(default = "default_active_profile_id")]
    pub active_profile_id: String,
    #[serde(default)]
    pub models_directory: String,
    #[serde(default)]
    pub enabled_lora_ids: Vec<String>,
    #[serde(default = "default_lora_strength")]
    pub default_lora_strength: f32,
    #[serde(default = "default_ollama_base")]
    pub ollama_api_base: String,
    #[serde(default = "default_huggingface_endpoint")]
    pub huggingface_endpoint: String,
    #[serde(default = "default_generation_width")]
    pub generation_width: u32,
    #[serde(default = "default_generation_height")]
    pub generation_height: u32,
    #[serde(default)]
    pub max_generation_side: u32,
    #[serde(default = "default_generation_steps")]
    pub generation_steps: u32,
    #[serde(default = "default_generation_cfg_scale")]
    pub generation_cfg_scale: f32,
    #[serde(default)]
    pub test_width: u32,
    #[serde(default)]
    pub test_height: u32,
    #[serde(default)]
    pub runtime_offload_to_cpu: Option<bool>,
    #[serde(default)]
    pub runtime_diffusion_fa: Option<bool>,
    #[serde(default)]
    pub runtime_vae_on_cpu: bool,
    #[serde(default)]
    pub runtime_vae_tiling: bool,
    #[serde(default)]
    pub runtime_clip_on_cpu: Option<bool>,
    #[serde(default)]
    pub runtime_vae_tile_overlap: Option<f32>,
    #[serde(default)]
    pub runtime_lora_apply_mode: Option<String>,
    #[serde(default)]
    pub runtime_params_backend: Option<String>,
    #[serde(default)]
    pub runtime_backend: Option<String>,
    #[serde(default)]
    pub max_img2img_side: u32,
    #[serde(default = "default_img2img_strength")]
    pub default_img2img_strength: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalGenerationLimits {
    pub max_side: u32,
    pub recommended_width: u32,
    pub recommended_height: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capped_from: Option<(u32, u32)>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectiveRuntimeOptions {
    pub offload_to_cpu: bool,
    pub diffusion_fa: bool,
    pub vae_on_cpu: bool,
    pub vae_on_cpu_supported: bool,
    pub vae_tiling: bool,
    pub vae_tiling_supported: bool,
    pub clip_on_cpu: bool,
    pub clip_on_cpu_supported: bool,
    pub vae_tile_overlap: Option<f32>,
    pub lora_apply_mode: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalGenerationLimitsResult {
    pub limits: LocalGenerationLimits,
    pub effective_runtime: EffectiveRuntimeOptions,
    pub backend_label: String,
    pub img2img_supported: bool,
    pub img2img_max_side: u32,
}

fn default_generation_width() -> u32 {
    512
}

fn default_generation_height() -> u32 {
    512
}

fn default_generation_steps() -> u32 {
    4
}

fn default_generation_cfg_scale() -> f32 {
    1.0
}

fn default_active_profile_id() -> String {
    "klein-4b-q4".to_string()
}

fn default_lora_strength() -> f32 {
    0.9
}

fn default_ollama_base() -> String {
    "http://127.0.0.1:11434".to_string()
}

fn default_huggingface_endpoint() -> String {
    String::new()
}

fn default_img2img_strength() -> f32 {
    0.42
}

impl Default for LocalInferenceSettings {
    fn default() -> Self {
        Self {
            active_profile_id: default_active_profile_id(),
            models_directory: String::new(),
            enabled_lora_ids: Vec::new(),
            default_lora_strength: default_lora_strength(),
            ollama_api_base: default_ollama_base(),
            huggingface_endpoint: default_huggingface_endpoint(),
            generation_width: default_generation_width(),
            generation_height: default_generation_height(),
            max_generation_side: 0,
            generation_steps: default_generation_steps(),
            generation_cfg_scale: default_generation_cfg_scale(),
            test_width: 0,
            test_height: 0,
            runtime_offload_to_cpu: None,
            runtime_diffusion_fa: None,
            runtime_vae_on_cpu: false,
            runtime_vae_tiling: false,
            runtime_clip_on_cpu: None,
            runtime_vae_tile_overlap: None,
            runtime_lora_apply_mode: None,
            runtime_params_backend: None,
            runtime_backend: None,
            max_img2img_side: 0,
            default_img2img_strength: default_img2img_strength(),
        }
    }
}
