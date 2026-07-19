use std::fs;
use std::path::Path;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tracing::{info, warn};

use crate::character::generation::local::generation_limits::build_generation_limits;
use crate::character::generation::local::hardware_cache::resolve_hardware_profile;
use crate::character::generation::local::is_local_image_preset;
use crate::character::generation::local::resolution::resolve_local_turnaround_sheet_side;
use crate::character::generation::local::settings::load_local_inference_settings;
use crate::character::generation::reference::{
    resolve_candidate_reference, resolve_primary_reference_from_record, ResolvedReferenceImage,
};
use crate::character::generation::views_mirror::{quadrant_pixel_similarity, split_turnaround_sheet};
use crate::character::generation::provider::*;
use crate::character::generation::settings::*;
use crate::character::model::*;
use crate::character::preview::hydrate_character_action_tracks;
use crate::character::prompt::*;
use crate::character::store::*;
use crate::storage::database::{
    current_timestamp, ensure_ai_schema, ensure_app_settings_schema, open_app_database,
};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CharacterGenerationProgressEvent {
    candidate_index: u16,
    candidate_total: u16,
    message: String,
    phase: String,
    task_id: String,
}

pub(crate) fn emit_character_generation_progress(
    app: &AppHandle,
    task_id: &str,
    phase: &str,
    candidate_index: u16,
    candidate_total: u16,
    message: String,
) {
    let _ = app.emit(
        "character-generation-progress",
        CharacterGenerationProgressEvent {
            candidate_index,
            candidate_total,
            message,
            phase: phase.to_string(),
            task_id: task_id.to_string(),
        },
    );
}

pub(crate) fn generate_character_master_candidates_blocking(
    app: AppHandle,
    input: GenerateCharacterMasterCandidatesInput,
) -> Result<Vec<CharacterMasterCandidateImage>, String> {
    let project_root = validate_project_root(&input.project_root)?;

    if input.master_plan.pixel_prompt.trim().is_empty() {
        return Err("角色母版提示词不能为空，请先生成母版方案。".to_string());
    }

    if input.master_plan.candidate_plans.is_empty() {
        return Err("没有可生成的候选方案。".to_string());
    }

    let app_connection = open_app_database(&app)?;
    ensure_ai_schema(&app_connection)?;
    ensure_app_settings_schema(&app_connection)?;
    let settings = load_character_generation_settings(&app_connection)?;
    validate_character_generation_settings(&settings)?;
    let provider_id = input
        .provider_id
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| settings.ai_character_provider_id.clone());
    let model_name = input
        .model
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| settings.ai_character_model.clone());
    let provider = load_image_provider(&app_connection, provider_id.as_str())?;
    let model = resolve_image_model(
        &app_connection,
        &provider,
        model_name.as_str(),
    )?;
    let task_id = normalize_cache_segment(&input.task_id);
    info!(
        target = "jmtools::character",
        task_id = %task_id,
        provider_id = %provider_id,
        model = %model_name,
        candidate_plans = input.master_plan.candidate_plans.len(),
        "character master candidates generation started"
    );
    let candidate_directory = project_root
        .join("assets")
        .join(".cache")
        .join("character-candidates")
        .join(&task_id);

    fs::create_dir_all(&candidate_directory)
        .map_err(|error| format!("创建角色候选图缓存目录失败：{error}"))?;

    let mut generated_images = Vec::new();

    let (target_width, target_height) = resolve_canvas_size(&input.draft);
    let (gen_width, gen_height) = resolve_api_generation_size(target_width, target_height);

    let candidate_count = parse_workflow_candidate_count(&input.draft.generation_count);
    let candidate_plans = ensure_candidate_plans(
        input.master_plan.candidate_plans.clone(),
        candidate_count,
    );
    let candidate_total = candidate_plans.len() as u16;

    emit_character_generation_progress(
        &app,
        &task_id,
        "candidates",
        0,
        candidate_total,
        format!("开始生成候选图 0/{candidate_total}"),
    );

    let uses_turnaround_sheet = matches!(input.draft.direction.as_str(), "four" | "eight");

    for (index, candidate_plan) in candidate_plans.iter().enumerate() {
        let plan_id = normalize_cache_segment(&candidate_plan.id);

        info!(
            target = "jmtools::characters",
            task_id = %task_id,
            plan_id = %plan_id,
            provider = %provider.name,
            model = %model.name,
            turnaround = uses_turnaround_sheet,
            "start character candidate image generation"
        );

        let generation_settings = resolve_project_generation_settings(&project_root);
        let layout_reference =
            resolve_layout_anchor_reference_bytes(&project_root, &generation_settings, None);
        let candidate_reference = resolve_candidate_reference(
            &project_root,
            &input.draft,
            layout_reference,
        );

        let candidate_image = if uses_turnaround_sheet {
            generate_turnaround_candidate_image(
                &app,
                &provider,
                &model,
                &project_root,
                &input,
                candidate_plan,
                &task_id,
                &plan_id,
                &candidate_directory,
                candidate_reference.as_ref(),
                gen_width,
                gen_height,
            )?
        } else {
            generate_single_candidate_image(
                &app,
                &provider,
                &model,
                &project_root,
                &input,
                candidate_plan,
                &task_id,
                &plan_id,
                &candidate_directory,
                candidate_reference.as_ref(),
                gen_width,
                gen_height,
            )?
        };

        generated_images.push(candidate_image);

        emit_character_generation_progress(
            &app,
            &task_id,
            "candidates",
            (index + 1) as u16,
            candidate_total,
            format!("已生成候选图 {}/{}", index + 1, candidate_total),
        );

        if provider.preset == "qwen" && index + 1 < candidate_plans.len() {
            thread::sleep(Duration::from_millis(1800));
        }
    }

    info!(
        target = "jmtools::character",
        task_id = %task_id,
        candidate_count = generated_images.len(),
        "character master candidates generation finished"
    );

    Ok(generated_images)
}

