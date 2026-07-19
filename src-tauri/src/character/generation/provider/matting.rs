use std::io::Cursor;

use image::{DynamicImage, ImageFormat, RgbaImage};

use crate::character::model::*;

pub(crate) struct BackgroundRemovalOutput {
    pub(crate) bbox: Option<BoundingBox>,
    pub(crate) height: u32,
    pub(crate) png_bytes: Vec<u8>,
    pub(crate) score: Option<u16>,
    pub(crate) warnings: Vec<String>,
    pub(crate) width: u32,
}

pub(crate) fn remove_background_from_image_bytes(
    image_bytes: &[u8],
    tolerance: u8,
    edge_softness: u8,
    options: ProceduralBackgroundRemovalOptions,
) -> Result<BackgroundRemovalOutput, String> {
    let mut image = image::load_from_memory(image_bytes)
        .map_err(|error| format!("去背景源图不是可识别图片：{error}"))?
        .to_rgba8();
    let width = image.width();
    let height = image.height();

    if width == 0 || height == 0 {
        return Err("去背景源图尺寸无效。".to_string());
    }

    let background_profile = estimate_background_profile(&image);
    let pixel_count = usize::try_from(width)
        .ok()
        .and_then(|w| usize::try_from(height).ok().and_then(|h| w.checked_mul(h)))
        .ok_or_else(|| "去背景源图尺寸过大，无法进行程序化去背景。".to_string())?;
    let tolerance = tolerance as f32;
    let edge_softness = edge_softness as f32;
    let feather = tolerance + edge_softness.max(1.0);
    let mut alpha_mask = Vec::with_capacity(pixel_count);

    for pixel in image.pixels() {
        if pixel[3] == 0 {
            alpha_mask.push(0);
            continue;
        }

        let distance = nearest_background_distance(
            [pixel[0], pixel[1], pixel[2]],
            &background_profile,
            options.matting_color_space,
        );

        if distance <= tolerance {
            alpha_mask.push(0);
        } else if distance < feather {
            let alpha_scale = ((distance - tolerance) / (feather - tolerance)).clamp(0.0, 1.0);
            alpha_mask.push(((pixel[3] as f32) * alpha_scale).round() as u8);
        } else {
            alpha_mask.push(pixel[3]);
        }
    }

    let cleanup_report = super::refine_procedural_alpha_mask(&mut alpha_mask, width, height, options);
    super::apply_alpha_mask_with_spill_suppression(
        &mut image,
        &alpha_mask,
        &background_profile,
        options.spill_suppression,
    );

    let bbox = super::calculate_alpha_bbox(&image);
    let mut warnings = Vec::new();

    if bbox.is_none() {
        warnings.push("未检测到明确前景，请降低容差或更换背景模式。".to_string());
    }

    if super::is_low_contrast_background(background_profile.primary) {
        warnings.push("背景色与角色颜色接近，边缘可能需要人工复检。".to_string());
    }

    if background_profile.variance > 28.0 {
        warnings.push("检测到背景存在明显渐变或噪声，程序化去背景可能残留少量边缘。".to_string());
    }

    if cleanup_report.removed_components > 0 {
        warnings.push(format!(
            "已清理 {} 个孤立背景碎点。",
            cleanup_report.removed_components
        ));
    }

    if cleanup_report.filled_holes > 0 {
        warnings.push(format!(
            "已填补 {} 个内部透明孔洞。",
            cleanup_report.filled_holes
        ));
    }

    let mut output = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image)
        .write_to(&mut output, ImageFormat::Png)
        .map_err(|error| format!("编码透明 PNG 失败：{error}"))?;

    Ok(BackgroundRemovalOutput {
        bbox,
        height,
        png_bytes: output.into_inner(),
        score: Some(super::score_procedural_background_removal(
            &warnings,
            cleanup_report.foreground_pixels,
        )),
        warnings,
        width,
    })
}

