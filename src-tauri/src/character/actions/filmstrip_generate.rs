use std::fs;
use std::path::Path;
use std::thread;
use std::time::Duration;

use tauri::AppHandle;

use crate::character::actions::tracks::{
    build_action_frame_image_asset, default_action_track_label, pick_view_source_image,
    upsert_action_track_frames,
};
use crate::character::generation::provider::*;
use crate::character::generation::settings::*;
use crate::character::model::*;
use crate::character::preview::attach_character_image_previews;
use crate::character::prompt::{format_view_kind_label, stable_seed_from_id};
use crate::character::store::*;
use crate::storage::database::{
    current_timestamp, ensure_ai_schema, ensure_app_settings_schema, open_app_database,
};

use super::filmstrip_prompt::{
    action_suggestion_for, build_character_action_frame_prompt,
    build_character_dual_reference_action_frame_prompt, ActionFrameContext,
    ActionFrameGenerationOptions,
};

use super::filmstrip_filmstrip::generate_filmstrip_frames_for_master;

pub(crate) fn workflow_generate_action_frames(
    app: &AppHandle,
    project_root: &Path,
    character_id: String,
    action_ids: Vec<String>,
    frame_count: u16,
    all_views: bool,
    view_kind: Option<String>,
    preview_fps: u16,
    loop_mode: &str,
    generation_options: ActionFrameGenerationOptions,
) -> Result<CharacterAssetRecord, String> {
    let mut record = get_character_asset(
        project_root.to_string_lossy().to_string(),
        character_id.clone(),
    )?;

    let app_connection = open_app_database(app)?;
    ensure_ai_schema(&app_connection)?;
    ensure_app_settings_schema(&app_connection)?;
    let settings = load_character_generation_settings(&app_connection)?;
    validate_character_generation_settings(&settings)?;
    // 动作帧基于视图参考图做 img2img，使用图像编辑绑定（未单独配置时回退角色生成模型）。
    let (provider, model) = resolve_character_edit_binding(&app_connection, &settings)?;
    let (target_width, target_height) = record_target_canvas(&record);
    let ai = ActionFrameContext {
        provider,
        model,
        gen_size: resolve_api_generation_size(target_width, target_height),
    };

    let action_ids: Vec<String> = {
        let cleaned: Vec<String> = action_ids
            .into_iter()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .collect();
        if cleaned.is_empty() {
            vec!["idle".to_string()]
        } else {
            cleaned
        }
    };

    for action_id in &action_ids {
        if all_views {
            generate_action_frames_for_all_views(
                app,
                project_root,
                &ai,
                &mut record,
                action_id,
                frame_count,
                preview_fps,
                loop_mode,
                &generation_options,
            )?;
        } else if let Some(kind) = view_kind
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty() && *value != "default")
        {
            generate_action_frames_for_view_kind(
                app,
                project_root,
                &ai,
                &mut record,
                action_id,
                kind,
                frame_count,
                preview_fps,
                loop_mode,
                &generation_options,
            )?;
        } else {
            generate_action_frames_for_master(
                app,
                project_root,
                &ai,
                &mut record,
                action_id,
                frame_count,
                preview_fps,
                loop_mode,
                &generation_options,
            )?;
        }
    }

    record.updated_at = current_timestamp().to_string();
    write_character_record(project_root, &record)?;
    upsert_character_index(project_root, &record)?;
    upsert_character_database(project_root, &record)?;
    attach_character_image_previews(project_root, &mut record);
    Ok(record)
}

