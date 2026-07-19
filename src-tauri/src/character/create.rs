use std::fs;

use tracing::info;

use crate::character::actions::tracks::build_default_action_tracks;
use crate::character::generation::views::build_initial_character_views;
use crate::character::model::*;
use crate::character::preview::{attach_character_image_previews, attach_selected_master_image};
use crate::character::prompt::{build_character_generation_config, build_default_export_profiles, build_initial_processing_metadata};
use crate::character::store::*;
use crate::storage::database::current_timestamp;

pub(crate) fn create_character_asset_record(
    input: CreateCharacterAssetInput,
) -> Result<CharacterAssetRecord, String> {
    let project_root = validate_project_root(&input.project_root)?;
    validate_character_input(&input)?;

    let timestamp = current_timestamp().to_string();
    let character_id = build_unique_character_id(&project_root, &input.draft.name, &timestamp);
    let project_relative_path = format!("assets/characters/{character_id}");
    let character_directory = project_root.join(&project_relative_path);
    let character_config_directory = character_directory.join("config");

    fs::create_dir_all(&character_directory)
        .map_err(|error| format!("创建角色资产目录失败：{error}"))?;
    fs::create_dir_all(&character_config_directory)
        .map_err(|error| format!("创建角色配置目录失败：{error}"))?;

    let action_suggestions = input.master_plan.action_suggestions.clone();
    let generation_config = build_character_generation_config(&input);
    let export_profiles = build_default_export_profiles(&input.draft);
    let processing = build_initial_processing_metadata(&input.draft);
    let mut record = CharacterAssetRecord {
        action_suggestions: action_suggestions.clone(),
        actions: build_default_action_tracks(
            &action_suggestions,
            &input.draft.direction,
            &character_id,
        ),
        config: Some(generation_config.clone()),
        created_at: timestamp.clone(),
        description: input.draft.description.trim().to_string(),
        direction: input.draft.direction.clone(),
        display_name: input.draft.name.trim().to_string(),
        export_notes: normalize_strings(input.master_plan.export_notes.clone()),
        export_profiles,
        favorite: false,
        id: character_id.clone(),
        master_image: None,
        model: input.model.trim().to_string(),
        palette: normalize_strings(input.draft.palette.clone()),
        pixel_prompt: input.master_plan.pixel_prompt.trim().to_string(),
        project_relative_path,
        provider_name: input.provider_name.trim().to_string(),
        processing: Some(processing),
        selected_plan_focus: input.selected_plan.focus.trim().to_string(),
        selected_plan_id: input.selected_plan.id.trim().to_string(),
        selected_plan_name: input.selected_plan.name.trim().to_string(),
        selected_plan_score: input.selected_plan.recommendation_score,
        size: input.draft.size.clone(),
        status: "draft".to_string(),
        style: input.draft.style.trim().to_string(),
        style_anchor_variant_key: input.draft.style_anchor_variant_key.trim().to_string(),
        summary: input.master_plan.summary.trim().to_string(),
        task_id: input.task_id.trim().to_string(),
        updated_at: timestamp,
        views: Vec::new(),
        visual_keywords: normalize_strings(input.master_plan.visual_keywords.clone()),
    };
    attach_selected_master_image(
        &project_root,
        &mut record,
        input.selected_plan.master_image.as_ref(),
    )?;
    record.views = build_initial_character_views(&record);

    write_json_file(
        &character_config_directory.join("generation.json"),
        &generation_config,
    )?;
    write_json_file(&character_directory.join("character.json"), &record)?;
    upsert_character_index(&project_root, &record)?;
    upsert_character_database(&project_root, &record)?;
    sync_project_profile_to_database(&project_root)?;
    attach_character_image_previews(&project_root, &mut record);

    info!(
        target = "jmtools::character",
        character_id = %record.id,
        task_id = %input.task_id.trim(),
        selected_plan_id = %record.selected_plan_id,
        path = %record.project_relative_path,
        "character asset created"
    );

    Ok(record)
}
