use std::fs;
use std::path::Path;

use tauri::AppHandle;

use crate::character::generation::master::generate_character_master_candidates_blocking;
use crate::character::generation::provider::*;
use crate::character::generation::views::{build_initial_character_views, generate_character_view_images_blocking};
use crate::character::model::*;
use crate::character::preview::attach_character_image_previews;
use crate::character::prompt::*;
use crate::character::store::*;
use crate::storage::database::current_timestamp;

use super::output::{quantize_rgba_palette, workflow_fit_rgba_image_pixel_friendly};
use super::plan::workflow_default_draft;

pub(crate) fn workflow_generate_candidates(
    app: AppHandle,
    project_root: &Path,
    draft: CharacterWorkshopDraftInput,
    master_plan: CharacterMasterPlanInput,
    task_id: String,
    compiled_prompt: Option<String>,
    provider_id: Option<String>,
    model: Option<String>,
) -> Result<Vec<CharacterMasterCandidateImage>, String> {
    generate_character_master_candidates_blocking(
        app,
        GenerateCharacterMasterCandidatesInput {
            compiled_prompt,
            draft,
            master_plan,
            model,
            project_root: project_root.to_string_lossy().to_string(),
            provider_id,
            task_id,
        },
    )
}

pub(crate) fn workflow_generate_views(
    app: AppHandle,
    project_root: &Path,
    character_id: String,
    view_mode: Option<String>,
    views: Option<Vec<String>>,
    generation_strategy: Option<String>,
    reference_strength: Option<f64>,
    reference_mode: Option<String>,
    pose_reference_png: Option<Vec<u8>>,
) -> Result<CharacterAssetRecord, String> {
    generate_character_view_images_blocking(
        app,
        GenerateCharacterViewImagesInput {
            character_id,
            project_root: project_root.to_string_lossy().to_string(),
            view_mode,
            views,
            generation_strategy,
            reference_strength,
            reference_mode,
            pose_reference_png,
        },
    )
}

pub(crate) fn workflow_remove_background(
    project_root: &Path,
    character_id: String,
    view_id: Option<String>,
    engine: Option<String>,
    tolerance: Option<u8>,
    edge_softness: Option<u8>,
    cleanup_strength: Option<String>,
    hole_fill_max_pixels: Option<u32>,
    spill_suppression: Option<u8>,
    preserve_small_parts: Option<bool>,
    alpha_matting: Option<bool>,
) -> Result<CharacterAssetRecord, String> {
    crate::character::background::remove_character_background_record(RemoveCharacterBackgroundInput {
        alpha_matting: alpha_matting.unwrap_or(false),
        background_threshold: None,
        character_id,
        cleanup_strength,
        custom_model_path: String::new(),
        edge_softness,
        engine,
        executable_path: String::new(),
        foreground_threshold: None,
        hole_fill_max_pixels,
        model: String::new(),
        preserve_small_parts: preserve_small_parts.unwrap_or(false),
        project_root: project_root.to_string_lossy().to_string(),
        spill_suppression,
        tolerance,
        view_id,
        matting_color_space: None,
    })
}

pub(crate) fn workflow_build_draft(
    name: &str,
    description: &str,
    style: &str,
    size: &str,
    direction: &str,
) -> CharacterWorkshopDraftInput {
    workflow_build_draft_with_generation_count(name, description, style, size, direction, None)
}

pub(crate) fn workflow_build_draft_with_generation_count(
    name: &str,
    description: &str,
    style: &str,
    size: &str,
    direction: &str,
    generation_count: Option<&str>,
) -> CharacterWorkshopDraftInput {
    let mut draft = workflow_default_draft(name, description, style);
    draft.size = size.to_string();
    draft.direction = direction.to_string();
    if let Some(count) = generation_count.map(str::trim).filter(|value| !value.is_empty()) {
        draft.generation_count = count.to_string();
    }
    draft
}