fn generate_single_candidate_image(
    app: &AppHandle,
    provider: &StoredImageProvider,
    model: &StoredImageModel,
    project_root: &Path,
    input: &GenerateCharacterMasterCandidatesInput,
    candidate_plan: &CharacterCandidatePlanInput,
    task_id: &str,
    plan_id: &str,
    candidate_directory: &Path,
    candidate_reference: Option<&ResolvedReferenceImage>,
    gen_width: u32,
    gen_height: u32,
) -> Result<CharacterMasterCandidateImage, String> {
    let prompt = build_character_candidate_image_prompt(
        project_root,
        &input.draft,
        &input.master_plan,
        candidate_plan,
        input.compiled_prompt.as_deref(),
        None,
    );

    let seed = Some(stable_seed_from_id(task_id).wrapping_add(stable_seed_from_id(plan_id)));
    let image_bytes = request_candidate_image_bytes(
        app,
        provider,
        model,
        &prompt,
        (gen_width, gen_height),
        seed,
        candidate_reference,
    )?;
    let file_name = format!("candidate_{plan_id}.png");
    let image_path = candidate_directory.join(&file_name);

    fs::write(&image_path, &image_bytes)
        .map_err(|error| format!("保存角色候选图失败：{error}"))?;

    let project_relative_path = format!("assets/.cache/character-candidates/{task_id}/{file_name}");
    let absolute_path = image_path.to_string_lossy().to_string();

    Ok(CharacterMasterCandidateImage {
        direction_previews: None,
        generation_warnings: None,
        image: CharacterImageAsset {
            absolute_path,
            data_url: build_image_data_url(&image_bytes),
            height: gen_height,
            id: format!("{task_id}-{plan_id}-candidate"),
            project_relative_path,
            role: "master".to_string(),
            source: "ai-generated".to_string(),
            width: gen_width,
        },
        plan_id: candidate_plan.id.clone(),
    })
}

