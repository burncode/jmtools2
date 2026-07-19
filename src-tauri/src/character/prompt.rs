use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use crate::character::model::*;
use crate::character::store::normalize_strings;
use crate::commands::project_character_generation::{
    augment_character_prompt,     ProjectCharacterGenerationSettings,
};

pub(crate) fn variant_key_for_record(record: &CharacterAssetRecord) -> Option<&str> {
    let key = record.style_anchor_variant_key.trim();
    if key.is_empty() {
        None
    } else {
        Some(key)
    }
}

pub(crate) fn variant_key_for_draft(draft: &CharacterWorkshopDraftInput) -> Option<&str> {
    let key = draft.style_anchor_variant_key.trim();
    if key.is_empty() {
        None
    } else {
        Some(key)
    }
}

pub(crate) fn load_character_display_name(project_root: &Path, character_id: &str) -> Option<String> {
    let record_path = project_root
        .join("assets")
        .join("characters")
        .join(character_id)
        .join("character.json");
    let content = fs::read_to_string(record_path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&content).ok()?;
    value
        .get("displayName")
        .and_then(|item| item.as_str())
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
}

pub(crate) fn resolve_layout_anchor_suffix(
    project_root: &Path,
    settings: &ProjectCharacterGenerationSettings,
    current_character_id: &str,
) -> String {
    let anchor_id = settings.layout_anchor_character_id.trim();
    if anchor_id.is_empty() || anchor_id == current_character_id {
        return String::new();
    }

    let anchor_name = load_character_display_name(project_root, anchor_id)
        .unwrap_or_else(|| anchor_id.to_string());
    crate::commands::project_character_generation::compose_layout_anchor_suffix(
        settings,
        current_character_id,
        &anchor_name,
    )
}

pub(crate) fn resolve_layout_anchor_reference_bytes(
    project_root: &Path,
    settings: &ProjectCharacterGenerationSettings,
    current_character_id: Option<&str>,
) -> Option<Vec<u8>> {
    let anchor_id = settings.layout_anchor_character_id.trim();
    if anchor_id.is_empty() {
        return None;
    }
    if current_character_id.is_some_and(|id| id == anchor_id) {
        return None;
    }

    let record_path = project_root
        .join("assets")
        .join("characters")
        .join(anchor_id)
        .join("character.json");
    let content = fs::read_to_string(record_path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&content).ok()?;
    let relative_path = value
        .get("masterImage")
        .and_then(|image| image.get("projectRelativePath"))
        .and_then(|path| path.as_str())
        .map(str::trim)
        .filter(|path| !path.is_empty())?;
    let absolute_path = project_root.join(relative_path);
    fs::read(absolute_path).ok()
}

pub(crate) fn build_character_master_image_prompt(
    project_root: &Path,
    record: &CharacterAssetRecord,
) -> String {
    let settings = crate::character::generation::provider::resolve_project_generation_settings(project_root);
    let layout_suffix = resolve_layout_anchor_suffix(project_root, &settings, &record.id);
    let base = format!(
        "为游戏资产管线生成一张透明背景角色母版图。\n角色名称：{}\n角色描述：{}\n像素风格：{}\n画布规格：{}\n方向要求：{}\n视觉关键词：{}\n候选方案重点：{}\n像素提示词：{}\n要求：完整角色、干净轮廓、适合后续切分 Idle/Walk/Attack 动作帧，不要文字、水印、UI 边框。",
        record.display_name,
        record.description,
        record.style,
        record.size,
        record.direction,
        record.visual_keywords.join("，"),
        record.selected_plan_focus,
        record.pixel_prompt
    );
    augment_character_prompt(
        base,
        &settings,
        variant_key_for_record(record),
        None,
        &layout_suffix,
    )
}