pub(crate) fn build_background_removal_output_from_png(
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

    let bbox = super::calculate_alpha_bbox(&image);

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

pub(crate) fn build_rembg_warnings(
    alpha_matting: bool,
    foreground_threshold: Option<u8>,
    background_threshold: Option<u8>,
) -> Vec<String> {
    let mut warnings = Vec::new();

    if !alpha_matting {
        warnings.push(
            "AI 语义去背景未启用 Alpha Matting，复杂发丝、披风或光效边缘可能需要复检。".to_string(),
        );
    }

    if let (Some(foreground), Some(background)) = (foreground_threshold, background_threshold) {
        if foreground <= background {
            warnings
                .push("前景阈值不应低于背景阈值；当前版本暂未将该阈值传入 rembg CLI。".to_string());
        }
    }

    warnings
}

#[derive(Clone)]
pub(crate) struct BackgroundColorProfile {
    pub(crate) primary: [u8; 3],
    pub(crate) samples: Vec<[u8; 3]>,
    pub(crate) variance: f32,
}

#[derive(Clone, Copy)]
pub(crate) struct AlphaCleanupReport {
    pub(crate) filled_holes: usize,
    pub(crate) foreground_pixels: usize,
    pub(crate) removed_components: usize,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum ProceduralCleanupStrength {
    Off,
    Soft,
    Standard,
    Strict,
}

#[derive(Clone, Copy)]
pub(crate) struct ProceduralBackgroundRemovalOptions {
    pub(crate) cleanup_strength: ProceduralCleanupStrength,
    pub(crate) hole_fill_max_pixels: usize,
    pub(crate) matting_color_space: crate::image_pipeline::color_space::MattingColorSpace,
    pub(crate) preserve_small_parts: bool,
    pub(crate) spill_suppression: f32,
}

impl ProceduralBackgroundRemovalOptions {
    pub(crate) fn from_input(input: &RemoveCharacterBackgroundInput) -> Self {
        Self {
            cleanup_strength: ProceduralCleanupStrength::from_value(
                input.cleanup_strength.as_deref(),
            ),
            hole_fill_max_pixels: input.hole_fill_max_pixels.unwrap_or(128).clamp(0, 4096) as usize,
            matting_color_space: crate::image_pipeline::color_space::MattingColorSpace::from_option(
                input.matting_color_space.as_deref(),
            ),
            preserve_small_parts: input.preserve_small_parts,
            spill_suppression: (input.spill_suppression.unwrap_or(45).clamp(0, 100) as f32) / 100.0,
        }
    }
}

impl ProceduralCleanupStrength {
    fn from_value(value: Option<&str>) -> Self {
        match value.unwrap_or("standard") {
            "off" => Self::Off,
            "soft" => Self::Soft,
            "strict" => Self::Strict,
            _ => Self::Standard,
        }
    }

    pub(crate) fn component_keep_ratio(self) -> f32 {
        match self {
            Self::Off => 0.0,
            Self::Soft => 0.015,
            Self::Standard => 0.035,
            Self::Strict => 0.07,
        }
    }

    pub(crate) fn min_component_size(self) -> usize {
        match self {
            Self::Off => 0,
            Self::Soft => 8,
            Self::Standard => 12,
            Self::Strict => 20,
        }
    }
}

pub(crate) fn estimate_background_profile(image: &RgbaImage) -> BackgroundColorProfile {
    let width = image.width();
    let height = image.height();
    let sample_size = width.min(height).min(14).max(1);
    let mut total = [0_u64; 3];
    let mut count = 0_u64;
    let mut samples = Vec::new();

    for y in 0..sample_size {
        for x in 0..sample_size {
            add_background_sample(image, x, y, &mut total, &mut count, &mut samples);
            add_background_sample(
                image,
                width - 1 - x,
                y,
                &mut total,
                &mut count,
                &mut samples,
            );
            add_background_sample(
                image,
                x,
                height - 1 - y,
                &mut total,
                &mut count,
                &mut samples,
            );
            add_background_sample(
                image,
                width - 1 - x,
                height - 1 - y,
                &mut total,
                &mut count,
                &mut samples,
            );
        }
    }

    if count == 0 {
        return BackgroundColorProfile {
            primary: [255, 255, 255],
            samples: vec![[255, 255, 255]],
            variance: 0.0,
        };
    }

    let primary = [
        (total[0] / count) as u8,
        (total[1] / count) as u8,
        (total[2] / count) as u8,
    ];
    let variance = if samples.is_empty() {
        0.0
    } else {
        samples
            .iter()
            .map(|sample| {
                crate::image_pipeline::color_space::color_distance(
                    *sample,
                    primary,
                    crate::image_pipeline::color_space::MattingColorSpace::Rgb,
                )
            })
            .sum::<f32>()
            / samples.len() as f32
    };

    let mut anchors = vec![primary];
    anchors.extend(select_background_anchor_colors(&samples, primary));

    BackgroundColorProfile {
        primary,
        samples: anchors,
        variance,
    }
}

pub(crate) fn add_background_sample(
    image: &RgbaImage,
    x: u32,
    y: u32,
    total: &mut [u64; 3],
    count: &mut u64,
    samples: &mut Vec<[u8; 3]>,
) {
    let pixel = image.get_pixel(x, y);

    if pixel[3] < 16 {
        return;
    }

    total[0] += pixel[0] as u64;
    total[1] += pixel[1] as u64;
    total[2] += pixel[2] as u64;
    samples.push([pixel[0], pixel[1], pixel[2]]);
    *count += 1;
}

pub(crate) fn select_background_anchor_colors(samples: &[[u8; 3]], primary: [u8; 3]) -> Vec<[u8; 3]> {
    let mut anchors = Vec::new();

    for sample in samples {
        if crate::image_pipeline::color_space::color_distance(
            *sample,
            primary,
            crate::image_pipeline::color_space::MattingColorSpace::Rgb,
        ) < 18.0
        {
            continue;
        }

        if anchors.iter().any(|anchor| {
            crate::image_pipeline::color_space::color_distance(
                *sample,
                *anchor,
                crate::image_pipeline::color_space::MattingColorSpace::Rgb,
            ) < 24.0
        })
        {
            continue;
        }

        anchors.push(*sample);

        if anchors.len() >= 5 {
            break;
        }
    }

    anchors
}

pub(crate) fn nearest_background_distance(
    color: [u8; 3],
    profile: &BackgroundColorProfile,
    space: crate::image_pipeline::color_space::MattingColorSpace,
) -> f32 {
    profile
        .samples
        .iter()
        .map(|sample| {
            crate::image_pipeline::color_space::color_distance(color, *sample, space)
        })
        .fold(f32::MAX, f32::min)
}

