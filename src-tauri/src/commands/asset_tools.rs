use std::fs;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{ImageFormat, RgbaImage};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tracing::info;

use crate::commands::background_tools::{run_rembg_remove, RembgRemovalOptions};
use crate::image_pipeline::background_removal::{
    parse_hex_color, remove_background_from_image_bytes, BackgroundRemovalOutput, BoundingBox,
    ProceduralBackgroundRemovalOptions, ProceduralCleanupStrength,
};
use crate::image_pipeline::color_space::MattingColorSpace;
use crate::storage::database::current_timestamp;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunAssetToolInput {
    #[serde(default)]
    background_removal: Option<BackgroundRemovalToolOptionsInput>,
    project_root: String,
    source: AssetToolSourceInput,
    tool_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadAssetToolSourcePreviewInput {
    project_root: String,
    source: AssetToolSourceInput,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetToolSourceInput {
    kind: String,
    path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BackgroundRemovalToolOptionsInput {
    #[serde(default)]
    alpha_matting: bool,
    #[serde(default)]
    cleanup_strength: Option<String>,
    #[serde(default)]
    edge_offset: Option<i8>,
    #[serde(default)]
    edge_softness: Option<u8>,
    #[serde(default)]
    engine: Option<String>,
    #[serde(default)]
    executable_path: String,
    #[serde(default)]
    hole_fill_max_pixels: Option<u32>,
    #[serde(default)]
    manual_background_samples: Vec<String>,
    #[serde(default)]
    model_path: String,
    #[serde(default)]
    preserve_small_parts: bool,
    #[serde(default)]
    rembg_model: String,
    #[serde(default)]
    spill_suppression: Option<u8>,
    #[serde(default)]
    tolerance: Option<u8>,
    #[serde(default)]
    matting_color_space: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetToolResult {
    pub(crate) bbox: Option<BoundingBox>,
    pub(crate) created_at: String,
    pub(crate) id: String,
    pub(crate) options_snapshot: serde_json::Value,
    pub(crate) output_image: AssetToolImage,
    pub(crate) score: Option<u16>,
    pub(crate) source_path: String,
    pub(crate) tool_id: String,
    pub(crate) warnings: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetToolImage {
    pub(crate) absolute_path: String,
    pub(crate) data_url: String,
    pub(crate) height: u32,
    pub(crate) project_relative_path: String,
    pub(crate) width: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetToolSourcePreview {
    data_url: String,
    height: u32,
    source_path: String,
    width: u32,
}

#[tauri::command]
pub fn load_asset_tool_source_preview(
    input: LoadAssetToolSourcePreviewInput,
) -> Result<AssetToolSourcePreview, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let source_path = resolve_asset_tool_source(&project_root, &input.source)?;
    let source_bytes =
        fs::read(&source_path).map_err(|error| format!("读取素材预览图失败：{error}"))?;
    let image_format = ensure_supported_image(&source_bytes)?;
    let image = image::load_from_memory(&source_bytes)
        .map_err(|error| format!("解析素材预览图失败：{error}"))?;

    info!(
        target = "jmtools::asset_tools",
        source = %source_path.to_string_lossy(),
        width = image.width(),
        height = image.height(),
        "asset tool source preview loaded"
    );

    Ok(AssetToolSourcePreview {
        data_url: build_image_data_url_with_format(&source_bytes, image_format),
        height: image.height(),
        source_path: source_path.to_string_lossy().to_string(),
        width: image.width(),
    })
}

#[tauri::command]
pub fn run_asset_tool(
    _app: AppHandle,
    input: RunAssetToolInput,
) -> Result<AssetToolResult, String> {
    if input.tool_id.trim() != "background-removal" {
        return Err("当前版本只支持去背景工具。".to_string());
    }

    let project_root = validate_project_root(&input.project_root)?;
    let source_path = resolve_asset_tool_source(&project_root, &input.source)?;
    let source_bytes =
        fs::read(&source_path).map_err(|error| format!("读取素材源图失败：{error}"))?;
    ensure_supported_image(&source_bytes)?;

    let options = input.background_removal.unwrap_or_default();
    run_background_removal_asset_tool(&project_root, &source_path, options)
}

pub(crate) fn run_background_removal_asset_tool(
    project_root: &Path,
    source_path: &Path,
    options: BackgroundRemovalToolOptionsInput,
) -> Result<AssetToolResult, String> {
    let source_bytes =
        fs::read(source_path).map_err(|error| format!("读取素材源图失败：{error}"))?;
    ensure_supported_image(&source_bytes)?;
    let task_id = format!("tool-{}", current_timestamp());
    let output_directory = project_root
        .join("assets")
        .join(".cache")
        .join("tools")
        .join("background-removal")
        .join(&task_id);
    fs::create_dir_all(&output_directory)
        .map_err(|error| format!("创建工具输出目录失败：{error}"))?;

    let output_file_name = "transparent.png";
    let output_path = output_directory.join(output_file_name);
    let removal = run_background_removal(source_path, &source_bytes, &output_path, &options)?;

    if !output_path.is_file() {
        fs::write(&output_path, &removal.png_bytes)
            .map_err(|error| format!("写入工具输出图片失败：{error}"))?;
    }

    let project_relative_path =
        format!("assets/.cache/tools/background-removal/{task_id}/{output_file_name}");
    let created_at = current_timestamp().to_string();

    info!(
        target = "jmtools::asset_tools",
        tool_id = "background-removal",
        source = %source_path.to_string_lossy(),
        output = %output_path.to_string_lossy(),
        "asset tool completed"
    );

    Ok(AssetToolResult {
        bbox: removal.bbox,
        created_at,
        id: task_id,
        options_snapshot: build_options_snapshot(&options),
        output_image: AssetToolImage {
            absolute_path: output_path.to_string_lossy().to_string(),
            data_url: build_image_data_url(&removal.png_bytes),
            height: removal.height,
            project_relative_path,
            width: removal.width,
        },
        score: removal.score,
        source_path: source_path.to_string_lossy().to_string(),
        tool_id: "background-removal".to_string(),
        warnings: removal.warnings,
    })
}

impl Default for BackgroundRemovalToolOptionsInput {
    fn default() -> Self {
        Self {
            alpha_matting: false,
            cleanup_strength: Some("standard".to_string()),
            edge_offset: Some(0),
            edge_softness: Some(24),
            engine: Some("chroma".to_string()),
            executable_path: String::new(),
            hole_fill_max_pixels: Some(128),
            manual_background_samples: Vec::new(),
            model_path: String::new(),
            preserve_small_parts: false,
            rembg_model: "isnet-general-use".to_string(),
            spill_suppression: Some(45),
            tolerance: Some(34),
            matting_color_space: None,
        }
    }
}

fn run_background_removal(
    source_path: &Path,
    source_bytes: &[u8],
    output_path: &Path,
    options: &BackgroundRemovalToolOptionsInput,
) -> Result<BackgroundRemovalOutput, String> {
    let engine = options.engine.as_deref().unwrap_or("chroma");

    if !matches!(engine, "chroma" | "rembg") {
        return Err("去背景算法设置不受支持。".to_string());
    }

    if engine == "rembg" {
        run_rembg_remove(
            source_path,
            output_path,
            RembgRemovalOptions {
                alpha_matting: options.alpha_matting,
                custom_model_path: options.model_path.clone(),
                executable_path: options.executable_path.clone(),
                model: if options.rembg_model.trim().is_empty() {
                    "isnet-general-use".to_string()
                } else {
                    options.rembg_model.trim().to_string()
                },
            },
        )?;

        let output_bytes =
            fs::read(output_path).map_err(|error| format!("读取 rembg 输出图片失败：{error}"))?;
        build_background_removal_output_from_png(output_bytes, build_rembg_warnings(options))
    } else {
        remove_background_from_image_bytes(source_bytes, build_procedural_options(options))
    }
}

fn build_procedural_options(
    input: &BackgroundRemovalToolOptionsInput,
) -> ProceduralBackgroundRemovalOptions {
    let manual_background_samples = input
        .manual_background_samples
        .iter()
        .filter_map(|value| parse_hex_color(value))
        .collect();

    ProceduralBackgroundRemovalOptions {
        cleanup_strength: ProceduralCleanupStrength::from_value(input.cleanup_strength.as_deref()),
        edge_offset: input.edge_offset.unwrap_or(0).clamp(-6, 6),
        edge_softness: input.edge_softness.unwrap_or(24).clamp(0, 96),
        hole_fill_max_pixels: input.hole_fill_max_pixels.unwrap_or(128).clamp(0, 4096) as usize,
        manual_background_samples,
        preserve_small_parts: input.preserve_small_parts,
        spill_suppression: (input.spill_suppression.unwrap_or(45).clamp(0, 100) as f32) / 100.0,
        tolerance: input.tolerance.unwrap_or(34).clamp(4, 96),
        matting_color_space: MattingColorSpace::from_option(input.matting_color_space.as_deref()),
    }
}

fn build_background_removal_output_from_png(
    png_bytes: Vec<u8>,
    mut warnings: Vec<String>,
) -> Result<BackgroundRemovalOutput, String> {
    let image = image::load_from_memory(&png_bytes)
        .map_err(|error| format!("rembg 输出图片不是可识别图片：{error}"))?
        .to_rgba8();
    let width = image.width();
    let height = image.height();

    if width == 0 || height == 0 {
        return Err("rembg 输出图片尺寸无效。".to_string());
    }

    let bbox = calculate_alpha_bbox(&image);

    if bbox.is_none() {
        warnings
            .push("rembg 未检测到明确前景，请检查模型、源图或改用快速纯色背景参数。".to_string());
    }

    Ok(BackgroundRemovalOutput {
        bbox,
        height,
        png_bytes,
        score: Some(if warnings.is_empty() { 94 } else { 82 }),
        warnings,
        width,
    })
}

fn build_rembg_warnings(options: &BackgroundRemovalToolOptionsInput) -> Vec<String> {
    let mut warnings = Vec::new();

    if !options.alpha_matting {
        warnings.push("AI 语义去背景未启用 Alpha Matting，复杂边缘可能需要复检。".to_string());
    }

    warnings
}

fn validate_project_root(project_root: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_root.trim());

    if root.as_os_str().is_empty() {
        return Err("项目目录不能为空。".to_string());
    }

    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("解析项目目录失败：{error}"))?;
    let manifest_path = canonical_root.join("jmproject.json");

    if !manifest_path.is_file() {
        return Err("当前目录不是有效的 JMTools 项目。".to_string());
    }

    Ok(canonical_root)
}

fn resolve_asset_tool_source(
    project_root: &Path,
    source: &AssetToolSourceInput,
) -> Result<PathBuf, String> {
    let source_path = source.path.trim();

    if source_path.is_empty() {
        return Err("素材源图路径不能为空。".to_string());
    }

    let candidate_path = match source.kind.trim() {
        "projectRelativePath" => project_root.join(source_path),
        "absolutePath" => PathBuf::from(source_path),
        _ => return Err("素材源图路径类型不受支持。".to_string()),
    };

    if !candidate_path.is_file() {
        return Err("素材源图不存在。".to_string());
    }

    candidate_path
        .canonicalize()
        .map_err(|error| format!("解析素材源图路径失败：{error}"))
}

fn ensure_supported_image(image_bytes: &[u8]) -> Result<ImageFormat, String> {
    image::guess_format(image_bytes)
        .map_err(|error| format!("无法识别素材图片格式：{error}"))
        .and_then(|format| match format {
            ImageFormat::Png | ImageFormat::Jpeg | ImageFormat::WebP => Ok(format),
            _ => Err("当前工具仅支持 PNG、JPG 和 WEBP 图片。".to_string()),
        })
}

fn calculate_alpha_bbox(image: &RgbaImage) -> Option<BoundingBox> {
    let mut min_x = image.width();
    let mut min_y = image.height();
    let mut max_x = 0;
    let mut max_y = 0;
    let mut found_foreground = false;

    for (x, y, pixel) in image.enumerate_pixels() {
        if pixel[3] <= 8 {
            continue;
        }

        found_foreground = true;
        min_x = min_x.min(x);
        min_y = min_y.min(y);
        max_x = max_x.max(x);
        max_y = max_y.max(y);
    }

    if !found_foreground {
        return None;
    }

    Some(BoundingBox {
        height: max_y.saturating_sub(min_y) + 1,
        width: max_x.saturating_sub(min_x) + 1,
        x: min_x,
        y: min_y,
    })
}

fn build_image_data_url(image_bytes: &[u8]) -> String {
    format!("data:image/png;base64,{}", STANDARD.encode(image_bytes))
}

fn build_image_data_url_with_format(image_bytes: &[u8], format: ImageFormat) -> String {
    let mime = match format {
        ImageFormat::Jpeg => "image/jpeg",
        ImageFormat::WebP => "image/webp",
        _ => "image/png",
    };

    format!("data:{mime};base64,{}", STANDARD.encode(image_bytes))
}

fn build_options_snapshot(options: &BackgroundRemovalToolOptionsInput) -> serde_json::Value {
    serde_json::json!({
        "alphaMatting": options.alpha_matting,
        "cleanupStrength": options.cleanup_strength.as_deref().unwrap_or("standard"),
        "edgeOffset": options.edge_offset.unwrap_or(0).clamp(-6, 6),
        "edgeSoftness": options.edge_softness.unwrap_or(24).clamp(0, 96),
        "engine": options.engine.as_deref().unwrap_or("chroma"),
        "holeFillMaxPixels": options.hole_fill_max_pixels.unwrap_or(128).clamp(0, 4096),
        "manualBackgroundSamples": options.manual_background_samples,
        "preserveSmallParts": options.preserve_small_parts,
        "rembgModel": if options.rembg_model.trim().is_empty() { "isnet-general-use" } else { options.rembg_model.trim() },
        "spillSuppression": options.spill_suppression.unwrap_or(45).clamp(0, 100),
        "tolerance": options.tolerance.unwrap_or(34).clamp(4, 96),
    })
}