pub(crate) fn build_character_candidate_image_prompt(
    project_root: &Path,
    draft: &CharacterWorkshopDraftInput,
    master_plan: &CharacterMasterPlanInput,
    candidate_plan: &CharacterCandidatePlanInput,
    compiled_prompt: Option<&str>,
    character_id: Option<&str>,
) -> String {
    let settings = crate::character::generation::provider::resolve_project_generation_settings(project_root);
    let layout_suffix = character_id
        .map(|id| resolve_layout_anchor_suffix(project_root, &settings, id))
        .unwrap_or_else(|| resolve_layout_anchor_suffix(project_root, &settings, ""));

    let base = if let Some(prompt) = compiled_prompt.map(str::trim).filter(|value| !value.is_empty()) {
        format!(
            "为游戏资产管线生成一张可直接预览的角色母版候选图。\n\
编译视觉提示：{prompt}\n\
候选方案：{}，{}\n\
母版像素提示词：{}\n\
要求：完整单个角色，干净轮廓，适合后续切分 Idle/Walk/Attack 动作帧；不要文字、水印、UI 边框、展示台、复杂场景。",
            candidate_plan.name.trim(),
            candidate_plan.focus.trim(),
            master_plan.pixel_prompt.trim()
        )
    } else {
        format!(
            "为游戏资产管线生成一张可直接预览的角色母版候选图。\n角色名称：{}\n角色描述：{}\n角色定位：{}\n像素风格：{}\n画布规格：{}\n方向规格：{}\n候选数量：{}\n生成质量：{}\n背景要求：{}\n资源组成：{}\n元素配色：{}\n全局色板：{}\n参考图约束：{}\n生成选项：{}\n视觉关键词：{}\n候选方案：{}，{}\n像素提示词：{}\n要求：完整单个角色，干净轮廓，适合后续切分 Idle/Walk/Attack 动作帧；不要文字、水印、UI 边框、展示台、复杂场景。",
            draft.name.trim(),
            draft.description.trim(),
            master_plan.role_positioning.trim(),
            draft.style.trim(),
            format_canvas_spec(draft),
            draft.direction.trim(),
            draft.generation_count.trim(),
            draft.generation_quality.trim(),
            format_background_mode(&draft.background_mode),
            format_selected_resources(draft),
            format_element_colors(&draft.element_colors),
            draft.palette.join("，"),
            format_reference_images(&draft.reference_images),
            draft.generation_options.join("，"),
            master_plan.visual_keywords.join("，"),
            candidate_plan.name.trim(),
            candidate_plan.focus.trim(),
            master_plan.pixel_prompt.trim()
        )
    };

    augment_character_prompt(
        base,
        &settings,
        variant_key_for_draft(draft),
        None,
        &layout_suffix,
    )
}

pub(crate) fn build_character_candidate_turnaround_prompt(
    project_root: &Path,
    draft: &CharacterWorkshopDraftInput,
    master_plan: &CharacterMasterPlanInput,
    candidate_plan: &CharacterCandidatePlanInput,
    compiled_prompt: Option<&str>,
) -> String {
    let settings = crate::character::generation::provider::resolve_project_generation_settings(project_root);
    let layout_suffix = resolve_layout_anchor_suffix(project_root, &settings, "");

    let base = if let Some(prompt) = compiled_prompt.map(str::trim).filter(|value| !value.is_empty()) {
        format!(
            "为游戏角色生成一张 2x2 网格的四方向 turnaround 转身表，背景透明或纯净。\n\
编译视觉提示：{prompt}\n\
候选方案：{}，{}\n\
母版像素提示词：{}\n\
严格布局：左上=正面(front)，右上=背面(back)，左下=左侧(left，90° 纯侧面轮廓)，右下=右侧(right，270° 纯侧面轮廓)。\n\
左下格必须是 90° 侧面视角，禁止与正面相同；右下格必须是另一侧 90° 侧面。\n\
四个格子必须是同一个角色：相同体型、服装、配色、发型与装备，只改变观察角度。\n\
每个格子角色居中、完整、等高、朝向清晰；不要文字、水印、UI 边框、网格说明文字、复杂场景。",
            candidate_plan.name.trim(),
            candidate_plan.focus.trim(),
            master_plan.pixel_prompt.trim()
        )
    } else {
        format!(
            "为游戏角色生成一张 2x2 网格的四方向 turnaround 转身表，背景透明或纯净。\n\
角色名称：{}\n角色描述：{}\n角色定位：{}\n像素风格：{}\n画布规格：{}\n方向规格：{}\n\
候选方案：{}，{}\n视觉关键词：{}\n像素提示词：{}\n\
严格布局：左上=正面(front)，右上=背面(back)，左下=左侧(left，90° 纯侧面轮廓)，右下=右侧(right，270° 纯侧面轮廓)。\n\
左下格必须是 90° 侧面视角，禁止与正面相同；右下格必须是另一侧 90° 侧面。\n\
四个格子必须是同一个角色：相同体型、服装、配色、发型与装备，只改变观察角度。\n\
每个格子角色居中、完整、等高、朝向清晰；不要文字、水印、UI 边框、网格说明文字、复杂场景。",
            draft.name.trim(),
            draft.description.trim(),
            master_plan.role_positioning.trim(),
            draft.style.trim(),
            format_canvas_spec(draft),
            draft.direction.trim(),
            candidate_plan.name.trim(),
            candidate_plan.focus.trim(),
            master_plan.visual_keywords.join("，"),
            master_plan.pixel_prompt.trim()
        )
    };

    augment_character_prompt(
        base,
        &settings,
        variant_key_for_draft(draft),
        None,
        &layout_suffix,
    )
}

