use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

mod record;
pub use record::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCharacterAssetInput {
    pub(crate) project_root: String,
    pub(crate) draft: CharacterWorkshopDraftInput,
    pub(crate) master_plan: CharacterMasterPlanInput,
    pub(crate) selected_plan: CharacterCandidatePlanInput,
    pub(crate) provider_name: String,
    pub(crate) model: String,
    pub(crate) task_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCharacterReferenceImagesInput {
    pub(crate) image_paths: Vec<String>,
    pub(crate) project_root: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateCharacterMasterImageInput {
    pub(crate) character_id: String,
    pub(crate) project_root: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCharacterAssetInput {
    pub(crate) character_id: String,
    pub(crate) project_root: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleCharacterFavoriteInput {
    pub(crate) character_id: String,
    pub(crate) favorite: bool,
    pub(crate) project_root: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveCharacterBackgroundInput {
    pub(crate) character_id: String,
    pub(crate) project_root: String,
    #[serde(default)]
    pub(crate) alpha_matting: bool,
    #[serde(default)]
    pub(crate) background_threshold: Option<u8>,
    #[serde(default)]
    pub(crate) cleanup_strength: Option<String>,
    #[serde(default)]
    pub(crate) custom_model_path: String,
    #[serde(default)]
    pub(crate) edge_softness: Option<u8>,
    #[serde(default)]
    pub(crate) engine: Option<String>,
    #[serde(default)]
    pub(crate) executable_path: String,
    #[serde(default)]
    pub(crate) foreground_threshold: Option<u8>,
    #[serde(default)]
    pub(crate) hole_fill_max_pixels: Option<u32>,
    #[serde(default)]
    pub(crate) model: String,
    #[serde(default)]
    pub(crate) preserve_small_parts: bool,
    #[serde(default)]
    pub(crate) spill_suppression: Option<u8>,
    #[serde(default)]
    pub(crate) tolerance: Option<u8>,
    #[serde(default)]
    pub(crate) view_id: Option<String>,
    #[serde(default)]
    pub(crate) matting_color_space: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BindCharacterToolResultInput {
    #[serde(default)]
    pub(crate) bbox: Option<BoundingBox>,
    pub(crate) character_id: String,
    pub(crate) output_image: CharacterToolResultImageInput,
    pub(crate) project_root: String,
    #[serde(default)]
    pub(crate) score: Option<u16>,
    #[serde(default)]
    pub(crate) view_id: Option<String>,
    #[serde(default)]
    pub(crate) warnings: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterToolResultImageInput {
    pub(crate) absolute_path: String,
    pub(crate) data_url: String,
    pub(crate) height: u32,
    pub(crate) project_relative_path: String,
    pub(crate) width: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareCharacterViewStyleInput {
    pub(crate) character_id: String,
    pub(crate) project_root: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateCharacterViewImagesInput {
    pub(crate) character_id: String,
    pub(crate) project_root: String,
    #[serde(default)]
    pub(crate) view_mode: Option<String>,
    #[serde(default)]
    pub(crate) views: Option<Vec<String>>,
    #[serde(default)]
    pub(crate) generation_strategy: Option<String>,
    #[serde(default)]
    pub(crate) reference_strength: Option<f64>,
    #[serde(default)]
    pub(crate) reference_mode: Option<String>,
    #[serde(default)]
    pub(crate) pose_reference_png: Option<Vec<u8>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateCharacterMasterCandidatesInput {
    #[serde(default)]
    pub(crate) compiled_prompt: Option<String>,
    pub(crate) draft: CharacterWorkshopDraftInput,
    pub(crate) master_plan: CharacterMasterPlanInput,
    #[serde(default)]
    pub(crate) model: Option<String>,
    pub(crate) project_root: String,
    #[serde(default)]
    pub(crate) provider_id: Option<String>,
    pub(crate) task_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCharacterGenerationPromptsInput {
    #[serde(default)]
    pub(crate) compiled_prompt: Option<String>,
    pub(crate) draft: CharacterWorkshopDraftInput,
    pub(crate) master_plan: CharacterMasterPlanInput,
    pub(crate) project_root: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCharacterGenerationPromptItem {
    pub(crate) plan_id: String,
    pub(crate) plan_name: String,
    pub(crate) prompt: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCharacterGenerationPromptsResult {
    pub(crate) prompts: Vec<PreviewCharacterGenerationPromptItem>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCandidatePostProcessOptionsInput {
    #[serde(default)]
    pub(crate) run_analyze: bool,
    #[serde(default)]
    pub(crate) run_normalize: bool,
    #[serde(default)]
    pub(crate) run_remove_background: bool,
    #[serde(default)]
    pub(crate) run_views: bool,
}

#[derive(Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCandidateRemoveBackgroundParamsInput {
    #[serde(default)]
    pub(crate) alpha_matting: bool,
    #[serde(default = "default_tolerance")]
    pub(crate) tolerance: u8,
    #[serde(default = "default_edge_softness")]
    pub(crate) edge_softness: u8,
    #[serde(default = "default_engine")]
    pub(crate) engine: String,
    #[serde(default)]
    pub(crate) executable_path: String,
    #[serde(default)]
    pub(crate) custom_model_path: String,
    #[serde(default = "default_rembg_model")]
    pub(crate) model: String,
    #[serde(default)]
    pub(crate) foreground_threshold: Option<u8>,
    #[serde(default)]
    pub(crate) background_threshold: Option<u8>,
    #[serde(default = "default_cleanup_strength")]
    pub(crate) cleanup_strength: String,
    #[serde(default)]
    pub(crate) preserve_small_parts: bool,
    #[serde(default = "default_hole_fill")]
    pub(crate) hole_fill_max_pixels: u16,
    #[serde(default = "default_spill")]
    pub(crate) spill_suppression: u8,
    #[serde(default = "default_matting_color_space")]
    pub(crate) matting_color_space: String,
}

#[derive(Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCandidateNormalizeParamsInput {
    #[serde(default = "default_target_width")]
    pub(crate) target_width: u32,
    #[serde(default = "default_target_height")]
    pub(crate) target_height: u32,
    #[serde(default = "default_scale_mode")]
    pub(crate) scale_mode: String,
}

#[derive(Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCandidateAnalyzeParamsInput {
    #[serde(default = "default_min_alpha")]
    pub(crate) min_alpha_coverage_pct: f64,
    #[serde(default = "default_max_bbox")]
    pub(crate) max_bbox_ratio_pct: f64,
}

#[derive(Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCandidatePostProcessParamsInput {
    #[serde(default)]
    pub(crate) remove_background: PreviewCandidateRemoveBackgroundParamsInput,
    #[serde(default)]
    pub(crate) normalize: PreviewCandidateNormalizeParamsInput,
    #[serde(default)]
    pub(crate) analyze: PreviewCandidateAnalyzeParamsInput,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCandidatePostProcessInput {
    pub(crate) options: PreviewCandidatePostProcessOptionsInput,
    pub(crate) params: PreviewCandidatePostProcessParamsInput,
    pub(crate) plan_id: String,
    pub(crate) project_root: String,
    pub(crate) source_images: CharacterDirectionPreviews,
    pub(crate) task_id: String,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCandidateAnalyzeReport {
    pub(crate) score: Option<u16>,
    pub(crate) warnings: Vec<String>,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCandidatePostProcessResult {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) analyze_report: Option<PreviewCandidateAnalyzeReport>,
    pub(crate) direction_previews: CharacterDirectionPreviews,
    pub(crate) plan_id: String,
}

fn default_tolerance() -> u8 {
    34
}

fn default_edge_softness() -> u8 {
    24
}

fn default_engine() -> String {
    "chroma".to_string()
}

fn default_rembg_model() -> String {
    "isnet-general-use".to_string()
}

fn default_cleanup_strength() -> String {
    "standard".to_string()
}

fn default_hole_fill() -> u16 {
    24
}

fn default_spill() -> u8 {
    40
}

fn default_matting_color_space() -> String {
    "rgb".to_string()
}

fn default_target_width() -> u32 {
    32
}

fn default_target_height() -> u32 {
    48
}

fn default_scale_mode() -> String {
    "integer".to_string()
}

fn default_min_alpha() -> f64 {
    6.0
}

fn default_max_bbox() -> f64 {
    85.0
}

#[derive(Deserialize, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct CharacterIdentityBlockInput {
    #[serde(default = "default_entity_type")]
    pub entity_type: String,
    #[serde(default = "default_role")]
    pub role: String,
    #[serde(default)]
    pub gender: String,
    #[serde(default = "default_age_band")]
    pub age_band: String,
    #[serde(default)]
    pub race_or_species: String,
    #[serde(default)]
    pub class_or_occupation: String,
    #[serde(default)]
    pub narrative_tags: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceTraitInput {
    pub id: String,
    pub category: String,
    pub label: String,
    pub prompt: String,
    #[serde(default)]
    pub colors: Vec<String>,
}

fn default_entity_type() -> String {
    "humanoid".to_string()
}

fn default_role() -> String {
    "hero".to_string()
}

fn default_age_band() -> String {
    "adult".to_string()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterWorkshopDraftInput {
    #[serde(default)]
    pub(crate) appearance_traits: Vec<AppearanceTraitInput>,
    #[serde(default)]
    pub(crate) archetype_template_id: Option<String>,
    #[serde(default)]
    pub(crate) background_mode: String,
    #[serde(default)]
    pub(crate) custom_height: u32,
    #[serde(default)]
    pub(crate) custom_width: u32,
    pub(crate) description: String,
    pub(crate) direction: String,
    #[serde(default)]
    pub(crate) element_colors: BTreeMap<String, Vec<String>>,
    #[serde(default)]
    pub(crate) feature_tags: Vec<String>,
    #[serde(default)]
    pub(crate) generation_count: String,
    #[serde(default)]
    pub(crate) generation_options: Vec<String>,
    #[serde(default)]
    pub(crate) generation_quality: String,
    #[serde(default)]
    pub(crate) identity: CharacterIdentityBlockInput,
    #[serde(default)]
    pub(crate) mood_keywords: Vec<String>,
    pub(crate) name: String,
    pub(crate) palette: Vec<String>,
    #[serde(default)]
    pub(crate) reference_images: Vec<CharacterReferenceImageAsset>,
    #[serde(default = "default_reference_strength")]
    pub(crate) reference_strength: f64,
    #[serde(default)]
    pub(crate) selected_resources: Vec<SelectedCharacterResourceInput>,
    pub(crate) size: String,
    pub(crate) style: String,
    #[serde(default)]
    pub(crate) style_preset_id: Option<String>,
    #[serde(default)]
    pub(crate) style_anchor_variant_key: String,
}

fn default_reference_strength() -> f64 {
    0.6
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SelectedCharacterResourceInput {
    #[serde(default)]
    pub(crate) colors: Vec<String>,
    #[serde(default)]
    pub(crate) group: String,
    pub(crate) id: String,
    pub(crate) kind: String,
    pub(crate) label: String,
    pub(crate) prompt: String,
    #[serde(default)]
    pub(crate) tags: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterReferenceImageAsset {
    pub(crate) absolute_path: String,
    pub(crate) data_url: String,
    pub(crate) file_name: String,
    pub(crate) id: String,
    pub(crate) project_relative_path: String,
    pub(crate) role: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterMasterPlanInput {
    pub(crate) action_suggestions: CharacterActionSuggestions,
    #[serde(default)]
    pub(crate) candidate_plans: Vec<CharacterCandidatePlanInput>,
    pub(crate) export_notes: Vec<String>,
    pub(crate) pixel_prompt: String,
    #[serde(default)]
    pub(crate) role_positioning: String,
    pub(crate) summary: String,
    pub(crate) visual_keywords: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterActionSuggestions {
    pub(crate) attack: String,
    pub(crate) idle: String,
    pub(crate) walk: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterCandidatePlanInput {
    pub(crate) focus: String,
    pub(crate) id: String,
    #[serde(default)]
    pub(crate) master_image: Option<CharacterImageAsset>,
    pub(crate) name: String,
    pub(crate) recommendation_score: u16,
}