pub(crate) fn workflow_create_character_asset(
    project_root: &Path,
    draft: CharacterWorkshopDraftInput,
    master_plan: CharacterMasterPlanInput,
    selected_plan: CharacterCandidatePlanInput,
    provider_name: String,
    model: String,
    task_id: String,
) -> Result<CharacterAssetRecord, String> {
    crate::character::create::create_character_asset_record(CreateCharacterAssetInput {
        draft,
        master_plan,
        model,
        project_root: project_root.to_string_lossy().to_string(),
        provider_name,
        selected_plan,
        task_id,
    })
}
pub(crate) fn workflow_normalize_character_view(
    project_root: &Path,
    character_id: &str,
    view_id: Option<&str>,
    target_width: u32,
    target_height: u32,
    scale_mode: &str,
    palette_size: u32,
) -> Result<CharacterAssetRecord, String> {
    let character_id = validate_character_id(character_id)?;
    let mut record = get_character_asset(
        project_root.to_string_lossy().to_string(),
        character_id.clone(),
    )?;

    if record.views.is_empty() {
        record.views = build_initial_character_views(&record);
    }

    // viewId 为空时规范化所有具备可规范化源图的视图；否则仅处理指定视图。
    let target_indices: Vec<usize> = if let Some(view_id) =
        view_id.filter(|value| !value.trim().is_empty())
    {
        let index = record
            .views
            .iter()
            .position(|view| view.id == view_id)
            .ok_or_else(|| "找不到指定视图。".to_string())?;
        vec![index]
    } else {
        let all: Vec<usize> = record
            .views
            .iter()
            .enumerate()
            .filter(|(_, view)| {
                view.transparent_image.is_some()
                    || view.raw_image.is_some()
                    || record.master_image.is_some()
            })
            .map(|(index, _)| index)
            .collect();
        if all.is_empty() {
            return Err("角色视图缺少可规范化图片。".to_string());
        }
        all
    };

    let output_dir = project_root
        .join("assets")
        .join("characters")
        .join(&record.id)
        .join("processed");
    fs::create_dir_all(&output_dir).map_err(|error| format!("创建规范化目录失败：{error}"))?;

    let foot_line_y = record
        .processing
        .as_ref()
        .and_then(|processing| processing.foot_line_y);

    for view_index in target_indices {
        let source = record.views[view_index]
            .transparent_image
            .as_ref()
            .or(record.views[view_index].raw_image.as_ref())
            .or(record.master_image.as_ref())
            .ok_or_else(|| "角色视图缺少可规范化图片。".to_string())?;
        let source_path = resolve_project_image_path(project_root, source)?;
        let image =
            image::open(&source_path).map_err(|error| format!("读取规范化源图失败：{error}"))?;
        let rgba = image.to_rgba8();

        let mut normalized = workflow_fit_rgba_image_pixel_friendly(
            &rgba,
            target_width,
            target_height,
            foot_line_y,
            scale_mode,
        );
        if palette_size > 0 {
            normalized = quantize_rgba_palette(&normalized, palette_size);
        }
        let file_name = format!("{}_normalized.png", record.views[view_index].id);
        let output_path = output_dir.join(&file_name);
        normalized
            .save(&output_path)
            .map_err(|error| format!("写入规范化图片失败：{error}"))?;
        let project_relative_path =
            format!("assets/characters/{}/processed/{file_name}", record.id);
        record.views[view_index].normalized_image = Some(CharacterImageAsset {
            absolute_path: output_path.to_string_lossy().to_string(),
            data_url: String::new(),
            height: target_height,
            id: format!("{}-normalized", record.views[view_index].id),
            project_relative_path,
            role: "normalized".to_string(),
            source: "workflow-normalize".to_string(),
            width: target_width,
        });
    }

    if let Some(processing) = record.processing.as_mut() {
        processing.normalized = true;
        processing.canvas = CharacterCanvasSize {
            height: target_height,
            width: target_width,
        };
    }
    write_character_record(project_root, &record)?;
    upsert_character_index(project_root, &record)?;
    upsert_character_database(project_root, &record)?;
    attach_character_image_previews(project_root, &mut record);
    Ok(record)
}