pub(crate) fn build_character_view_image_prompt(
    project_root: &Path,
    record: &CharacterAssetRecord,
    view_kind: &str,
    view_label: &str,
) -> String {
    let settings = crate::character::generation::provider::resolve_project_generation_settings(project_root);
    let layout_suffix = resolve_layout_anchor_suffix(project_root, &settings, &record.id);
    let base = format!(
        "参考图是该角色的正面定妆图，请生成同一角色的{view_label}方向视图。\n硬性一致性要求：必须与参考图保持完全相同的角色身份、体型比例、发型发色、面部特征、服装护甲、配色方案、武器与盾牌的款式和比例；唯一允许变化的是观察朝向改为{view_label}方向。禁止换装、换色、换装备或改变风格。\n角色名称：{}\n角色描述：{}\n像素风格：{}\n画布规格：{}\n原方案重点：{}\n视觉关键词：{}\n颜色基调：{}\n母版提示词：{}\n输出要求：单个完整角色，居中站立，透明或纯色背景，轮廓清晰便于后续去背景、切割和动作帧制作；不要文字、水印、UI 边框、展示台、复杂场景、多角色。\n内部视图标识：{}",
        record.display_name,
        record.description,
        record.style,
        record.size,
        record.selected_plan_focus,
        record.visual_keywords.join("，"),
        record.palette.join("，"),
        record.pixel_prompt,
        view_kind
    );
    augment_character_prompt(
        base,
        &settings,
        variant_key_for_record(record),
        None,
        &layout_suffix,
    )
}

pub(crate) fn build_character_dual_reference_view_prompt(
    record: &CharacterAssetRecord,
    view_kind: &str,
    view_label: &str,
) -> String {
    format!(
        "生成同一游戏角色的{view_label}方向视图。\n\
参考图 B（img2img 输入）提供目标姿势、构图与观察朝向；角色身份必须对齐项目中的角色正面定妆（参考图 A 概念）。\n\
硬性一致性：必须与角色正面定妆保持完全相同的身份、体型、发型、服装、配色与装备；姿势与构图对齐参考图 B。\n\
角色名称：{}\n角色描述：{}\n像素风格：{}\n画布规格：{}\n视觉关键词：{}\n母版提示词：{}\n\
输出：单个完整角色，透明或纯色背景，不要文字、水印、多角色。\n内部视图标识：{}",
        record.display_name,
        record.description,
        record.style,
        record.size,
        record.visual_keywords.join("，"),
        record.pixel_prompt,
        view_kind
    )
}

/// 从角色 ID 派生稳定 seed，使同一角色的多视图生成共用同一随机种子。
pub(crate) fn stable_seed_from_id(character_id: &str) -> u64 {
    let mut hash: u64 = 1469598103934665603; // FNV-1a offset basis
    for byte in character_id.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(1099511628211);
    }
    hash
}

pub(crate) fn format_view_kind_label(kind: &str) -> &'static str {
    match kind {
        "front" => "前",
        "back" => "后",
        "left" => "左",
        "right" => "右",
        "frontLeft" => "左前",
        "frontRight" => "右前",
        "backLeft" => "左后",
        "backRight" => "右后",
        "single" => "正面",
        _ => "指定",
    }
}

