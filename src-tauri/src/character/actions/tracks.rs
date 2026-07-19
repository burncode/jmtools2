use std::path::Path;

use crate::character::model::*;

pub(crate) fn build_default_action_tracks(
    suggestions: &CharacterActionSuggestions,
    direction: &str,
    character_id: &str,
) -> Vec<CharacterActionTrack> {
    vec![
        build_default_action_track(
            "idle",
            "Idle 待机",
            &suggestions.idle,
            "draft",
            "loop",
            direction,
            character_id,
        ),
        build_default_action_track(
            "walk",
            "Walk 行走",
            &suggestions.walk,
            "empty",
            "loop",
            direction,
            character_id,
        ),
        build_default_action_track(
            "attack",
            "Attack 攻击",
            &suggestions.attack,
            "empty",
            "once",
            direction,
            character_id,
        ),
    ]
}

pub(crate) fn build_default_action_track(
    action_id: &str,
    label: &str,
    note: &str,
    status: &str,
    loop_mode: &str,
    direction: &str,
    character_id: &str,
) -> CharacterActionTrack {
    let preview_fps = 12;

    CharacterActionTrack {
        direction: direction.to_string(),
        export_ready: false,
        filmstrip_cut_positions: None,
        filmstrip_source: None,
        frames: build_placeholder_frames(action_id, character_id, preview_fps),
        id: action_id.to_string(),
        label: label.to_string(),
        loop_mode: loop_mode.to_string(),
        note: note.trim().to_string(),
        preview_fps,
        quality_errors: None,
        quality_grade: None,
        quality_score: None,
        quality_warnings: None,
        status: status.to_string(),
    }
}

pub(crate) fn build_placeholder_frames(
    action_id: &str,
    character_id: &str,
    preview_fps: u16,
) -> Vec<CharacterActionFrame> {
    let frame_count = if action_id == "attack" { 6 } else { 8 };
    let duration_ms = 1000_u16.saturating_div(preview_fps.max(1));

    (0..frame_count)
        .map(|index| CharacterActionFrame {
            duration_ms,
            id: format!("{character_id}-{action_id}-placeholder-frame-{}", index + 1),
            image: None,
            index,
            label: format!("{} {:02}", default_action_short_label(action_id), index + 1),
            source: "placeholder".to_string(),
            status: if is_key_frame(index, frame_count) {
                "key".to_string()
            } else {
                "inbetween".to_string()
            },
        })
        .collect()
}

pub(crate) fn default_action_short_label(action_id: &str) -> &str {
    match action_id {
        "walk" => "Walk",
        "attack" => "Attack",
        _ => "Idle",
    }
}

pub(crate) fn is_key_frame(index: u16, frame_count: u16) -> bool {
    index == 0 || index == frame_count / 2 || index == frame_count.saturating_sub(1)
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

pub(crate) fn pick_view_source_image<'a>(
    view: &'a CharacterViewAsset,
    master_image: Option<&'a CharacterImageAsset>,
) -> Option<&'a CharacterImageAsset> {
    view.normalized_image
        .as_ref()
        .or(view.transparent_image.as_ref())
        .or(view.raw_image.as_ref())
        .or(master_image)
}

pub(crate) fn default_action_track_label(action_id: &str) -> &str {
    match action_id {
        "walk" => "Walk 行走",
        "attack" => "Attack 攻击",
        _ => "Idle 待机",
    }
}

pub(crate) fn build_action_frame_image_asset(
    character_id: &str,
    action_id: &str,
    view_kind: &str,
    index: u16,
    output_path: &Path,
    project_relative_path: String,
    width: u32,
    height: u32,
) -> Result<CharacterImageAsset, String> {
    Ok(CharacterImageAsset {
        absolute_path: output_path.to_string_lossy().to_string(),
        data_url: String::new(),
        height,
        id: format!("{character_id}-{action_id}-{view_kind}-frame-{index:02}"),
        project_relative_path,
        role: "action-frame".to_string(),
        source: "workflow-generate-action-frames".to_string(),
        width,
    })
}

pub(crate) fn upsert_action_track_frames(
    record: &mut CharacterAssetRecord,
    track_id: &str,
    action_id: &str,
    track_label: &str,
    frame_assets: Vec<CharacterImageAsset>,
    frame_count: u16,
    preview_fps: u16,
    loop_mode: &str,
    quality_score: Option<u16>,
    quality_grade: Option<String>,
    quality_errors: Option<Vec<String>>,
    quality_warnings: Option<Vec<String>>,
    filmstrip_source: Option<CharacterImageAsset>,
    filmstrip_cut_positions: Option<Vec<u32>>,
) -> Result<(), String> {
    let preview_fps = preview_fps.clamp(1, 60);
    let resolved_loop_mode = resolve_loop_mode(action_id, loop_mode);
    let duration_ms = 1000_u16.saturating_div(preview_fps.max(1));
    let frames = frame_assets
        .into_iter()
        .enumerate()
        .map(|(index, image)| CharacterActionFrame {
            duration_ms,
            id: format!("{}-frame-{index:02}", track_id),
            image: Some(image),
            index: index as u16,
            label: format!("{} {:02}", default_action_short_label(action_id), index + 1),
            source: "workflow-generate-action-frames".to_string(),
            status: if is_key_frame(index as u16, frame_count) {
                "key".to_string()
            } else {
                "inbetween".to_string()
            },
        })
        .collect::<Vec<_>>();

    if let Some(action) = record.actions.iter_mut().find(|track| track.id == track_id) {
        action.label = track_label.to_string();
        action.frames = frames;
        action.status = "generated".to_string();
        action.export_ready = false;
        action.preview_fps = preview_fps;
        action.loop_mode = resolved_loop_mode;
        action.quality_score = quality_score;
        action.quality_grade = quality_grade;
        action.quality_errors = quality_errors;
        action.quality_warnings = quality_warnings;
        if filmstrip_source.is_some() {
            action.filmstrip_source = filmstrip_source;
        }
        if filmstrip_cut_positions.is_some() {
            action.filmstrip_cut_positions = filmstrip_cut_positions;
        }
        return Ok(());
    }

    record.actions.push(CharacterActionTrack {
        direction: record.direction.clone(),
        export_ready: false,
        filmstrip_cut_positions,
        filmstrip_source,
        frames,
        id: track_id.to_string(),
        label: track_label.to_string(),
        loop_mode: resolved_loop_mode,
        note: String::new(),
        preview_fps,
        quality_errors,
        quality_grade,
        quality_score,
        quality_warnings,
        status: "generated".to_string(),
    });

    Ok(())
}
