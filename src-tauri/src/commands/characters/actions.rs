use std::fs;

use image::ImageFormat;

use crate::character::actions::tracks::{
    build_action_frame_image_asset, default_action_track_label, upsert_action_track_frames,
};
use crate::character::actions::{resolve_loop_mode, workflow_post_process_action_frames};
use crate::character::generation::provider::resolve_project_image_path;
use crate::character::workflow::character_record_target_canvas;
use crate::character::model::*;
use crate::character::preview::{attach_character_image_previews, populate_character_image_paths, CharacterPreviewScope};
use crate::character::store::{
    get_character_asset, normalize_cache_segment, upsert_character_database, upsert_character_index,
    validate_character_id, validate_project_root, write_character_record,
};
use crate::storage::database::current_timestamp;

#[tauri::command]
pub fn post_process_action_frames(input: PostProcessActionFramesInput) -> Result<CharacterAssetRecord, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;
    workflow_post_process_action_frames(
        &project_root,
        character_id,
        input.action_ids,
        input.use_magenta_key.unwrap_or(true),
        input.matting_color_space.as_deref().unwrap_or("rgb"),
    )
}

#[tauri::command]
pub fn add_character_action_track(input: ManageCharacterActionTrackInput) -> Result<CharacterAssetRecord, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;
    let action_id = normalize_cache_segment(input.action_id.trim());
    if action_id.is_empty() {
        return Err("动作 ID 不能为空。".to_string());
    }

    let mut record = get_character_asset(input.project_root.clone(), character_id)?;
    if record.actions.iter().any(|track| track.id == action_id) {
        return Err(format!("动作「{action_id}」已存在。"));
    }

    let label = input
        .label
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| default_action_track_label(&action_id).to_string());
    let note = input.note.unwrap_or_default();
    record.actions.push(CharacterActionTrack {
        direction: record.direction.clone(),
        export_ready: false,
        filmstrip_cut_positions: None,
        filmstrip_source: None,
        frames: Vec::new(),
        id: action_id.clone(),
        label,
        loop_mode: resolve_loop_mode(&action_id, "auto"),
        note,
        preview_fps: 12,
        quality_errors: None,
        quality_grade: None,
        quality_score: None,
        quality_warnings: None,
        status: "empty".to_string(),
    });

    let action_directory = project_root
        .join("assets")
        .join("characters")
        .join(&record.id)
        .join("animations")
        .join(&action_id);
    fs::create_dir_all(&action_directory)
        .map_err(|error| format!("创建动作目录失败：{error}"))?;

    record.updated_at = current_timestamp().to_string();
    write_character_record(&project_root, &record)?;
    upsert_character_index(&project_root, &record)?;
    upsert_character_database(&project_root, &record)?;
    attach_character_image_previews(&project_root, &mut record);
    Ok(record)
}

#[tauri::command]
pub fn remove_character_action_track(input: ManageCharacterActionTrackInput) -> Result<CharacterAssetRecord, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;
    let action_id = normalize_cache_segment(input.action_id.trim());
    if action_id.is_empty() {
        return Err("动作 ID 不能为空。".to_string());
    }

    let mut record = get_character_asset(input.project_root.clone(), character_id)?;
    let before = record.actions.len();
    record.actions.retain(|track| track.id != action_id);
    if record.actions.len() == before {
        return Err(format!("找不到动作「{action_id}」。"));
    }

    let action_directory = project_root
        .join("assets")
        .join("characters")
        .join(&record.id)
        .join("animations")
        .join(&action_id);
    if action_directory.exists() {
        fs::remove_dir_all(&action_directory)
            .map_err(|error| format!("删除动作目录失败：{error}"))?;
    }

    record.updated_at = current_timestamp().to_string();
    write_character_record(&project_root, &record)?;
    upsert_character_index(&project_root, &record)?;
    upsert_character_database(&project_root, &record)?;
    attach_character_image_previews(&project_root, &mut record);
    Ok(record)
}

#[tauri::command]
pub fn reextract_filmstrip_frames(
    input: ReextractFilmstripFramesInput,
) -> Result<CharacterAssetRecord, String> {
    use crate::image_pipeline::action_quality::score_action_frames;
    use crate::image_pipeline::segment::{
        extract_filmstrip_frames_with_cuts, ExtractFilmstripOptions,
    };

    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;
    let action_id = input.action_id.trim().to_string();
    if action_id.is_empty() {
        return Err("动作 ID 不能为空。".to_string());
    }

    let mut record = get_character_asset(input.project_root.clone(), character_id)?;
    let action_index = record
        .actions
        .iter()
        .position(|track| track.id == action_id)
        .ok_or_else(|| format!("未找到动作：{action_id}"))?;
    let track = record.actions[action_index].clone();
    let filmstrip_source = track
        .filmstrip_source
        .clone()
        .ok_or_else(|| "当前动作没有可用的 filmstrip 原图。".to_string())?;
    let source_path = resolve_project_image_path(&project_root, &filmstrip_source)?;
    let strip = image::open(&source_path)
        .map_err(|error| format!("读取 filmstrip 原图失败：{error}"))?
        .to_rgba8();
    let frame_total = track.frames.len().max(1);
    let (target_width, target_height) = character_record_target_canvas(&record);
    let preview_fps = track.preview_fps.max(1);
    let loop_mode = track.loop_mode.clone();

    let extraction = extract_filmstrip_frames_with_cuts(
        &strip,
        ExtractFilmstripOptions {
            expected_frame_count: frame_total,
            target_height,
            target_width,
        },
        Some(input.cut_positions),
    )?;
    let report = score_action_frames(&extraction.frames, frame_total);
    let action_directory = project_root
        .join("assets")
        .join("characters")
        .join(&record.id)
        .join("animations")
        .join(&action_id);

    let mut frame_assets = Vec::new();
    for (index, frame) in extraction.frames.iter().enumerate() {
        let file_name = format!("frame_{index:02}.png");
        let output_path = action_directory.join(&file_name);
        frame
            .save_with_format(&output_path, ImageFormat::Png)
            .map_err(|error| format!("写入 filmstrip 动作帧失败：{error}"))?;
        let project_relative_path =
            format!("assets/characters/{}/animations/{action_id}/{file_name}", record.id);
        frame_assets.push(build_action_frame_image_asset(
            &record.id,
            &action_id,
            "shared",
            index as u16,
            &output_path,
            project_relative_path,
            target_width,
            target_height,
        )?);
    }

    upsert_action_track_frames(
        &mut record,
        &action_id,
        &action_id,
        default_action_track_label(&action_id),
        frame_assets,
        frame_total as u16,
        preview_fps,
        &loop_mode,
        Some(report.score),
        Some(report.grade.clone()),
        Some(report.errors.clone()),
        Some(report.warnings.clone()),
        Some(filmstrip_source),
        Some(extraction.cut_positions),
    )?;

    record.updated_at = current_timestamp().to_string();
    write_character_record(&project_root, &record)?;
    upsert_character_index(&project_root, &record)?;
    populate_character_image_paths(&project_root, &mut record, CharacterPreviewScope::ActionFrames);
    Ok(record)
}