pub(crate) fn format_selected_resources(draft: &CharacterWorkshopDraftInput) -> String {
    if !draft.appearance_traits.is_empty() {
        return draft
            .appearance_traits
            .iter()
            .map(|trait_item| {
                let colors = normalize_strings(trait_item.colors.clone());
                let color_text = if colors.is_empty() {
                    String::new()
                } else {
                    format!("，色={}", colors.join("/"))
                };

                format!(
                    "[{}] {}：{}{}",
                    trait_item.category.trim(),
                    trait_item.label.trim(),
                    trait_item.prompt.trim(),
                    color_text
                )
            })
            .collect::<Vec<_>>()
            .join("；");
    }

    if draft.selected_resources.is_empty() {
        let tags = normalize_strings(draft.feature_tags.clone());

        if tags.is_empty() {
            return "无额外指定".to_string();
        }

        return tags.join("，");
    }

    draft
        .selected_resources
        .iter()
        .map(|resource| {
            let colors = normalize_strings(resource.colors.clone());
            let color_text = if colors.is_empty() {
                String::new()
            } else {
                format!("，默认色={}", colors.join("/"))
            };

            format!(
                "{}({})：{}{}",
                resource.label.trim(),
                resource.kind.trim(),
                resource.prompt.trim(),
                color_text
            )
        })
        .collect::<Vec<_>>()
        .join("；")
}

pub(crate) fn format_element_colors(element_colors: &BTreeMap<String, Vec<String>>) -> String {
    if element_colors.is_empty() {
        return "未指定".to_string();
    }

    let labels = BTreeMap::from([
        ("armor", "护甲"),
        ("cape", "披风"),
        ("eyes", "眼睛"),
        ("hair", "发型"),
        ("shield", "盾牌"),
        ("skin", "肤色"),
        ("weapon", "武器"),
    ]);
    let values = element_colors
        .iter()
        .filter_map(|(key, colors)| {
            let normalized_colors = normalize_strings(colors.clone());

            if normalized_colors.is_empty() {
                return None;
            }

            let label = labels.get(key.as_str()).copied().unwrap_or(key.as_str());

            Some(format!("{label}={}", normalized_colors.join("/")))
        })
        .collect::<Vec<_>>();

    if values.is_empty() {
        "未指定".to_string()
    } else {
        values.join("；")
    }
}

pub(crate) fn format_canvas_spec(draft: &CharacterWorkshopDraftInput) -> String {
    if draft.size.trim() == "自定义" {
        let width = draft.custom_width.clamp(16, 256);
        let height = draft.custom_height.clamp(16, 256);

        return format!("自定义 {width}x{height}");
    }

    draft.size.trim().to_string()
}

pub(crate) fn build_character_generation_config(
    input: &CreateCharacterAssetInput,
) -> CharacterGenerationConfig {
    CharacterGenerationConfig {
        appearance_traits: input.draft.appearance_traits.clone(),
        archetype_template_id: input.draft.archetype_template_id.clone(),
        generation: CharacterGenerationSettingsSnapshot {
            count: parse_generation_count(&input.draft.generation_count) as u16,
            model: input.model.trim().to_string(),
            negative_prompt: default_character_negative_prompt(),
            options: normalize_strings(input.draft.generation_options.clone()),
            prompt: input.master_plan.pixel_prompt.trim().to_string(),
            provider_name: input.provider_name.trim().to_string(),
            quality: input.draft.generation_quality.trim().to_string(),
            seed: None,
        },
        identity: CharacterGenerationIdentity {
            class_or_occupation: input.draft.identity.class_or_occupation.trim().to_string(),
            entity_type: input.draft.identity.entity_type.trim().to_string(),
            name: input.draft.name.trim().to_string(),
            narrative_tags: normalize_strings(input.draft.identity.narrative_tags.clone()),
            race_or_species: input.draft.identity.race_or_species.trim().to_string(),
            role: input.draft.identity.role.trim().to_string(),
            tags: normalize_strings(input.master_plan.visual_keywords.clone()),
        },
        references: input.draft.reference_images.clone(),
        reference_strength: Some(input.draft.reference_strength),
        style_preset_id: input.draft.style_preset_id.clone(),
        version: 2,
        visual: CharacterGenerationVisual {
            background_mode: input.draft.background_mode.trim().to_string(),
            direction: input.draft.direction.trim().to_string(),
            element_colors: input.draft.element_colors.clone(),
            feature_tags: normalize_strings(input.draft.feature_tags.clone()),
            palette: normalize_strings(input.draft.palette.clone()),
            selected_resources: input.draft.selected_resources.clone(),
            size: input.draft.size.trim().to_string(),
            style: input.draft.style.trim().to_string(),
        },
    }
}