fn generate_action_frames_for_master(
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
    let generation_mode = generation_options
        .generation_mode
        .as_deref()
        .unwrap_or("filmstrip");
    if generation_mode == "filmstrip" {
        return generate_filmstrip_frames_for_master(
            app,
            project_root,
            ai,
            record,
            action_id,
            frame_count,
            preview_fps,
            loop_mode,
            generation_options,
        );
    }

    let master_image = record
        .master_image
        .clone()
        .ok_or_else(|| "动作帧生成需要已有母版图。".to_string())?;
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
    let mut frame_assets = Vec::with_capacity(frame_total as usize);
    let suggestion = action_suggestion_for(record, action_id).to_string();

    for index in 0..frame_total {
        let file_name = format!("frame_{index:02}.png");
        let output_path = action_directory.join(&file_name);
        generate_single_action_frame(
            Some(app),
            ai,
            record,
            action_id,
            "single",
            index,
            frame_total,
            &suggestion,
            &reference_bytes,
            &output_path,
            index + 1 < frame_total,
            generation_options,
        )?;
        let project_relative_path =
            format!("assets/characters/{}/animations/{action_id}/{file_name}", record.id);
        frame_assets.push(build_action_frame_image_asset(
            &record.id,
            action_id,
            "shared",
            index,
            &output_path,
            project_relative_path,
            ai.gen_size.0,
            ai.gen_size.1,
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
        None,
        None,
        None,
        None,
        None,
        None,
    )
}

fn generate_action_frames_for_view_kind(
    app: &AppHandle,
    project_root: &Path,
    ai: &ActionFrameContext,
    record: &mut CharacterAssetRecord,
    action_id: &str,
    view_kind: &str,
    frame_count: u16,
    preview_fps: u16,
    loop_mode: &str,
    generation_options: &ActionFrameGenerationOptions,
) -> Result<(), String> {
    let view = record
        .views
        .iter()
        .find(|item| item.kind == view_kind)
        .cloned()
        .ok_or_else(|| format!("未找到视图方向：{view_kind}"))?;

    let master_image = record.master_image.clone();
    let Some(source) = pick_view_source_image(&view, master_image.as_ref()) else {
        return Err(format!("视图 {view_kind} 缺少可用参考图。"));
    };
    let source_path = resolve_project_image_path(project_root, source)?;
    let reference_bytes =
        fs::read(&source_path).map_err(|error| format!("读取动作帧参考图失败：{error}"))?;

    let frame_total = frame_count.max(1);
    let suggestion = action_suggestion_for(record, action_id).to_string();
    let action_directory = project_root
        .join("assets")
        .join("characters")
        .join(&record.id)
        .join("animations")
        .join(action_id)
        .join(view_kind);
    fs::create_dir_all(&action_directory)
        .map_err(|error| format!("创建动作帧目录失败：{error}"))?;

    let mut frame_assets = Vec::with_capacity(frame_total as usize);
    for index in 0..frame_total {
        let file_name = format!("frame_{index:02}.png");
        let output_path = action_directory.join(&file_name);
        generate_single_action_frame(
            Some(app),
            ai,
            record,
            action_id,
            view_kind,
            index,
            frame_total,
            &suggestion,
            &reference_bytes,
            &output_path,
            index + 1 < frame_total,
            generation_options,
        )?;
        let project_relative_path = format!(
            "assets/characters/{}/animations/{action_id}/{view_kind}/{file_name}",
            record.id
        );
        frame_assets.push(build_action_frame_image_asset(
            &record.id,
            action_id,
            view_kind,
            index,
            &output_path,
            project_relative_path,
            ai.gen_size.0,
            ai.gen_size.1,
        )?);
    }

    let track_id = format!("{action_id}-{view_kind}");
    let track_label = format!(
        "{} · {}",
        default_action_track_label(action_id),
        format_view_kind_label(view_kind)
    );
    upsert_action_track_frames(
        record,
        &track_id,
        action_id,
        &track_label,
        frame_assets,
        frame_count,
        preview_fps,
        loop_mode,
        None,
        None,
        None,
        None,
        None,
        None,
    )
}

fn generate_action_frames_for_all_views(
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
    if record.views.is_empty() {
        return Err("动作帧生成需要已有角色视图。".to_string());
    }

    let master_image = record.master_image.clone();
    let frame_total = frame_count.max(1);
    let suggestion = action_suggestion_for(record, action_id).to_string();
    let mut generated_any = false;

    for view in record.views.clone() {
        let Some(source) = pick_view_source_image(&view, master_image.as_ref()) else {
            continue;
        };
        let source_path = resolve_project_image_path(project_root, source)?;
        let reference_bytes =
            fs::read(&source_path).map_err(|error| format!("读取动作帧参考图失败：{error}"))?;
        let view_kind = view.kind.clone();
        let action_directory = project_root
            .join("assets")
            .join("characters")
            .join(&record.id)
            .join("animations")
            .join(action_id)
            .join(&view_kind);
        fs::create_dir_all(&action_directory)
            .map_err(|error| format!("创建动作帧目录失败：{error}"))?;

        let mut frame_assets = Vec::with_capacity(frame_total as usize);
        for index in 0..frame_total {
            let file_name = format!("frame_{index:02}.png");
            let output_path = action_directory.join(&file_name);
            generate_single_action_frame(
                Some(app),
                ai,
                record,
                action_id,
                &view_kind,
                index,
                frame_total,
                &suggestion,
                &reference_bytes,
                &output_path,
                index + 1 < frame_total,
                generation_options,
            )?;
            let project_relative_path = format!(
                "assets/characters/{}/animations/{action_id}/{view_kind}/{file_name}",
                record.id
            );
            frame_assets.push(build_action_frame_image_asset(
                &record.id,
                action_id,
                &view_kind,
                index,
                &output_path,
                project_relative_path,
                ai.gen_size.0,
                ai.gen_size.1,
            )?);
        }

        let track_id = format!("{action_id}-{view_kind}");
        let track_label = format!(
            "{} · {}",
            default_action_track_label(action_id),
            format_view_kind_label(&view_kind)
        );
        upsert_action_track_frames(
            record,
            &track_id,
            action_id,
            &track_label,
            frame_assets,
            frame_count,
            preview_fps,
            loop_mode,
            None,
            None,
            None,
            None,
            None,
            None,
        )?;
        generated_any = true;
    }

    if !generated_any {
        return Err("动作帧生成需要至少一个可用视图图片。".to_string());
    }

    Ok(())
}

/// 逐帧 img2img：以源图为参考，按帧序构建提示词与派生 seed 生成单帧，并写盘。
#[allow(clippy::too_many_arguments)]
fn generate_single_action_frame(
    app: Option<&AppHandle>,
    ai: &ActionFrameContext,
    record: &CharacterAssetRecord,
    action_id: &str,
    view_kind: &str,
    frame_index: u16,
    frame_total: u16,
    suggestion: &str,
    identity_reference_bytes: &[u8],
    output_path: &Path,
    sleep_after: bool,
    generation_options: &ActionFrameGenerationOptions,
) -> Result<(), String> {
    let dual_reference = generation_options.reference_mode.as_deref() == Some("dualReference")
        && generation_options
            .pose_reference_png
            .as_ref()
            .is_some_and(|bytes| !bytes.is_empty());
    let img2img_bytes = if dual_reference {
        generation_options.pose_reference_png.as_deref().unwrap()
    } else {
        identity_reference_bytes
    };
    let prompt = if dual_reference {
        build_character_dual_reference_action_frame_prompt(
            record,
            action_id,
            view_kind,
            frame_index,
            frame_total,
            suggestion,
        )
    } else {
        build_character_action_frame_prompt(
            record,
            action_id,
            view_kind,
            frame_index,
            frame_total,
            suggestion,
        )
    };
    // 同一角色+动作+帧序派生稳定 seed：重跑可复现，同时各帧之间产生姿态差异。
    let frame_seed = stable_seed_from_id(&record.id)
        .wrapping_add(stable_seed_from_id(action_id))
        .wrapping_add(u64::from(frame_index).wrapping_mul(0x9E37_79B1));

    let reference_strength = if dual_reference {
        generation_options.reference_strength
    } else {
        None
    };

    let image_url = request_character_view_image_url(
        app,
        &ai.provider,
        &ai.model,
        &prompt,
        Some(img2img_bytes),
        Some(frame_seed),
        reference_strength,
        Some(ai.gen_size),
    )?;
    let image_bytes = download_generated_image(&image_url)?;
    fs::write(output_path, &image_bytes).map_err(|error| format!("写入动作帧失败：{error}"))?;

    if ai.provider.preset == "qwen" && sleep_after {
        thread::sleep(Duration::from_millis(1800));
    }

    Ok(())
}
