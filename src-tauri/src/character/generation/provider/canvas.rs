use std::path::Path;

use crate::character::model::*;
use crate::commands::project_character_generation::{read_project_character_generation, ProjectCharacterGenerationSettings};

pub(crate) fn resolve_project_generation_settings(project_root: &Path) -> ProjectCharacterGenerationSettings {
    read_project_character_generation(project_root).unwrap_or_default()
}

pub(crate) fn resolve_canvas_size(draft: &CharacterWorkshopDraftInput) -> (u32, u32) {
    if draft.size.trim() == "自定义" {
        let width = if draft.custom_width > 0 {
            draft.custom_width.clamp(16, 256)
        } else {
            32
        };
        let height = if draft.custom_height > 0 {
            draft.custom_height.clamp(16, 256)
        } else {
            48
        };

        return (width, height);
    }

    resolve_canvas_size_label(&draft.size)
}

pub(crate) fn resolve_canvas_size_label(size: &str) -> (u32, u32) {
    match size.trim() {
        "48x48" => (48, 48),
        "64x64" => (64, 64),
        "32x48" => (32, 48),
        _ => (32, 48),
    }
}

/// 读取角色记录的目标画布尺寸：优先 processing.canvas，回退到 size 标签，最终回退默认值。
pub(crate) fn record_target_canvas(record: &CharacterAssetRecord) -> (u32, u32) {
    if let Some(processing) = record.processing.as_ref() {
        let width = processing.canvas.width;
        let height = processing.canvas.height;
        if width > 0 && height > 0 {
            return (width, height);
        }
    }
    resolve_canvas_size_label(&record.size)
}

/// 由目标画布尺寸推导出 API 实际请求的生成尺寸：取目标的整数倍，使较长边接近但不超过 1024，
/// 既保证细节，又让后续整数倍降采样到目标分辨率更干净，从根源减少缩放模糊。
pub(crate) fn resolve_api_generation_size(target_width: u32, target_height: u32) -> (u32, u32) {
    let target_width = target_width.clamp(1, 2048);
    let target_height = target_height.clamp(1, 2048);
    let longest = target_width.max(target_height);
    let multiplier = (1024 / longest).max(1);
    let width = (target_width * multiplier).clamp(128, 2048);
    let height = (target_height * multiplier).clamp(128, 2048);
    (width, height)
}