pub(crate) fn workflow_analyze_character(
    project_root: &Path,
    character_id: String,
    view_id: Option<String>,
    min_alpha_coverage_pct: f64,
    max_bbox_ratio_pct: f64,
) -> Result<CharacterAssetRecord, String> {
    use crate::image_pipeline::quality::analyze_rgba_image;

    let mut record = get_character_asset(
        project_root.to_string_lossy().to_string(),
        character_id.clone(),
    )?;

    let view_index = if let Some(view_id) = view_id.as_deref().filter(|value| !value.is_empty()) {
        record
            .views
            .iter()
            .position(|view| view.id == view_id)
            .ok_or_else(|| format!("未找到视图 ID：{view_id}"))?
    } else {
        0
    };

    let image_asset = record
        .views
        .get(view_index)
        .and_then(|view| {
            view.normalized_image
                .as_ref()
                .or(view.transparent_image.as_ref())
                .or(view.raw_image.as_ref())
                .or_else(|| record.master_image.as_ref())
        })
        .ok_or_else(|| "角色缺少可分析的图像。".to_string())?;

    let image_path = project_root.join(&image_asset.project_relative_path);
    let image_path = image_path
        .canonicalize()
        .map_err(|error| format!("读取角色图像失败：{error}"))?;
    let image = image::open(&image_path).map_err(|error| format!("打开角色图像失败：{error}"))?;
    let rgba = image.to_rgba8();
    let report = analyze_rgba_image(&rgba);

    let mut processing = record.processing.clone().unwrap_or_else(|| {
        build_initial_processing_metadata(&workflow_default_draft(
            &record.display_name,
            &record.description,
            &record.style,
        ))
    });

    processing.canvas = CharacterCanvasSize {
        height: report.height,
        width: report.width,
    };
    let report_bbox = report.bbox.clone();
    processing.bbox = report_bbox.as_ref().map(|bbox| BoundingBox {
        height: bbox.height,
        width: bbox.width,
        x: bbox.x,
        y: bbox.y,
    });
    processing.foot_line_y = report.foot_line_y;

    // 基于节点阈值生成可读的预检结论，并持久化前景占比供 UI/门禁使用。
    let coverage_pct = report.alpha_coverage * 100.0;
    let bbox_height_ratio = report_bbox
        .as_ref()
        .map(|bbox| f64::from(bbox.height) / f64::from(report.height.max(1)) * 100.0);
    let mut warnings: Vec<String> = report.warnings.clone();
    if coverage_pct < min_alpha_coverage_pct {
        warnings.push(format!(
            "前景占比 {coverage_pct:.1}% 低于阈值 {min_alpha_coverage_pct:.0}%，可能存在过度抠图或主体偏小。"
        ));
    }
    if let Some(ratio) = bbox_height_ratio {
        if ratio > max_bbox_ratio_pct {
            warnings.push(format!(
                "主体高度占画布 {ratio:.0}%，超过阈值 {max_bbox_ratio_pct:.0}%，可能被裁切或缺少留白。"
            ));
        }
    }
    // 总是给出一条可读的预检摘要，避免节点“看起来没有任何信息”。
    warnings.push(format!(
        "预检：前景占比 {coverage_pct:.1}%，包围盒 {}，脚底线 y={}。",
        report_bbox
            .as_ref()
            .map(|bbox| format!("{}x{}", bbox.width, bbox.height))
            .unwrap_or_else(|| "无".to_string()),
        report
            .foot_line_y
            .map(|value| value.to_string())
            .unwrap_or_else(|| "无".to_string())
    ));
    processing.warnings = warnings;
    processing.alpha_coverage = Some(report.alpha_coverage);

    record.processing = Some(processing);
    record.updated_at = current_timestamp().to_string();
    write_character_record(project_root, &record)?;
    upsert_character_index(project_root, &record)?;
    upsert_character_database(project_root, &record)?;
    attach_character_image_previews(project_root, &mut record);
    Ok(record)
}
