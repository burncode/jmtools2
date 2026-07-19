use std::fs;
use std::path::{Path, PathBuf};

use image::RgbaImage;

use crate::character::generation::provider::{
    build_background_removal_output_from_png, build_image_data_url, build_rembg_warnings,
    remove_background_from_image_bytes, ProceduralBackgroundRemovalOptions, ProceduralCleanupStrength,
};
use crate::character::model::*;
use crate::character::store::normalize_cache_segment;
use crate::character::workflow::workflow_fit_rgba_image_pixel_friendly;
use crate::commands::background_tools::{run_rembg_remove, RembgRemovalOptions};
use crate::image_pipeline::color_space::MattingColorSpace;
use crate::image_pipeline::quality::analyze_rgba_image;

const DIRECTION_KINDS: [&str; 4] = ["front", "back", "left", "right"];

pub(crate) fn preview_candidate_post_process_blocking(
    input: PreviewCandidatePostProcessInput,
) -> Result<PreviewCandidatePostProcessResult, String> {
    let project_root = crate::character::store::validate_project_root(&input.project_root)?;
    let task_id = normalize_cache_segment(&input.task_id);
    let plan_id = normalize_cache_segment(&input.plan_id);

    if !input.options.run_remove_background
        && !input.options.run_normalize
        && !input.options.run_analyze
        && !input.options.run_views
    {
        return Err("请至少选择一个后处理步骤。".to_string());
    }

    if input.options.run_views
        && !input.options.run_remove_background
        && !input.options.run_normalize
        && !input.options.run_analyze
    {
        return Err("「生成缺失视图」暂不支持预览，请同时勾选其他后处理步骤，或在确认入库后执行。".to_string());
    }

    let preview_directory = project_root
        .join("assets")
        .join(".cache")
        .join("character-candidates")
        .join(&task_id)
        .join("preview")
        .join(&plan_id);

    fs::create_dir_all(&preview_directory)
        .map_err(|error| format!("创建候选后处理预览目录失败：{error}"))?;

    let mut output_previews = CharacterDirectionPreviews::default();
    let mut analyze_warnings = Vec::new();
    let mut analyze_score: Option<u16> = None;

    for kind in DIRECTION_KINDS {
        let Some(source_image) = direction_preview_for_kind(&input.source_images, kind) else {
            continue;
        };

        let source_path = resolve_source_image_path(&project_root, source_image)?;
        let mut rgba = image::open(&source_path)
            .map_err(|error| format!("读取候选图失败：{error}"))?
            .to_rgba8();

        if input.options.run_remove_background {
            rgba = apply_background_removal(
                &rgba,
                &source_path,
                &preview_directory,
                kind,
                &input.params.remove_background,
            )?;
        }

        if input.options.run_normalize {
            rgba = apply_normalize_preview(
                &rgba,
                input.params.normalize.target_width.max(1),
                input.params.normalize.target_height.max(1),
                input.params.normalize.scale_mode.as_str(),
                input.options.run_remove_background,
            );
        }

        if input.options.run_analyze && kind == "front" {
            let report = analyze_rgba_image(&rgba);
            analyze_score = Some(score_from_quality_report(&report, &input.params.analyze));
            analyze_warnings.extend(build_analyze_warnings(&report, &input.params.analyze));
        }

        let file_name = format!("preview_{kind}.png");
        let image_path = preview_directory.join(&file_name);
        rgba.save(&image_path)
            .map_err(|error| format!("保存后处理预览图失败：{error}"))?;

        let image_bytes = fs::read(&image_path)
            .map_err(|error| format!("读取后处理预览图失败：{error}"))?;
        let project_relative_path =
            format!("assets/.cache/character-candidates/{task_id}/preview/{plan_id}/{file_name}");

        let asset = CharacterImageAsset {
            absolute_path: image_path.to_string_lossy().to_string(),
            data_url: build_image_data_url(&image_bytes),
            height: rgba.height(),
            id: format!("{task_id}-{plan_id}-preview-{kind}"),
            project_relative_path,
            role: "preview".to_string(),
            source: "candidate-preview".to_string(),
            width: rgba.width(),
        };

        assign_direction_preview(&mut output_previews, kind, asset);
    }

    if output_previews.front.is_none()
        && output_previews.back.is_none()
        && output_previews.left.is_none()
        && output_previews.right.is_none()
    {
        return Err("没有可用于后处理预览的候选图。".to_string());
    }

    Ok(PreviewCandidatePostProcessResult {
        analyze_report: if input.options.run_analyze {
            Some(PreviewCandidateAnalyzeReport {
                score: analyze_score,
                warnings: analyze_warnings,
            })
        } else {
            None
        },
        direction_previews: output_previews,
        plan_id: input.plan_id,
    })
}

fn direction_preview_for_kind<'a>(
    previews: &'a CharacterDirectionPreviews,
    kind: &str,
) -> Option<&'a CharacterImageAsset> {
    match kind {
        "front" => previews.front.as_ref(),
        "back" => previews.back.as_ref(),
        "left" => previews.left.as_ref(),
        "right" => previews.right.as_ref(),
        _ => None,
    }
}

fn assign_direction_preview(previews: &mut CharacterDirectionPreviews, kind: &str, asset: CharacterImageAsset) {
    match kind {
        "front" => previews.front = Some(asset),
        "back" => previews.back = Some(asset),
        "left" => previews.left = Some(asset),
        "right" => previews.right = Some(asset),
        _ => {}
    }
}

