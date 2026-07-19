use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::{
    AppearanceTraitInput, CharacterActionSuggestions, CharacterReferenceImageAsset,
    SelectedCharacterResourceInput,
};

fn default_character_status() -> String {
    "draft".to_string()
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterAssetRecord {
    pub(crate) action_suggestions: CharacterActionSuggestions,
    #[serde(default)]
    pub(crate) actions: Vec<CharacterActionTrack>,
    #[serde(default)]
    pub(crate) config: Option<CharacterGenerationConfig>,
    #[serde(default)]
    pub(crate) created_at: String,
    #[serde(default)]
    pub(crate) description: String,
    #[serde(default)]
    pub(crate) direction: String,
    #[serde(default)]
    pub(crate) display_name: String,
    #[serde(default)]
    pub(crate) export_notes: Vec<String>,
    #[serde(default)]
    pub(crate) export_profiles: Vec<CharacterExportProfile>,
    #[serde(default)]
    pub(crate) favorite: bool,
    pub(crate) id: String,
    #[serde(default)]
    pub(crate) master_image: Option<CharacterImageAsset>,
    #[serde(default)]
    pub(crate) model: String,
    #[serde(default)]
    pub(crate) palette: Vec<String>,
    #[serde(default)]
    pub(crate) pixel_prompt: String,
    #[serde(default)]
    pub(crate) processing: Option<CharacterProcessingMetadata>,
    #[serde(default)]
    pub(crate) project_relative_path: String,
    #[serde(default)]
    pub(crate) provider_name: String,
    #[serde(default)]
    pub(crate) selected_plan_focus: String,
    #[serde(default)]
    pub(crate) selected_plan_id: String,
    #[serde(default)]
    pub(crate) selected_plan_name: String,
    #[serde(default)]
    pub(crate) selected_plan_score: u16,
    #[serde(default)]
    pub(crate) size: String,
    #[serde(default = "default_character_status")]
    pub(crate) status: String,
    #[serde(default)]
    pub(crate) style: String,
    #[serde(default)]
    pub(crate) style_anchor_variant_key: String,
    #[serde(default)]
    pub(crate) summary: String,
    #[serde(default)]
    pub(crate) task_id: String,
    #[serde(default)]
    pub(crate) updated_at: String,
    #[serde(default)]
    pub(crate) views: Vec<CharacterViewAsset>,
    #[serde(default)]
    pub(crate) visual_keywords: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterSummary {
    pub(crate) display_name: String,
    pub(crate) id: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterLibraryRecord {
    pub(crate) display_name: String,
    pub(crate) favorite: bool,
    pub(crate) id: String,
    pub(crate) master_image: Option<CharacterImageAsset>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) preview_image: Option<CharacterImageAsset>,
    pub(crate) selected_plan_name: String,
    pub(crate) size: String,
    pub(crate) status: String,
    pub(crate) style: String,
    pub(crate) updated_at: String,
    pub(crate) visual_keywords: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HydrateCharacterActionPreviewsInput {
    pub(crate) action_id: String,
    pub(crate) character_id: String,
    pub(crate) project_root: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterGenerationConfig {
    #[serde(default)]
    pub(crate) appearance_traits: Vec<AppearanceTraitInput>,
    #[serde(default)]
    pub(crate) archetype_template_id: Option<String>,
    pub(crate) generation: CharacterGenerationSettingsSnapshot,
    pub(crate) identity: CharacterGenerationIdentity,
    pub(crate) references: Vec<CharacterReferenceImageAsset>,
    #[serde(default)]
    pub(crate) reference_strength: Option<f64>,
    #[serde(default)]
    pub(crate) style_preset_id: Option<String>,
    pub(crate) version: u16,
    pub(crate) visual: CharacterGenerationVisual,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterGenerationIdentity {
    #[serde(default)]
    pub(crate) class_or_occupation: String,
    #[serde(default)]
    pub(crate) entity_type: String,
    pub(crate) name: String,
    #[serde(default)]
    pub(crate) narrative_tags: Vec<String>,
    #[serde(default)]
    pub(crate) race_or_species: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub(crate) role: String,
    pub(crate) tags: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterGenerationVisual {
    pub(crate) background_mode: String,
    pub(crate) direction: String,
    #[serde(default)]
    pub(crate) element_colors: BTreeMap<String, Vec<String>>,
    pub(crate) feature_tags: Vec<String>,
    pub(crate) palette: Vec<String>,
    #[serde(default)]
    pub(crate) selected_resources: Vec<SelectedCharacterResourceInput>,
    pub(crate) size: String,
    pub(crate) style: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterGenerationSettingsSnapshot {
    pub(crate) count: u16,
    pub(crate) model: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub(crate) negative_prompt: String,
    pub(crate) options: Vec<String>,
    pub(crate) prompt: String,
    pub(crate) provider_name: String,
    pub(crate) quality: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) seed: Option<u64>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AnchorPoint {
    pub(crate) mode: String,
    pub(crate) x: f32,
    pub(crate) y: f32,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BoundingBox {
    pub(crate) height: u32,
    pub(crate) width: u32,
    pub(crate) x: u32,
    pub(crate) y: u32,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterViewQualityReport {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub(crate) checked_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) score: Option<u16>,
    pub(crate) warnings: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterViewAsset {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) anchor: Option<AnchorPoint>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) bbox: Option<BoundingBox>,
    pub(crate) id: String,
    pub(crate) kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) normalized_image: Option<CharacterImageAsset>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) quality: Option<CharacterViewQualityReport>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) raw_image: Option<CharacterImageAsset>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) transparent_image: Option<CharacterImageAsset>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterProcessingMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) alpha_coverage: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) anchor: Option<AnchorPoint>,
    pub(crate) anchor_mode: String,
    pub(crate) background_removed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) bbox: Option<BoundingBox>,
    pub(crate) canvas: CharacterCanvasSize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) foot_line_y: Option<u32>,
    pub(crate) normalized: bool,
    pub(crate) warnings: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterCanvasSize {
    pub(crate) height: u32,
    pub(crate) width: u32,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterExportProfile {
    pub(crate) fps: u16,
    pub(crate) frame_height: u32,
    pub(crate) frame_width: u32,
    pub(crate) id: String,
    pub(crate) padding: u32,
    pub(crate) spacing: u32,
    pub(crate) target: String,
    pub(crate) trim: bool,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterImageAsset {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub(crate) absolute_path: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub(crate) data_url: String,
    pub(crate) height: u32,
    pub(crate) id: String,
    pub(crate) project_relative_path: String,
    pub(crate) role: String,
    pub(crate) source: String,
    pub(crate) width: u32,
}

#[derive(Deserialize, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct CharacterDirectionPreviews {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) front: Option<CharacterImageAsset>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) back: Option<CharacterImageAsset>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) left: Option<CharacterImageAsset>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) right: Option<CharacterImageAsset>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterMasterCandidateImage {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) direction_previews: Option<CharacterDirectionPreviews>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) generation_warnings: Option<Vec<String>>,
    pub(crate) image: CharacterImageAsset,
    pub(crate) plan_id: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterActionTrack {
    pub(crate) direction: String,
    pub(crate) export_ready: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) filmstrip_cut_positions: Option<Vec<u32>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) filmstrip_source: Option<CharacterImageAsset>,
    pub(crate) frames: Vec<CharacterActionFrame>,
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) loop_mode: String,
    pub(crate) note: String,
    pub(crate) preview_fps: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) quality_errors: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) quality_grade: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) quality_score: Option<u16>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) quality_warnings: Option<Vec<String>>,
    pub(crate) status: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterActionFrame {
    pub(crate) duration_ms: u16,
    pub(crate) id: String,
    pub(crate) image: Option<CharacterImageAsset>,
    pub(crate) index: u16,
    pub(crate) label: String,
    pub(crate) source: String,
    pub(crate) status: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterGenerationSettings {
    #[serde(default)]
    pub(crate) ai_character_model: String,
    #[serde(default)]
    pub(crate) ai_character_provider_id: String,
    /// 图像编辑(img2img)模型，用于带参考图的视图/turnaround/动作帧；为空时回退到角色生成模型。
    #[serde(default)]
    pub(crate) ai_character_edit_model: String,
    #[serde(default)]
    pub(crate) ai_character_edit_provider_id: String,
}

#[derive(Clone)]
pub(crate) struct StoredImageProvider {
    pub(crate) api_base: String,
    pub(crate) api_key: String,
    pub(crate) id: String,
    pub(crate) image_model: String,
    pub(crate) name: String,
    pub(crate) preset: String,
    pub(crate) provider_type: String,
}

pub(crate) struct StoredImageModel {
    pub(crate) default_height: u32,
    pub(crate) default_width: u32,
    pub(crate) name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostProcessActionFramesInput {
    pub project_root: String,
    pub character_id: String,
    #[serde(default)]
    pub action_ids: Vec<String>,
    #[serde(default)]
    pub matting_color_space: Option<String>,
    #[serde(default)]
    pub use_magenta_key: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManageCharacterActionTrackInput {
    pub project_root: String,
    pub character_id: String,
    pub action_id: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReextractFilmstripFramesInput {
    pub project_root: String,
    pub character_id: String,
    pub action_id: String,
    #[serde(default)]
    pub cut_positions: Vec<u32>,
}
