use std::path::Path;

use crate::character::generation::provider::{StoredImageModel, StoredImageProvider};
use crate::character::model::*;
use crate::character::actions::tracks::{default_action_track_label, is_key_frame};
use crate::character::prompt::{format_view_kind_label, resolve_layout_anchor_suffix, variant_key_for_record};
use crate::commands::project_character_generation::augment_character_prompt;

/// 动作帧生成所需的 AI 上下文（服务商、模型、生成尺寸），由调用方一次性解析后透传到逐帧生成。
pub(crate) struct ActionFrameContext {
    pub provider: StoredImageProvider,
    pub model: StoredImageModel,
    pub gen_size: (u32, u32),
}

pub(crate) struct ActionFrameGenerationOptions {
    pub generation_mode: Option<String>,
    pub max_retries: Option<u16>,
    pub motion_prompt: Option<String>,
    pub pose_reference_png: Option<Vec<u8>>,
    pub reference_mode: Option<String>,
    pub reference_strength: Option<f64>,
    pub user_feedback: Option<String>,
}

pub(super) fn build_filmstrip_action_prompt(
    project_root: &Path,
    record: &CharacterAssetRecord,
    action_id: &str,
    view_kind: &str,
    frame_total: u16,
    suggestion: &str,
    motion_prompt: &str,
    user_feedback: &str,
    corrective_hint: &str,
) -> String {
    let suggestion_line = if suggestion.trim().is_empty() {
        String::new()
    } else {
        format!("\n动作要点：{suggestion}")
    };
    let motion_line = if motion_prompt.is_empty() {
        String::new()
    } else {
        format!("\n动作预设：{motion_prompt}")
    };
    let feedback_line = if user_feedback.is_empty() {
        String::new()
    } else {
        format!("\n用户反馈：{user_feedback}")
    };
    let corrective_line = if corrective_hint.is_empty() {
        String::new()
    } else {
        format!("\n修正要求：{corrective_hint}")
    };

    let settings = crate::character::generation::provider::resolve_project_generation_settings(project_root);
    let layout_suffix = resolve_layout_anchor_suffix(project_root, &settings, &record.id);
    let base = format!(
        "Generate a horizontal animation filmstrip for a game character.\n\
Output exactly {frame_total} full-body poses in equal-width columns from left to right on one image.\n\
Use a solid chroma-key magenta background (#FF00FF), no text, no watermark, no UI frame.\n\
Keep the same character identity, outfit, palette and proportions across all columns.\n\
Action: {action}\n角色名称：{name}\n像素风格：{style}\n画布规格：{size}\n观察方向：{direction}\n\
视觉关键词：{keywords}\n像素提示词：{pixel}{suggestion_line}{motion_line}{feedback_line}{corrective_line}\n\
Each column must show a distinct phase of the {action} loop with clear gutters between columns.",
        action = default_action_track_label(action_id),
        name = record.display_name,
        style = record.style,
        size = record.size,
        direction = format_view_kind_label(view_kind),
        keywords = record.visual_keywords.join("，"),
        pixel = record.pixel_prompt,
    );
    augment_character_prompt(
        base,
        &settings,
        variant_key_for_record(record),
        Some(action_id),
        &layout_suffix,
    )
}

/// 读取角色记录中对应动作的文字建议，用于逐帧提示词。无对应建议时返回空串。
pub(super) fn action_suggestion_for<'a>(record: &'a CharacterAssetRecord, action_id: &str) -> &'a str {
    match action_id {
        "walk" => record.action_suggestions.walk.as_str(),
        "attack" => record.action_suggestions.attack.as_str(),
        "idle" => record.action_suggestions.idle.as_str(),
        _ => "",
    }
}

pub(super) fn build_character_action_frame_prompt(
    record: &CharacterAssetRecord,
    action_id: &str,
    view_kind: &str,
    frame_index: u16,
    frame_total: u16,
    suggestion: &str,
) -> String {
    let suggestion_line = if suggestion.trim().is_empty() {
        String::new()
    } else {
        format!("\n动作要点：{suggestion}")
    };
    format!(
        "为游戏角色生成 {action} 动作序列中的一帧，透明背景。\n\
角色名称：{name}\n像素风格：{style}\n画布规格：{size}\n观察方向：{direction}\n\
视觉关键词：{keywords}\n像素提示词：{pixel}{suggestion_line}\n\
这是 {action} 循环的第 {current}/{total} 帧（{phase}）；相邻帧之间保持自然的姿态过渡。\n\
严格保持与参考图同一角色：相同体型、服装、配色、发型与装备，仅改变动作姿态。\n\
不要文字、水印、UI 边框、多个角色或复杂背景。",
        action = default_action_track_label(action_id),
        name = record.display_name,
        style = record.style,
        size = record.size,
        direction = format_view_kind_label(view_kind),
        keywords = record.visual_keywords.join("，"),
        pixel = record.pixel_prompt,
        suggestion_line = suggestion_line,
        current = frame_index + 1,
        total = frame_total,
        phase = if is_key_frame(frame_index, frame_total) {
            "关键帧"
        } else {
            "过渡帧"
        },
    )
}

pub(super) fn build_character_dual_reference_action_frame_prompt(
    record: &CharacterAssetRecord,
    action_id: &str,
    view_kind: &str,
    frame_index: u16,
    frame_total: u16,
    suggestion: &str,
) -> String {
    format!(
        "{base}\n\
参考图 B（img2img 输入）提供目标动作姿态与节奏；角色身份必须对齐角色视图参考（参考图 A 概念）。\n\
严格保持角色 A 的体型、服装、配色与装备，仅让动作姿态对齐参考图 B。",
        base = build_character_action_frame_prompt(
            record,
            action_id,
            view_kind,
            frame_index,
            frame_total,
            suggestion,
        )
    )
}

/// 根据动作类型与循环模式解析最终循环方式。auto：攻击/死亡为单次，其余循环。
pub(crate) fn resolve_loop_mode(action_id: &str, loop_mode: &str) -> String {
    match loop_mode {
        "loop" => "loop".to_string(),
        "once" => "once".to_string(),
        _ => {
            if matches!(action_id, "attack" | "death") {
                "once".to_string()
            } else {
                "loop".to_string()
            }
        }
    }
}
