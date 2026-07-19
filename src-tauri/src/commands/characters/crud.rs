use std::fs;
use std::path::PathBuf;

use tracing::info;

use crate::character::model::*;
use crate::character::generation::provider::{build_image_data_url_with_mime, infer_image_mime};
use crate::character::preview::{
    attach_character_image_previews, hydrate_character_action_tracks,
    load_character_record_for_preview, populate_action_frame_paths, populate_character_image_paths,
    to_character_library_record, CharacterPreviewScope,
};
use crate::character::store::*;
use crate::storage::database::current_timestamp;

#[tauri::command]
pub fn create_character_asset(
    input: CreateCharacterAssetInput,
) -> Result<CharacterAssetRecord, String> {
    crate::character::create::create_character_asset_record(input)
}

#[tauri::command]
pub fn list_character_assets(project_root: String) -> Result<Vec<CharacterAssetRecord>, String> {
    let project_root = validate_project_root(&project_root)?;
    let index_path = project_root
        .join("assets")
        .join("characters")
        .join(CHARACTER_INDEX_FILE_NAME);
    let mut records = read_character_index(&index_path)?;

    if records.is_empty() {
        records = list_character_records_from_database(&project_root)?;
    }

    for record in &mut records {
        populate_character_image_paths(&project_root, record, CharacterPreviewScope::MasterOnly);
    }

    Ok(records)
}

#[tauri::command]
pub fn list_character_library(project_root: String) -> Result<Vec<CharacterLibraryRecord>, String> {
    let project_root = validate_project_root(&project_root)?;
    let index_path = project_root
        .join("assets")
        .join("characters")
        .join(CHARACTER_INDEX_FILE_NAME);
    let records = read_character_index(&index_path)?;

    if !records.is_empty() {
        return Ok(records
            .iter()
            .map(|record| to_character_library_record(&project_root, record))
            .collect());
    }

    let records = list_character_records_from_database(&project_root)?;
    Ok(records
        .iter()
        .map(|record| to_character_library_record(&project_root, record))
        .collect())
}

#[tauri::command]
pub fn list_character_summaries(project_root: String) -> Result<Vec<CharacterSummary>, String> {
    let project_root = validate_project_root(&project_root)?;
    let index_path = project_root
        .join("assets")
        .join("characters")
        .join(CHARACTER_INDEX_FILE_NAME);
    let records = read_character_index(&index_path)?;

    Ok(records
        .into_iter()
        .map(|record| CharacterSummary {
            display_name: if record.display_name.trim().is_empty() {
                record.id.clone()
            } else {
                record.display_name
            },
            id: record.id,
        })
        .collect())
}

#[tauri::command]
pub fn get_character_asset(
    project_root: String,
    character_id: String,
) -> Result<CharacterAssetRecord, String> {
    crate::character::store::get_character_asset(project_root, character_id)
}

#[tauri::command]
pub fn hydrate_character_action_previews(
    input: HydrateCharacterActionPreviewsInput,
) -> Result<CharacterActionTrack, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;
    let action_id = input.action_id.trim();

    if action_id.is_empty() {
        return Err("动作 ID 不能为空。".to_string());
    }

    let mut record = load_character_record_for_preview(&project_root, &character_id)?;
    hydrate_character_action_tracks(&mut record);

    let action_index = record
        .actions
        .iter()
        .position(|action| action.id == action_id)
        .ok_or_else(|| format!("未找到动作：{action_id}"))?;

    populate_action_frame_paths(&project_root, &mut record.actions[action_index]);

    Ok(record.actions[action_index].clone())
}

#[tauri::command]
pub fn toggle_character_favorite(
    input: ToggleCharacterFavoriteInput,
) -> Result<CharacterAssetRecord, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;
    let mut record = get_character_asset(input.project_root.clone(), character_id)?;

    record.favorite = input.favorite;

    write_character_record(&project_root, &record)?;
    upsert_character_index(&project_root, &record)?;
    upsert_character_database(&project_root, &record)?;
    attach_character_image_previews(&project_root, &mut record);

    Ok(record)
}

#[tauri::command]
pub fn delete_character_asset(input: DeleteCharacterAssetInput) -> Result<(), String> {
    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;
    let character_directory = project_root
        .join("assets")
        .join("characters")
        .join(&character_id);

    if character_directory.exists() {
        let character_directory = character_directory
            .canonicalize()
            .map_err(|error| format!("解析角色资产目录失败：{error}"))?;

        if !character_directory.starts_with(&project_root) {
            return Err("角色资产目录不在当前项目目录内。".to_string());
        }

        fs::remove_dir_all(&character_directory)
            .map_err(|error| format!("删除角色资产目录失败：{error}"))?;
    }

    remove_character_from_index(&project_root, &character_id)?;
    delete_character_database_record(&project_root, &character_id)?;
    sync_project_profile_to_database(&project_root)?;

    Ok(())
}

#[tauri::command]
pub fn import_character_reference_images(
    input: ImportCharacterReferenceImagesInput,
) -> Result<Vec<CharacterReferenceImageAsset>, String> {
    let project_root = validate_project_root(&input.project_root)?;

    if input.image_paths.is_empty() {
        return Ok(Vec::new());
    }

    if input.image_paths.len() > 4 {
        return Err("参考图最多选择 4 张。".to_string());
    }

    let batch_id = normalize_cache_segment(&current_timestamp().to_string());
    let reference_directory = project_root
        .join("assets")
        .join(".cache")
        .join("character-references")
        .join(&batch_id);

    fs::create_dir_all(&reference_directory)
        .map_err(|error| format!("创建角色参考图缓存目录失败：{error}"))?;

    let mut imported_images = Vec::new();

    for (index, image_path) in input.image_paths.iter().enumerate() {
        let source_path = PathBuf::from(image_path);
        let source_path = source_path
            .canonicalize()
            .map_err(|error| format!("解析参考图路径失败：{error}"))?;
        let extension = validate_reference_image_path(&source_path)?;
        let metadata =
            fs::metadata(&source_path).map_err(|error| format!("读取参考图信息失败：{error}"))?;

        if metadata.len() > 10 * 1024 * 1024 {
            return Err("单张参考图不能超过 10MB。".to_string());
        }

        let image_bytes =
            fs::read(&source_path).map_err(|error| format!("读取参考图失败：{error}"))?;

        if image_bytes.is_empty() {
            return Err("参考图文件为空。".to_string());
        }

        let file_name = format!(
            "reference_{}_{}.{}",
            index + 1,
            current_timestamp(),
            extension
        );
        let target_path = reference_directory.join(&file_name);

        fs::write(&target_path, &image_bytes)
            .map_err(|error| format!("保存角色参考图失败：{error}"))?;

        let project_relative_path =
            format!("assets/.cache/character-references/{batch_id}/{file_name}");
        let absolute_path = target_path.to_string_lossy().to_string();
        let mime_type = infer_image_mime(&extension);
        let role = match index {
            0 => "character",
            1 => "prop",
            2 => "scene",
            _ => "pose",
        };

        imported_images.push(CharacterReferenceImageAsset {
            absolute_path,
            data_url: build_image_data_url_with_mime(&image_bytes, mime_type),
            file_name,
            id: format!("{batch_id}-reference-{}", index + 1),
            project_relative_path,
            role: role.to_string(),
        });
    }

    info!(
        target = "jmtools::characters",
        count = imported_images.len(),
        "imported character reference images"
    );

    Ok(imported_images)
}
