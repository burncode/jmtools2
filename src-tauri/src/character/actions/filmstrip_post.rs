use std::fs;
use std::path::Path;

use crate::character::generation::provider::resolve_project_image_path;
use crate::character::model::*;
use crate::character::preview::attach_character_image_previews;
use crate::character::store::*;
use crate::character::workflow::character_record_target_canvas;
use crate::storage::database::current_timestamp;

pub(crate) fn workflow_post_process_action_frames(
    project_root: &Path,
    character_id: String,
    action_ids: Vec<String>,
    use_magenta_key: bool,
    matting_color_space: &str,
) -> Result<CharacterAssetRecord, String> {
    use crate::image_pipeline::action_quality::score_action_frames;
    use crate::image_pipeline::background_removal::{
        remove_background_from_image_bytes, ProceduralBackgroundRemovalOptions,
    };
    use crate::image_pipeline::color_space::MattingColorSpace;
    use crate::image_pipeline::segment::{align_frame_centroid, remove_magenta_chroma_key};

    let character_id = validate_character_id(&character_id)?;
    let mut record = get_character_asset(
        project_root.to_string_lossy().to_string(),
        character_id.clone(),
    )?;
    let (target_width, target_height) = character_record_target_canvas(&record);
    let color_space = if matting_color_space.eq_ignore_ascii_case("ycbcr") {
        MattingColorSpace::YCbCr
    } else {
        MattingColorSpace::Rgb
    };

    let cleaned_action_ids: Vec<String> = if action_ids.is_empty() {
        record.actions.iter().map(|track| track.id.clone()).collect()
    } else {
        action_ids
            .into_iter()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .collect()
    };

    if cleaned_action_ids.is_empty() {
        return Err("没有可后处理的动作轨道。".to_string());
    }

    for action_id in cleaned_action_ids {
        let action_index = record
            .actions
            .iter()
            .position(|track| track.id == action_id)
            .ok_or_else(|| format!("找不到动作「{action_id}」。"))?;
        let frame_count = record.actions[action_index].frames.len();
        if frame_count == 0 {
            continue;
        }

        let mut rgba_frames = Vec::with_capacity(frame_count);
        for frame_index in 0..frame_count {
            let frame_image = record.actions[action_index].frames[frame_index]
                .image
                .clone()
                .ok_or_else(|| format!("动作「{action_id}」第 {} 帧缺少图片。", frame_index + 1))?;
            let source_path = resolve_project_image_path(project_root, &frame_image)?;
            let source_bytes =
                fs::read(&source_path).map_err(|error| format!("读取动作帧失败：{error}"))?;
            let mut rgba = image::load_from_memory(&source_bytes)
                .map_err(|error| format!("解析动作帧失败：{error}"))?
                .to_rgba8();

            if use_magenta_key {
                rgba = remove_magenta_chroma_key(&rgba, 48);
            } else {
                let removal = remove_background_from_image_bytes(
                    &source_bytes,
                    ProceduralBackgroundRemovalOptions {
                        matting_color_space: color_space,
                        manual_background_samples: vec![[255, 0, 255]],
                        ..ProceduralBackgroundRemovalOptions::default()
                    },
                )?;
                rgba = image::load_from_memory(&removal.png_bytes)
                    .map_err(|error| format!("解析去背景结果失败：{error}"))?
                    .to_rgba8();
            }

            rgba = align_frame_centroid(&rgba, target_width, target_height);
            rgba.save(&source_path)
                .map_err(|error| format!("写入动作帧失败：{error}"))?;
            record.actions[action_index].frames[frame_index].image = Some(CharacterImageAsset {
                absolute_path: source_path.to_string_lossy().to_string(),
                data_url: String::new(),
                height: target_height,
                id: frame_image.id,
                project_relative_path: frame_image.project_relative_path,
                role: "action-frame".to_string(),
                source: "action-frame-post-process".to_string(),
                width: target_width,
            });
            rgba_frames.push(rgba);
        }

        let report = score_action_frames(&rgba_frames, frame_count);
        record.actions[action_index].quality_score = Some(report.score);
        record.actions[action_index].quality_grade = Some(report.grade.clone());
        record.actions[action_index].quality_errors = Some(report.errors.clone());
        record.actions[action_index].quality_warnings = Some(report.warnings.clone());
        record.actions[action_index].export_ready = report.errors.is_empty() && report.score >= 70;
        record.actions[action_index].status = "generated".to_string();
    }

    record.updated_at = current_timestamp().to_string();
    write_character_record(project_root, &record)?;
    upsert_character_index(project_root, &record)?;
    upsert_character_database(project_root, &record)?;
    attach_character_image_previews(project_root, &mut record);
    Ok(record)
}

