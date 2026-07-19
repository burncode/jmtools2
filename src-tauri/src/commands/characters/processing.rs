
use tracing::info;

use crate::character::background::remove_character_background_record;
use crate::character::generation::views::{build_initial_character_views, prepare_character_view_slots};
use crate::character::model::*;
use crate::character::preview::attach_character_image_previews;
use crate::character::store::{
    upsert_character_database, upsert_character_index, validate_character_id, validate_project_root,
    write_character_record,
};
use crate::commands::characters::crud::get_character_asset;
use crate::storage::database::current_timestamp;

#[tauri::command]
pub fn remove_character_background(
    input: RemoveCharacterBackgroundInput,
) -> Result<CharacterAssetRecord, String> {
    remove_character_background_record(input)
}

#[tauri::command]
pub fn bind_character_tool_result(
    input: BindCharacterToolResultInput,
) -> Result<CharacterAssetRecord, String> {
    use crate::character::generation::provider::select_character_view_index;

    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;
    let mut record = get_character_asset(input.project_root.clone(), character_id)?;

    if record.views.is_empty() {
        record.views = build_initial_character_views(&record);
    }

    let view_index = select_character_view_index(&record, input.view_id.as_deref())?;
    let view_id = crate::character::store::normalize_cache_segment(&record.views[view_index].id);
    let image = CharacterImageAsset {
        absolute_path: input.output_image.absolute_path,
        data_url: input.output_image.data_url,
        height: input.output_image.height,
        id: format!("{}-{view_id}-transparent", record.id),
        project_relative_path: input.output_image.project_relative_path,
        role: "transparent".to_string(),
        source: "asset-tool:background-removal".to_string(),
        width: input.output_image.width,
    };

    record.views[view_index].transparent_image = Some(image);
    record.views[view_index].bbox = input.bbox.clone();
    record.views[view_index].quality = Some(CharacterViewQualityReport {
        checked_at: current_timestamp().to_string(),
        score: input.score,
        warnings: input.warnings.clone(),
    });
    record.processing = Some(CharacterProcessingMetadata {
        alpha_coverage: None,
        anchor: None,
        anchor_mode: "bottomCenter".to_string(),
        background_removed: true,
        bbox: input.bbox,
        canvas: CharacterCanvasSize {
            height: input.output_image.height,
            width: input.output_image.width,
        },
        foot_line_y: None,
        normalized: false,
        warnings: input.warnings,
    });
    record.updated_at = current_timestamp().to_string();

    write_character_record(&project_root, &record)?;
    upsert_character_index(&project_root, &record)?;
    upsert_character_database(&project_root, &record)?;
    attach_character_image_previews(&project_root, &mut record);

    info!(
        target = "jmtools::characters",
        character_id = %record.id,
        view_id = %view_id,
        "bound character asset tool result"
    );

    Ok(record)
}

#[tauri::command]
pub fn prepare_character_view_style(
    input: PrepareCharacterViewStyleInput,
) -> Result<CharacterAssetRecord, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;
    let mut record = get_character_asset(input.project_root, character_id)?;
    let prepared_views = prepare_character_view_slots(&mut record);

    record.updated_at = current_timestamp().to_string();
    write_character_record(&project_root, &record)?;
    upsert_character_index(&project_root, &record)?;
    upsert_character_database(&project_root, &record)?;
    attach_character_image_previews(&project_root, &mut record);

    info!(
        target = "jmtools::characters",
        character_id = %record.id,
        views = %prepared_views.join(","),
        "prepared character view style slots"
    );

    Ok(record)
}