fn generate_turnaround_candidate_image(
    app: &AppHandle,
    provider: &StoredImageProvider,
    model: &StoredImageModel,
    project_root: &Path,
    input: &GenerateCharacterMasterCandidatesInput,
    candidate_plan: &CharacterCandidatePlanInput,
    task_id: &str,
    plan_id: &str,
    candidate_directory: &Path,
    candidate_reference: Option<&ResolvedReferenceImage>,
    gen_width: u32,
    gen_height: u32,
) -> Result<CharacterMasterCandidateImage, String> {
    let prompt = build_character_candidate_turnaround_prompt(
        project_root,
        &input.draft,
        &input.master_plan,
        candidate_plan,
        input.compiled_prompt.as_deref(),
    );

    let cell_size = gen_width.max(gen_height);
    let sheet_side = if is_local_image_preset(provider.preset.as_str()) {
        let connection = open_app_database(app)?;
        ensure_app_settings_schema(&connection)?;
        let settings = load_local_inference_settings(&connection)?;
        let hardware = resolve_hardware_profile(&connection, false)?;
        let profile_override = if model.name.trim().is_empty() {
            None
        } else {
            Some(model.name.as_str())
        };
        let limits = build_generation_limits(
            &hardware.hardware,
            &settings,
            profile_override,
        )?;
        let max_side = limits.max_side;
        let capped = resolve_local_turnaround_sheet_side(cell_size, max_side);
        if capped < cell_size.saturating_mul(2).clamp(256, 2048) {
            warn!(
                target = "jmtools::characters",
                cell_size,
                sheet_side = capped,
                max_side,
                "本地生图四向拼图分辨率已按显存封顶"
            );
        }
        capped
    } else {
        cell_size.saturating_mul(2).clamp(256, 2048)
    };

    let seed = Some(stable_seed_from_id(task_id).wrapping_add(stable_seed_from_id(plan_id)));
    let image_bytes = request_candidate_image_bytes(
        app,
        provider,
        model,
        &prompt,
        (sheet_side, sheet_side),
        seed,
        candidate_reference,
    )?;
    let sheet = image::load_from_memory(&image_bytes)
        .map_err(|error| format!("解析 turnaround 候选拼图失败：{error}"))?
        .to_rgba8();
    let quadrants = split_turnaround_sheet(&sheet);

    let quadrant_kinds = ["front", "back", "left", "right"];
    let mut direction_previews = CharacterDirectionPreviews::default();
    let mut front_image: Option<CharacterImageAsset> = None;

    for (quadrant_index, kind) in quadrant_kinds.iter().enumerate() {
        let quadrant = &quadrants[quadrant_index];
        let file_name = format!("candidate_{plan_id}_{kind}.png");
        let image_path = candidate_directory.join(&file_name);

        quadrant
            .save(&image_path)
            .map_err(|error| format!("保存 turnaround 候选象限失败：{error}"))?;

        let quadrant_bytes = fs::read(&image_path)
            .map_err(|error| format!("读取 turnaround 候选象限失败：{error}"))?;
        let project_relative_path =
            format!("assets/.cache/character-candidates/{task_id}/{file_name}");
        let absolute_path = image_path.to_string_lossy().to_string();
        let asset = CharacterImageAsset {
            absolute_path,
            data_url: build_image_data_url(&quadrant_bytes),
            height: quadrant.height(),
            id: format!("{task_id}-{plan_id}-{kind}"),
            project_relative_path,
            role: "master".to_string(),
            source: "ai-generated".to_string(),
            width: quadrant.width(),
        };

        match *kind {
            "front" => {
                front_image = Some(asset.clone());
                direction_previews.front = Some(asset);
            }
            "back" => direction_previews.back = Some(asset),
            "left" => direction_previews.left = Some(asset),
            "right" => direction_previews.right = Some(asset),
            _ => {}
        }
    }

    let mut generation_warnings = Vec::new();
    if quadrants.len() >= 3 {
        let front_left_similarity = quadrant_pixel_similarity(&quadrants[0], &quadrants[2]);
        if front_left_similarity >= 0.92 {
            generation_warnings.push(format!(
                "左视图与正面过于相似（相似度 {:.0}%），模型可能未按 2×2 布局生成，建议重新生成候选。",
                front_left_similarity * 100.0
            ));
        }
    }

    Ok(CharacterMasterCandidateImage {
        image: front_image.ok_or_else(|| "turnaround 候选缺少正面象限。".to_string())?,
        direction_previews: Some(direction_previews),
        generation_warnings: if generation_warnings.is_empty() {
            None
        } else {
            Some(generation_warnings)
        },
        plan_id: candidate_plan.id.clone(),
    })
}

