use std::fs;
use std::path::Path;
use std::thread;
use std::time::Duration;

use image::{ImageFormat, RgbaImage};

use tauri::AppHandle;

use crate::character::actions::tracks::{build_action_frame_image_asset, default_action_track_label, upsert_action_track_frames};
use crate::character::generation::provider::{download_generated_image, request_character_view_image_url, resolve_project_image_path};
use crate::character::model::*;
use crate::character::prompt::stable_seed_from_id;
use crate::character::workflow::character_record_target_canvas;

use super::filmstrip_prompt::{action_suggestion_for, build_filmstrip_action_prompt, ActionFrameContext, ActionFrameGenerationOptions};

pub(crate) fn generate_filmstrip_frames_for_master(
    app: &AppHandle,
    project_root: &Path,
    ai: &ActionFrameContext,
    record: &mut CharacterAssetRecord,
    action_id: &str,
    frame_count: u16,
    preview_fps: u16,
    loop_mode: &str,
    generation_options: &ActionFrameGenerationOptions,
) -> Result<(), String> {
    use crate::image_pipeline::action_quality::{build_corrective_hint, score_action_frames};
    use crate::image_pipeline::segment::{
        extract_filmstrip_frames_with_cuts, ExtractFilmstripOptions,
    };

    let master_image = record
        .master_image
        .clone()
        .ok_or_else(|| "filmstrip 动作帧生成需要已有母版图。".to_string())?;
    let source_path = resolve_project_image_path(project_root, &master_image)?;
    let reference_bytes =
        fs::read(&source_path).map_err(|error| format!("读取动作帧参考图失败：{error}"))?;
    let action_directory = project_root
        .join("assets")
        .join("characters")
        .join(&record.id)
        .join("animations")
        .join(action_id);
    fs::create_dir_all(&action_directory)
        .map_err(|error| format!("创建动作帧目录失败：{error}"))?;

    let frame_total = frame_count.max(1);
    let suggestion = action_suggestion_for(record, action_id);
    let motion_prompt = generation_options
        .motion_prompt
        .as_deref()
        .unwrap_or("")
        .trim();
    let user_feedback = generation_options
        .user_feedback
        .as_deref()
        .unwrap_or("")
        .trim();
    let max_retries = generation_options.max_retries.unwrap_or(3).max(1);
    let (target_width, target_height) = character_record_target_canvas(record);

    let mut best_cuts: Option<Vec<u32>> = None;
    let mut best_strip: Option<RgbaImage> = None;
    let mut best_frames: Option<Vec<RgbaImage>> = None;
    let mut best_report = None;
    let mut best_score = 0_u16;
    let mut corrective_hint = String::new();

    for attempt in 0..max_retries {
        let prompt = build_filmstrip_action_prompt(
            project_root,
            record,
            action_id,
            "single",
            frame_total,
            suggestion,
            motion_prompt,
            user_feedback,
            &corrective_hint,
        );
        let frame_seed = stable_seed_from_id(&record.id)
            .wrapping_add(stable_seed_from_id(action_id))
            .wrapping_add(u64::from(attempt).wrapping_mul(0x9E37_79B1));
        let image_url = request_character_view_image_url(
            Some(app),
            &ai.provider,
            &ai.model,
            &prompt,
            Some(&reference_bytes),
            Some(frame_seed),
            None,
            Some(ai.gen_size),
        )?;
        let image_bytes = download_generated_image(&image_url)?;
        let strip = image::load_from_memory(&image_bytes)
            .map_err(|error| format!("解析 filmstrip 图像失败：{error}"))?
            .to_rgba8();
        let extraction = extract_filmstrip_frames_with_cuts(
            &strip,
            ExtractFilmstripOptions {
                expected_frame_count: frame_total as usize,
                target_height,
                target_width,
            },
            None,
        )?;
        let frames = extraction.frames;
        let report = score_action_frames(&frames, frame_total as usize);
        if report.score >= best_score {
            best_score = report.score;
            best_frames = Some(frames);
            best_cuts = Some(extraction.cut_positions);
            best_strip = Some(strip);
            best_report = Some(report.clone());
        }
        if report.score >= 85 {
            break;
        }
        corrective_hint = build_corrective_hint(&report);
        if ai.provider.preset == "qwen" && attempt + 1 < max_retries {
            thread::sleep(Duration::from_millis(1800));
        }
    }

    let frames = best_frames.ok_or_else(|| "filmstrip 动作帧生成失败：未得到有效帧。".to_string())?;
    let report = best_report.ok_or_else(|| "filmstrip 动作帧生成失败：缺少质量报告。".to_string())?;
    let cut_positions = best_cuts.unwrap_or_default();
    let filmstrip_source = if let Some(strip) = best_strip {
        let source_file = action_directory.join("filmstrip_source.png");
        strip
            .save_with_format(&source_file, ImageFormat::Png)
            .map_err(|error| format!("保存 filmstrip 原图失败：{error}"))?;
        let project_relative_path = format!(
            "assets/characters/{}/animations/{action_id}/filmstrip_source.png",
            record.id
        );
        Some(build_action_frame_image_asset(
            &record.id,
            action_id,
            "shared",
            0,
            &source_file,
            project_relative_path,
            strip.width(),
            strip.height(),
        )?)
    } else {
        None
    };

    let mut frame_assets = Vec::with_capacity(frames.len());
    for (index, frame) in frames.iter().enumerate() {
        let file_name = format!("frame_{index:02}.png");
        let output_path = action_directory.join(&file_name);
        frame
            .save_with_format(&output_path, ImageFormat::Png)
            .map_err(|error| format!("写入 filmstrip 动作帧失败：{error}"))?;
        let project_relative_path =
            format!("assets/characters/{}/animations/{action_id}/{file_name}", record.id);
        frame_assets.push(build_action_frame_image_asset(
            &record.id,
            action_id,
            "shared",
            index as u16,
            &output_path,
            project_relative_path,
            target_width,
            target_height,
        )?);
    }

    upsert_action_track_frames(
        record,
        action_id,
        action_id,
        default_action_track_label(action_id),
        frame_assets,
        frame_count,
        preview_fps,
        loop_mode,
        Some(report.score),
        Some(report.grade.clone()),
        Some(report.errors.clone()),
        Some(report.warnings.clone()),
        filmstrip_source,
        if cut_positions.is_empty() {
            None
        } else {
            Some(cut_positions)
        },
    )
}


