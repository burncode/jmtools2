use std::fs;
use std::path::Path;

use crate::character::actions::tracks::build_default_action_tracks;
use crate::character::model::*;
use crate::character::store::get_character_record_from_database;
use crate::storage::database::current_timestamp;

pub(crate) enum CharacterPreviewScope {
    MasterOnly,
    Views,
    ActionFrames,
    All,
}

pub(crate) fn to_character_library_record(
    project_root: &Path,
    record: &CharacterAssetRecord,
) -> CharacterLibraryRecord {
    let mut master_image = record.master_image.clone();

    if let Some(image) = master_image.as_mut() {
        image.data_url.clear();
        populate_image_absolute_path(project_root, image);
    }

    let mut preview_image = pick_library_preview_image(record);
    if let Some(image) = preview_image.as_mut() {
        image.data_url.clear();
        populate_image_absolute_path(project_root, image);
    }

    CharacterLibraryRecord {
        display_name: if record.display_name.trim().is_empty() {
            record.id.clone()
        } else {
            record.display_name.clone()
        },
        favorite: record.favorite,
        id: record.id.clone(),
        master_image,
        preview_image,
        selected_plan_name: record.selected_plan_name.clone(),
        size: record.size.clone(),
        status: record.status.clone(),
        style: record.style.clone(),
        updated_at: record.updated_at.clone(),
        visual_keywords: record.visual_keywords.clone(),
    }
}

fn view_has_preview_image(view: &CharacterViewAsset) -> bool {
    view.transparent_image.is_some() || view.normalized_image.is_some() || view.raw_image.is_some()
}

fn pick_library_preview_image(record: &CharacterAssetRecord) -> Option<CharacterImageAsset> {
    let primary_view = record
        .views
        .iter()
        .find(|view| view.kind == "front" || view.kind == "single")
        .or_else(|| record.views.iter().find(|view| view_has_preview_image(view)));

    if let Some(view) = primary_view {
        if let Some(image) = view
            .transparent_image
            .clone()
            .or_else(|| view.normalized_image.clone())
            .or_else(|| view.raw_image.clone())
        {
            return Some(image);
        }
    }

    record.master_image.clone()
}

pub(crate) fn load_character_record_for_preview(
    project_root: &Path,
    character_id: &str,
) -> Result<CharacterAssetRecord, String> {
    let character_path = project_root
        .join("assets")
        .join("characters")
        .join(character_id)
        .join("character.json");

    if character_path.exists() {
        let content = fs::read_to_string(&character_path)
            .map_err(|error| format!("读取角色资产详情失败：{error}"))?;
        return serde_json::from_str::<CharacterAssetRecord>(&content)
            .map_err(|error| format!("角色资产详情格式错误：{error}"));
    }

    get_character_record_from_database(project_root, character_id)
}

fn populate_image_absolute_path(project_root: &Path, image: &mut CharacterImageAsset) {
    if image.project_relative_path.trim().is_empty() {
        return;
    }

    image.absolute_path = project_root
        .join(image.project_relative_path.trim())
        .to_string_lossy()
        .to_string();
}

fn populate_image_absolute_path_opt(project_root: &Path, image: Option<&mut CharacterImageAsset>) {
    if let Some(image) = image {
        populate_image_absolute_path(project_root, image);
    }
}

pub(crate) fn populate_action_frame_paths(project_root: &Path, action: &mut CharacterActionTrack) {
    for frame in &mut action.frames {
        populate_image_absolute_path_opt(project_root, frame.image.as_mut());
    }
}