pub(crate) fn generate_character_master_image_blocking(
    app: AppHandle,
    input: GenerateCharacterMasterImageInput,
) -> Result<CharacterAssetRecord, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;
    let mut record = get_character_asset(input.project_root, character_id.clone())?;
    let app_connection = open_app_database(&app)?;
    ensure_ai_schema(&app_connection)?;
    ensure_app_settings_schema(&app_connection)?;
    let settings = load_character_generation_settings(&app_connection)?;
    validate_character_generation_settings(&settings)?;
    let provider =
        load_image_provider(&app_connection, settings.ai_character_provider_id.as_str())?;
    let model = resolve_image_model(
        &app_connection,
        &provider,
        settings.ai_character_model.as_str(),
    )?;
    let prompt = build_character_master_image_prompt(&project_root, &record);

    info!(
        target = "jmtools::characters",
        character_id = %record.id,
        provider = %provider.name,
        model = %model.name,
        "start character master image generation"
    );

    let (target_width, target_height) = record_target_canvas(&record);
    let (gen_width, gen_height) = resolve_api_generation_size(target_width, target_height);
    let master_reference = resolve_primary_reference_from_record(&project_root, &record);
    let seed = Some(stable_seed_from_id(&record.id));
    let image_bytes = request_candidate_image_bytes(
        &app,
        &provider,
        &model,
        &prompt,
        (gen_width, gen_height),
        seed,
        master_reference.as_ref(),
    )?;
    let timestamp = current_timestamp().to_string();
    let master_directory = project_root
        .join("assets")
        .join("characters")
        .join(&record.id)
        .join("master");

    fs::create_dir_all(&master_directory)
        .map_err(|error| format!("创建角色母版图目录失败：{error}"))?;

    let file_name = format!("master_{timestamp}.png");
    let image_path = master_directory.join(&file_name);

    fs::write(&image_path, image_bytes).map_err(|error| format!("保存角色母版图失败：{error}"))?;

    let project_relative_path = format!("assets/characters/{}/master/{file_name}", record.id);
    record.master_image = Some(CharacterImageAsset {
        absolute_path: String::new(),
        data_url: String::new(),
        height: gen_height,
        id: format!("{}-master-{timestamp}", record.id),
        project_relative_path,
        role: "master".to_string(),
        source: "ai-generated".to_string(),
        width: gen_width,
    });
    record.status = "ready".to_string();
    record.updated_at = timestamp;

    hydrate_character_action_tracks(&mut record);
    write_character_record(&project_root, &record)?;
    upsert_character_index(&project_root, &record)?;
    upsert_character_database(&project_root, &record)?;

    info!(
        target = "jmtools::characters",
        character_id = %record.id,
        "character master image generated"
    );

    Ok(record)
}

pub(crate) fn generate_workflow_image_blocking(
    app: &AppHandle,
    project_root: &Path,
    prompt: &str,
    provider_id_override: Option<String>,
    model_override: Option<String>,
) -> Result<Value, String> {
    let app_connection = open_app_database(app)?;
    ensure_ai_schema(&app_connection)?;
    ensure_app_settings_schema(&app_connection)?;
    let settings = load_character_generation_settings(&app_connection)?;
    validate_character_generation_settings(&settings)?;

    let provider_id = provider_id_override
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| settings.ai_character_provider_id.clone());
    let model_name = model_override
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| settings.ai_character_model.clone());
    let provider = load_image_provider(&app_connection, provider_id.as_str())?;
    let model = resolve_image_model(&app_connection, &provider, model_name.as_str())?;
    let image_bytes = request_character_image_bytes(
        app,
        &provider,
        &model,
        prompt,
        None,
        None,
        None,
        None,
    )?;
    let timestamp = current_timestamp();
    let generated_directory = project_root
        .join("assets")
        .join("generated")
        .join("workflows");

    fs::create_dir_all(&generated_directory)
        .map_err(|error| format!("创建工作流生成目录失败：{error}"))?;

    let file_name = format!("gen_{timestamp}.png");
    let image_path = generated_directory.join(&file_name);

    fs::write(&image_path, image_bytes).map_err(|error| format!("保存工作流生成图片失败：{error}"))?;

    let project_relative_path = format!("assets/generated/workflows/{file_name}");

    Ok(json!({
        "kind": "projectRelativePath",
        "path": project_relative_path,
        "absolutePath": image_path.to_string_lossy(),
        "width": model.default_width,
        "height": model.default_height
    }))
}

fn request_candidate_image_bytes(
    app: &AppHandle,
    provider: &StoredImageProvider,
    model: &StoredImageModel,
    prompt: &str,
    size: (u32, u32),
    seed: Option<u64>,
    candidate_reference: Option<&ResolvedReferenceImage>,
) -> Result<Vec<u8>, String> {
    if let Some(reference) = candidate_reference {
        return request_character_image_bytes(
            app,
            provider,
            model,
            prompt,
            Some(size),
            seed,
            Some(reference.bytes.as_slice()),
            Some(reference.strength),
        );
    }

    request_character_image_bytes(
        app,
        provider,
        model,
        prompt,
        Some(size),
        seed,
        None,
        None,
    )
}