pub(crate) fn build_initial_processing_metadata(
    draft: &CharacterWorkshopDraftInput,
) -> CharacterProcessingMetadata {
    let (width, height) = crate::character::generation::provider::resolve_canvas_size(draft);

    CharacterProcessingMetadata {
        alpha_coverage: None,
        anchor: None,
        anchor_mode: "bottomCenter".to_string(),
        background_removed: false,
        bbox: None,
        canvas: CharacterCanvasSize { height, width },
        foot_line_y: None,
        normalized: false,
        warnings: vec!["尚未进行去背景、锚点和包围盒预检。".to_string()],
    }
}

pub(crate) fn default_character_negative_prompt() -> String {
    "multiple characters, text, watermark, blurry, low quality, extra limbs, inconsistent weapon, complex background".to_string()
}

pub(crate) fn parse_generation_count(value: &str) -> usize {
    value.trim().parse::<usize>().unwrap_or(4).clamp(2, 8)
}

pub(crate) fn parse_workflow_candidate_count(value: &str) -> usize {
    value.trim().parse::<usize>().unwrap_or(2).clamp(1, 4)
}

pub(crate) fn ensure_candidate_plans(
    mut plans: Vec<CharacterCandidatePlanInput>,
    count: usize,
) -> Vec<CharacterCandidatePlanInput> {
    const PLAN_IDS: [&str; 4] = ["A", "B", "C", "D"];

    if plans.is_empty() {
        plans.push(CharacterCandidatePlanInput {
            focus: "默认方案".to_string(),
            id: "A".to_string(),
            master_image: None,
            name: "方案 A".to_string(),
            recommendation_score: 90,
        });
    }

    let base = plans[0].clone();
    while plans.len() < count {
        let index = plans.len();
        let id = PLAN_IDS.get(index).copied().unwrap_or("X");
        plans.push(CharacterCandidatePlanInput {
            focus: format!("{} · {} 变体", base.name, id),
            id: id.to_string(),
            master_image: None,
            name: format!("方案 {}", id),
            recommendation_score: base.recommendation_score.saturating_sub(index as u16 * 5),
        });
    }

    plans.truncate(count);
    plans
}

pub(crate) fn format_reference_images(reference_images: &[CharacterReferenceImageAsset]) -> String {
    if reference_images.is_empty() {
        return "未提供参考图，以文字设定为准。".to_string();
    }

    reference_images
        .iter()
        .take(4)
        .map(|image| {
            format!(
                "{}参考：{}",
                format_reference_role(&image.role),
                image.file_name
            )
        })
        .collect::<Vec<_>>()
        .join("；")
}

pub(crate) fn format_reference_role(role: &str) -> &'static str {
    match role {
        "prop" => "道具",
        "scene" => "场景",
        "pose" => "姿态",
        _ => "角色",
    }
}

pub(crate) fn format_background_mode(background_mode: &str) -> &'static str {
    match background_mode {
        "checker" => "预览可使用棋盘格背景，但主体需要干净边缘。",
        "solid" => "使用纯白或浅色纯净背景，方便检查轮廓。",
        "chroma" => "使用纯绿色抠图背景，主体边缘必须清楚。",
        _ => "优先透明背景，避免复杂场景。",
    }
}

pub(crate) fn build_default_export_profiles(
    draft: &CharacterWorkshopDraftInput,
) -> Vec<CharacterExportProfile> {
    let (frame_width, frame_height) = crate::character::generation::provider::resolve_canvas_size(draft);

    vec![
        CharacterExportProfile {
            fps: 12,
            frame_height,
            frame_width,
            id: "png-sequence-default".to_string(),
            padding: 0,
            spacing: 0,
            target: "png-sequence".to_string(),
            trim: false,
        },
        CharacterExportProfile {
            fps: 12,
            frame_height,
            frame_width,
            id: "spritesheet-default".to_string(),
            padding: 0,
            spacing: 0,
            target: "spritesheet".to_string(),
            trim: false,
        },
    ]
}