pub(crate) fn populate_character_image_paths(
    project_root: &Path,
    record: &mut CharacterAssetRecord,
    scope: CharacterPreviewScope,
) {
    let include_master = matches!(
        scope,
        CharacterPreviewScope::MasterOnly | CharacterPreviewScope::Views | CharacterPreviewScope::All
    );
    let include_views = matches!(scope, CharacterPreviewScope::Views | CharacterPreviewScope::All);
    let include_frames = matches!(
        scope,
        CharacterPreviewScope::ActionFrames | CharacterPreviewScope::All
    );

    if include_master {
        if let Some(master_image) = record.master_image.as_mut() {
            populate_image_absolute_path(project_root, master_image);
        }
    }

    if include_views {
        for view in &mut record.views {
            populate_image_absolute_path_opt(project_root, view.raw_image.as_mut());
            populate_image_absolute_path_opt(project_root, view.transparent_image.as_mut());
            populate_image_absolute_path_opt(project_root, view.normalized_image.as_mut());
        }
    }

    if include_frames {
        for action in &mut record.actions {
            populate_action_frame_paths(project_root, action);
        }
    }
}

pub(crate) fn attach_character_image_previews(project_root: &Path, record: &mut CharacterAssetRecord) {
    populate_character_image_paths(project_root, record, CharacterPreviewScope::All);
}

pub(crate) fn strip_character_preview_payload(record: &mut CharacterAssetRecord) {
    if let Some(master_image) = record.master_image.as_mut() {
        master_image.data_url.clear();
    }

    for view in &mut record.views {
        if let Some(image) = view.raw_image.as_mut() {
            image.data_url.clear();
        }
        if let Some(image) = view.transparent_image.as_mut() {
            image.data_url.clear();
        }
        if let Some(image) = view.normalized_image.as_mut() {
            image.data_url.clear();
        }
    }

    for action in &mut record.actions {
        for frame in &mut action.frames {
            if let Some(image) = frame.image.as_mut() {
                image.data_url.clear();
            }
        }
    }
}

pub(crate) fn hydrate_character_action_tracks(record: &mut CharacterAssetRecord) {
    if record.actions.is_empty() {
        record.actions =
            build_default_action_tracks(&record.action_suggestions, &record.direction, &record.id);
    }
}


pub(crate) fn attach_selected_master_image(
    project_root: &Path,
    record: &mut CharacterAssetRecord,
    selected_image: Option<&CharacterImageAsset>,
) -> Result<(), String> {
    let Some(selected_image) = selected_image else {
        return Ok(());
    };
    let source_relative_path = selected_image.project_relative_path.trim();

    if source_relative_path.is_empty() {
        return Ok(());
    }

    let source_path = project_root.join(source_relative_path);
    let source_path = source_path
        .canonicalize()
        .map_err(|error| format!("读取选中母版候选图失败：{error}"))?;

    if !source_path.starts_with(project_root) {
        return Err("选中母版候选图不在当前项目目录内。".to_string());
    }

    let timestamp = current_timestamp().to_string();
    let master_directory = project_root
        .join("assets")
        .join("characters")
        .join(&record.id)
        .join("master");

    fs::create_dir_all(&master_directory)
        .map_err(|error| format!("创建角色母版图目录失败：{error}"))?;

    let file_name = format!("master_{timestamp}.png");
    let target_path = master_directory.join(&file_name);

    fs::copy(&source_path, &target_path).map_err(|error| format!("写入角色母版图失败：{error}"))?;

    let raw_directory = project_root
        .join("assets")
        .join("characters")
        .join(&record.id)
        .join("raw");
    fs::create_dir_all(&raw_directory)
        .map_err(|error| format!("创建角色 raw 目录失败：{error}"))?;
    let raw_file_name = format!("candidate_{timestamp}.png");
    fs::copy(
        &source_path,
        raw_directory.join(&raw_file_name),
    )
    .map_err(|error| format!("写入角色 raw 候选图失败：{error}"))?;

    record.master_image = Some(CharacterImageAsset {
        absolute_path: String::new(),
        data_url: String::new(),
        height: selected_image.height,
        id: format!("{}-master-{timestamp}", record.id),
        project_relative_path: format!("assets/characters/{}/master/{file_name}", record.id),
        role: "master".to_string(),
        source: selected_image.source.clone(),
        width: selected_image.width,
    });
    record.status = "ready".to_string();
    record.updated_at = timestamp;

    Ok(())
}