fn resolve_source_image_path(project_root: &Path, image: &CharacterImageAsset) -> Result<PathBuf, String> {
    if !image.absolute_path.trim().is_empty() {
        let path = PathBuf::from(image.absolute_path.trim());
        if path.is_file() {
            return Ok(path);
        }
    }

    let relative_path = project_root.join(image.project_relative_path.trim());
    if relative_path.is_file() {
        return Ok(relative_path);
    }

    Err(format!(
        "候选图源图不存在：{}",
        image.project_relative_path.trim()
    ))
}

fn apply_background_removal(
    rgba: &RgbaImage,
    source_path: &Path,
    preview_directory: &Path,
    kind: &str,
    params: &PreviewCandidateRemoveBackgroundParamsInput,
) -> Result<RgbaImage, String> {
    let mut cursor = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgba8(rgba.clone())
        .write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|error| format!("编码候选图失败：{error}"))?;
    let source_bytes = cursor.into_inner();

    let output_path = preview_directory.join(format!("{kind}_transparent.png"));
    let png_bytes = if params.engine.trim() == "rembg" {
        run_rembg_remove(
            source_path,
            &output_path,
            RembgRemovalOptions {
                alpha_matting: params.alpha_matting,
                custom_model_path: params.custom_model_path.clone(),
                executable_path: params.executable_path.clone(),
                model: if params.model.trim().is_empty() {
                    "isnet-general-use".to_string()
                } else {
                    params.model.trim().to_string()
                },
            },
        )?;
        fs::read(&output_path).map_err(|error| format!("读取 rembg 输出失败：{error}"))?
    } else {
        let procedural_options = ProceduralBackgroundRemovalOptions {
            cleanup_strength: match params.cleanup_strength.as_str() {
                "off" => ProceduralCleanupStrength::Off,
                "soft" => ProceduralCleanupStrength::Soft,
                "strict" => ProceduralCleanupStrength::Strict,
                _ => ProceduralCleanupStrength::Standard,
            },
            hole_fill_max_pixels: params.hole_fill_max_pixels.clamp(0, 4096) as usize,
            matting_color_space: MattingColorSpace::from_option(Some(
                params.matting_color_space.as_str(),
            )),
            preserve_small_parts: params.preserve_small_parts,
            spill_suppression: (params.spill_suppression.clamp(0, 100) as f32) / 100.0,
        };
        let removal = remove_background_from_image_bytes(
            &source_bytes,
            params.tolerance.clamp(8, 96),
            params.edge_softness.clamp(0, 96),
            procedural_options,
        )?;
        fs::write(&output_path, &removal.png_bytes)
            .map_err(|error| format!("写入去背景预览失败：{error}"))?;
        removal.png_bytes
    };

    let removal = build_background_removal_output_from_png(
        png_bytes,
        if params.engine.trim() == "rembg" {
            build_rembg_warnings(
                params.alpha_matting,
                params.foreground_threshold,
                params.background_threshold,
            )
        } else {
            Vec::new()
        },
    )?;

    Ok(image::load_from_memory(&removal.png_bytes)
        .map_err(|error| format!("解析去背景预览图失败：{error}"))?
        .to_rgba8())
}

fn score_from_quality_report(
    report: &crate::image_pipeline::quality::ImageQualityReport,
    params: &PreviewCandidateAnalyzeParamsInput,
) -> u16 {
    let coverage_pct = report.alpha_coverage * 100.0;
    let mut score = 100_u16;

    if coverage_pct < params.min_alpha_coverage_pct {
        score = score.saturating_sub(25);
    }

    if let Some(bbox) = &report.bbox {
        let ratio = bbox.height as f64 / report.height.max(1) as f64 * 100.0;
        if ratio > params.max_bbox_ratio_pct {
            score = score.saturating_sub(20);
        }
    }

    if !report.warnings.is_empty() {
        score = score.saturating_sub(10);
    }

    score.max(40)
}

fn build_analyze_warnings(
    report: &crate::image_pipeline::quality::ImageQualityReport,
    params: &PreviewCandidateAnalyzeParamsInput,
) -> Vec<String> {
    let mut warnings = report.warnings.clone();
    let coverage_pct = report.alpha_coverage * 100.0;

    if coverage_pct < params.min_alpha_coverage_pct {
        warnings.push(format!(
            "前景占比 {coverage_pct:.1}% 低于阈值 {}%。",
            params.min_alpha_coverage_pct
        ));
    }

    if let Some(bbox) = &report.bbox {
        let ratio = bbox.height as f64 / report.height.max(1) as f64 * 100.0;
        if ratio > params.max_bbox_ratio_pct {
            warnings.push(format!(
                "主体高度占比 {ratio:.1}% 超过阈值 {}%。",
                params.max_bbox_ratio_pct
            ));
        }
    }

    warnings
}

fn apply_normalize_preview(
    rgba: &RgbaImage,
    target_width: u32,
    target_height: u32,
    scale_mode: &str,
    background_removed: bool,
) -> RgbaImage {
    let target_width = target_width.max(1);
    let target_height = target_height.max(1);

    if rgba.width() == target_width && rgba.height() == target_height {
        let report = analyze_rgba_image(rgba);
        if let Some(bbox) = &report.bbox {
            if bbox.width <= target_width && bbox.height <= target_height {
                return rgba.clone();
            }
        }
    }

    let report = analyze_rgba_image(rgba);
    let effective_scale_mode = if !background_removed && report.alpha_coverage > 0.88 {
        "none"
    } else {
        scale_mode
    };

    workflow_fit_rgba_image_pixel_friendly(
        rgba,
        target_width,
        target_height,
        None,
        effective_scale_mode,
    )
}
