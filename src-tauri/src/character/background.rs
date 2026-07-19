use std::fs;
use std::path::{Path, PathBuf};

use tracing::info;

use crate::character::generation::provider::{
    build_background_removal_output_from_png, build_image_data_url, build_rembg_warnings,
    remove_background_from_image_bytes, resolve_project_image_path, select_character_view_index,
    BackgroundRemovalOutput, ProceduralBackgroundRemovalOptions,
};
use crate::character::generation::views::build_initial_character_views;
use crate::character::model::*;
use crate::character::preview::attach_character_image_previews;
use crate::character::store::*;
use crate::commands::background_tools::{run_rembg_remove, RembgRemovalOptions};
use crate::storage::database::current_timestamp;

fn remove_background_for_view(
    project_root: &Path,
    record: &CharacterAssetRecord,
    view_index: usize,
    engine: &str,
    input: &RemoveCharacterBackgroundInput,
    processed_directory: &Path,
) -> Result<(BackgroundRemovalOutput, String, PathBuf), String> {
    let view_id = normalize_cache_segment(&record.views[view_index].id);
    let source_image = record.views[view_index]
        .raw_image
        .as_ref()
        .or(record.master_image.as_ref())
        .ok_or_else(|| "角色没有可用于去背景的母版图。".to_string())?;
    let source_path = resolve_project_image_path(project_root, source_image)?;
    let source_bytes =
        fs::read(&source_path).map_err(|error| format!("读取去背景源图失败：{error}"))?;

    let file_name = format!("{view_id}_transparent.png");
    let output_path = processed_directory.join(&file_name);
    let removal = if engine == "rembg" {
        run_rembg_remove(
            &source_path,
            &output_path,
            RembgRemovalOptions {
                alpha_matting: input.alpha_matting,
                custom_model_path: input.custom_model_path.clone(),
                executable_path: input.executable_path.clone(),
                model: if input.model.trim().is_empty() {
                    "isnet-general-use".to_string()
                } else {
                    input.model.trim().to_string()
                },
            },
        )?;

        let output_bytes =
            fs::read(&output_path).map_err(|error| format!("读取 rembg 输出图片失败：{error}"))?;
        build_background_removal_output_from_png(
            output_bytes,
            build_rembg_warnings(
                input.alpha_matting,
                input.foreground_threshold,
                input.background_threshold,
            ),
        )?
    } else {
        let procedural_options = ProceduralBackgroundRemovalOptions::from_input(input);
        let removal = remove_background_from_image_bytes(
            &source_bytes,
            input.tolerance.unwrap_or(34).clamp(8, 96),
            input.edge_softness.unwrap_or(24).clamp(0, 96),
            procedural_options,
        )?;

        fs::write(&output_path, &removal.png_bytes)
            .map_err(|error| format!("写入去背景图片失败：{error}"))?;
        removal
    };

    let project_relative_path = format!("assets/characters/{}/processed/{}", record.id, file_name);
    Ok((removal, project_relative_path, output_path))
}


pub(crate) fn remove_character_background_record(
    input: RemoveCharacterBackgroundInput,
) -> Result<CharacterAssetRecord, String> {
    let engine = input.engine.as_deref().unwrap_or("chroma").trim();

    if !matches!(engine, "chroma" | "rembg") {
        return Err("去背景算法设置不受支持。".to_string());
    }

    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;
    let mut record = get_character_asset(input.project_root.clone(), character_id)?;

    if record.views.is_empty() {
        record.views = build_initial_character_views(&record);
    }

    let processed_directory = project_root
        .join("assets")
        .join("characters")
        .join(&record.id)
        .join("processed");

    fs::create_dir_all(&processed_directory)
        .map_err(|error| format!("创建角色处理目录失败：{error}"))?;

    // viewId 为空时对所有已有原图的视图逐一去背景；否则仅处理指定视图。
    let target_indices: Vec<usize> = if let Some(view_id) = input
        .view_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        vec![select_character_view_index(&record, Some(view_id))?]
    } else {
        let all_with_raw: Vec<usize> = record
            .views
            .iter()
            .enumerate()
            .filter(|(_, view)| view.raw_image.is_some())
            .map(|(index, _)| index)
            .collect();
        if all_with_raw.is_empty() {
            vec![select_character_view_index(&record, None)?]
        } else {
            all_with_raw
        }
    };

    // 代表性 processing 元数据：优先采用 front/single 视图，否则取首个处理结果。
    let mut rep_bbox: Option<BoundingBox> = None;
    let mut rep_width = 0_u32;
    let mut rep_height = 0_u32;
    let mut rep_warnings: Vec<String> = Vec::new();
    let mut rep_locked = false;
    let mut processed_kinds: Vec<String> = Vec::new();

    for view_index in target_indices {
        let (removal, project_relative_path, output_path) =
            remove_background_for_view(&project_root, &record, view_index, engine, &input, &processed_directory)?;
        let view_id = normalize_cache_segment(&record.views[view_index].id);
        let is_primary = matches!(record.views[view_index].kind.as_str(), "front" | "single");
        let transparent_image = CharacterImageAsset {
            absolute_path: output_path.to_string_lossy().to_string(),
            data_url: build_image_data_url(&removal.png_bytes),
            height: removal.height,
            id: format!("{}-{view_id}-transparent", record.id),
            project_relative_path,
            role: "transparent".to_string(),
            source: "background-removal".to_string(),
            width: removal.width,
        };

        record.views[view_index].transparent_image = Some(transparent_image);
        record.views[view_index].bbox = removal.bbox.clone();
        record.views[view_index].quality = Some(CharacterViewQualityReport {
            checked_at: current_timestamp().to_string(),
            score: removal.score,
            warnings: removal.warnings.clone(),
        });
        processed_kinds.push(record.views[view_index].kind.clone());

        if !rep_locked || is_primary {
            rep_bbox = removal.bbox.clone();
            rep_width = removal.width;
            rep_height = removal.height;
            rep_warnings = removal.warnings.clone();
            if is_primary {
                rep_locked = true;
            }
        }
    }

    record.processing = Some(CharacterProcessingMetadata {
        alpha_coverage: None,
        anchor: None,
        anchor_mode: "bottomCenter".to_string(),
        background_removed: true,
        bbox: rep_bbox,
        canvas: CharacterCanvasSize {
            height: rep_height,
            width: rep_width,
        },
        foot_line_y: None,
        normalized: false,
        warnings: rep_warnings,
    });
    record.updated_at = current_timestamp().to_string();

    write_character_record(&project_root, &record)?;
    upsert_character_index(&project_root, &record)?;
    upsert_character_database(&project_root, &record)?;
    attach_character_image_previews(&project_root, &mut record);

    info!(
        target = "jmtools::characters",
        character_id = %record.id,
        views = %processed_kinds.join(","),
        "removed character background"
    );

    Ok(record)
}
