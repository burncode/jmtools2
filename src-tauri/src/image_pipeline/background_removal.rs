use std::collections::VecDeque;
use std::io::Cursor;

use image::{DynamicImage, ImageFormat, RgbaImage};
use serde::{Deserialize, Serialize};

use super::color_space::{color_distance, MattingColorSpace};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundingBox {
    pub height: u32,
    pub width: u32,
    pub x: u32,
    pub y: u32,
}

#[derive(Clone)]
pub struct BackgroundRemovalOutput {
    pub bbox: Option<BoundingBox>,
    pub height: u32,
    pub png_bytes: Vec<u8>,
    pub score: Option<u16>,
    pub warnings: Vec<String>,
    pub width: u32,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ProceduralCleanupStrength {
    Off,
    Soft,
    Standard,
    Strict,
}

#[derive(Clone)]
pub struct ProceduralBackgroundRemovalOptions {
    pub cleanup_strength: ProceduralCleanupStrength,
    pub edge_offset: i8,
    pub edge_softness: u8,
    pub hole_fill_max_pixels: usize,
    pub manual_background_samples: Vec<[u8; 3]>,
    pub preserve_small_parts: bool,
    pub spill_suppression: f32,
    pub tolerance: u8,
    pub matting_color_space: MattingColorSpace,
}

impl Default for ProceduralBackgroundRemovalOptions {
    fn default() -> Self {
        Self {
            cleanup_strength: ProceduralCleanupStrength::Standard,
            edge_offset: 0,
            edge_softness: 24,
            hole_fill_max_pixels: 128,
            manual_background_samples: Vec::new(),
            preserve_small_parts: false,
            spill_suppression: 0.45,
            tolerance: 34,
            matting_color_space: MattingColorSpace::Rgb,
        }
    }
}

impl ProceduralCleanupStrength {
    pub fn from_value(value: Option<&str>) -> Self {
        match value.unwrap_or("standard") {
            "off" => Self::Off,
            "soft" => Self::Soft,
            "strict" => Self::Strict,
            _ => Self::Standard,
        }
    }

    fn component_keep_ratio(self) -> f32 {
        match self {
            Self::Off => 0.0,
            Self::Soft => 0.015,
            Self::Standard => 0.035,
            Self::Strict => 0.07,
        }
    }

    fn min_component_size(self) -> usize {
        match self {
            Self::Off => 0,
            Self::Soft => 8,
            Self::Standard => 12,
            Self::Strict => 20,
        }
    }
}

pub fn parse_hex_color(value: &str) -> Option<[u8; 3]> {
    let normalized = value.trim().trim_start_matches('#');

    if normalized.len() != 6 {
        return None;
    }

    let red = u8::from_str_radix(&normalized[0..2], 16).ok()?;
    let green = u8::from_str_radix(&normalized[2..4], 16).ok()?;
    let blue = u8::from_str_radix(&normalized[4..6], 16).ok()?;

    Some([red, green, blue])
}

pub fn remove_background_from_image_bytes(
    image_bytes: &[u8],
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

    let background_profile =
        estimate_background_profile(&image, &options.manual_background_samples);
    let pixel_count = mask_len(width, height)
        .ok_or_else(|| "去背景源图尺寸过大，无法进行程序化去背景。".to_string())?;
    let tolerance = options.tolerance as f32;
    let edge_softness = options.edge_softness as f32;
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

    if options.edge_offset != 0 {
        alpha_mask = offset_alpha_mask(&alpha_mask, width, height, options.edge_offset);
    }

    let cleanup_report = refine_procedural_alpha_mask(&mut alpha_mask, width, height, &options);
    apply_alpha_mask_with_spill_suppression(
        &mut image,
        &alpha_mask,
        &background_profile,
        options.spill_suppression,
    );

    let bbox = calculate_alpha_bbox(&image);
    let mut warnings = Vec::new();

    if bbox.is_none() {
        warnings.push("未检测到明确前景，请降低容差或更换背景模式。".to_string());
    }

    if is_low_contrast_background(background_profile.primary) {
        warnings.push("背景色与素材颜色接近，边缘可能需要人工复检。".to_string());
    }

    if background_profile.variance > 28.0 && options.manual_background_samples.is_empty() {
        warnings.push("检测到背景存在明显渐变或噪声，建议使用吸管补充背景采样色。".to_string());
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
        score: Some(score_procedural_background_removal(
            &warnings,
            cleanup_report.foreground_pixels,
        )),
        warnings,
        width,
    })
}

#[derive(Clone)]
struct BackgroundColorProfile {
    primary: [u8; 3],
    samples: Vec<[u8; 3]>,
    variance: f32,
}

#[derive(Clone, Copy)]
struct AlphaCleanupReport {
    filled_holes: usize,
    foreground_pixels: usize,
    removed_components: usize,
}

fn estimate_background_profile(
    image: &RgbaImage,
    manual_samples: &[[u8; 3]],
) -> BackgroundColorProfile {
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

    for sample in manual_samples {
        total[0] += sample[0] as u64;
        total[1] += sample[1] as u64;
        total[2] += sample[2] as u64;
        samples.push(*sample);
        count += 1;
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
            .map(|sample| color_distance(*sample, primary, MattingColorSpace::Rgb))
            .sum::<f32>()
            / samples.len() as f32
    };

    let mut anchors = vec![primary];
    anchors.extend(manual_samples.iter().copied());
    anchors.extend(select_background_anchor_colors(&samples, primary));

    BackgroundColorProfile {
        primary,
        samples: anchors,
        variance,
    }
}

fn add_background_sample(
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

fn select_background_anchor_colors(samples: &[[u8; 3]], primary: [u8; 3]) -> Vec<[u8; 3]> {
    let mut anchors = Vec::new();

    for sample in samples {
        if color_distance(*sample, primary, MattingColorSpace::Rgb) < 18.0 {
            continue;
        }

        if anchors
            .iter()
            .any(|anchor| color_distance(*sample, *anchor, MattingColorSpace::Rgb) < 24.0)
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

fn nearest_background_distance(
    color: [u8; 3],
    profile: &BackgroundColorProfile,
    space: MattingColorSpace,
) -> f32 {
    profile
        .samples
        .iter()
        .map(|sample| color_distance(color, *sample, space))
        .fold(f32::MAX, f32::min)
}

fn offset_alpha_mask(mask: &[u8], width: u32, height: u32, edge_offset: i8) -> Vec<u8> {
    let steps = edge_offset.unsigned_abs().min(6);
    let mut next_mask = mask.to_vec();

    for _ in 0..steps {
        next_mask = if edge_offset > 0 {
            dilate_alpha_mask(&next_mask, width, height)
        } else {
            erode_alpha_mask(&next_mask, width, height)
        };
    }

    next_mask
}

fn dilate_alpha_mask(mask: &[u8], width: u32, height: u32) -> Vec<u8> {
    let mut next_mask = mask.to_vec();

    for (index, alpha) in mask.iter().enumerate() {
        if *alpha > 8 {
            continue;
        }

        let strongest_neighbor = alpha_neighbors(index, width, height)
            .into_iter()
            .filter_map(|neighbor| mask.get(neighbor).copied())
            .max()
            .unwrap_or(0);

        if strongest_neighbor > 8 {
            next_mask[index] = strongest_neighbor.saturating_sub(18);
        }
    }

    next_mask
}

fn erode_alpha_mask(mask: &[u8], width: u32, height: u32) -> Vec<u8> {
    let mut next_mask = mask.to_vec();

    for (index, alpha) in mask.iter().enumerate() {
        if *alpha <= 8 {
            continue;
        }

        if alpha_neighbors(index, width, height)
            .into_iter()
            .any(|neighbor| mask.get(neighbor).copied().unwrap_or(0) <= 8)
        {
            next_mask[index] = 0;
        }
    }

    next_mask
}

fn refine_procedural_alpha_mask(
    mask: &mut [u8],
    width: u32,
    height: u32,
    options: &ProceduralBackgroundRemovalOptions,
) -> AlphaCleanupReport {
    let mut report = keep_largest_foreground_regions(mask, width, height, options);
    let filled_holes = fill_internal_alpha_holes(mask, width, height, options.hole_fill_max_pixels);

    report.filled_holes = filled_holes;
    report.foreground_pixels = mask.iter().filter(|alpha| **alpha > 8).count();
    report
}

fn keep_largest_foreground_regions(
    mask: &mut [u8],
    width: u32,
    height: u32,
    options: &ProceduralBackgroundRemovalOptions,
) -> AlphaCleanupReport {
    let Some(pixel_count) = mask_len(width, height) else {
        return AlphaCleanupReport {
            filled_holes: 0,
            foreground_pixels: 0,
            removed_components: 0,
        };
    };

    if options.cleanup_strength == ProceduralCleanupStrength::Off || options.preserve_small_parts {
        return AlphaCleanupReport {
            filled_holes: 0,
            foreground_pixels: mask.iter().filter(|alpha| **alpha > 8).count(),
            removed_components: 0,
        };
    }

    let mut visited = vec![false; pixel_count];
    let mut components: Vec<Vec<usize>> = Vec::new();

    for index in 0..pixel_count {
        if visited[index] || mask[index] <= 8 {
            continue;
        }

        let component = collect_alpha_component(mask, width, height, index, &mut visited, true);

        if !component.is_empty() {
            components.push(component);
        }
    }

    if components.is_empty() {
        return AlphaCleanupReport {
            filled_holes: 0,
            foreground_pixels: 0,
            removed_components: 0,
        };
    }

    let largest_size = components.iter().map(Vec::len).max().unwrap_or(0);
    let min_kept_size = ((largest_size as f32) * options.cleanup_strength.component_keep_ratio())
        .max(options.cleanup_strength.min_component_size() as f32) as usize;
    let mut removed_components = 0;

    for component in components {
        if component.len() >= min_kept_size {
            continue;
        }

        removed_components += 1;

        for index in component {
            mask[index] = 0;
        }
    }

    AlphaCleanupReport {
        filled_holes: 0,
        foreground_pixels: 0,
        removed_components,
    }
}

fn fill_internal_alpha_holes(
    mask: &mut [u8],
    width: u32,
    height: u32,
    max_hole_pixels: usize,
) -> usize {
    if max_hole_pixels == 0 {
        return 0;
    }

    let Some(pixel_count) = mask_len(width, height) else {
        return 0;
    };
    let mut visited = vec![false; pixel_count];
    let mut filled_holes = 0;

    for index in 0..pixel_count {
        if visited[index] || mask[index] > 8 {
            continue;
        }

        let component = collect_alpha_component(mask, width, height, index, &mut visited, false);

        if component.is_empty()
            || touches_image_border(&component, width, height)
            || component.len() > max_hole_pixels
        {
            continue;
        }

        filled_holes += 1;

        for pixel_index in component {
            mask[pixel_index] = 255;
        }
    }

    filled_holes
}

fn collect_alpha_component(
    mask: &[u8],
    width: u32,
    height: u32,
    start_index: usize,
    visited: &mut [bool],
    foreground: bool,
) -> Vec<usize> {
    let mut queue = VecDeque::new();
    let mut component = Vec::new();

    visited[start_index] = true;
    queue.push_back(start_index);

    while let Some(index) = queue.pop_front() {
        component.push(index);

        for neighbor in alpha_neighbors(index, width, height) {
            if visited[neighbor] {
                continue;
            }

            let is_foreground = mask[neighbor] > 8;

            if is_foreground != foreground {
                continue;
            }

            visited[neighbor] = true;
            queue.push_back(neighbor);
        }
    }

    component
}

fn alpha_neighbors(index: usize, width: u32, height: u32) -> Vec<usize> {
    let width_usize = width as usize;
    let height_usize = height as usize;
    let x = index % width_usize;
    let y = index / width_usize;
    let mut neighbors = Vec::with_capacity(4);

    if x > 0 {
        neighbors.push(index - 1);
    }

    if x + 1 < width_usize {
        neighbors.push(index + 1);
    }

    if y > 0 {
        neighbors.push(index - width_usize);
    }

    if y + 1 < height_usize {
        neighbors.push(index + width_usize);
    }

    neighbors
}

fn touches_image_border(component: &[usize], width: u32, height: u32) -> bool {
    let width_usize = width as usize;
    let height_usize = height as usize;

    component.iter().any(|index| {
        let x = index % width_usize;
        let y = index / width_usize;

        x == 0 || y == 0 || x + 1 == width_usize || y + 1 == height_usize
    })
}

fn apply_alpha_mask_with_spill_suppression(
    image: &mut RgbaImage,
    mask: &[u8],
    profile: &BackgroundColorProfile,
    spill_suppression: f32,
) {
    for (index, pixel) in image.pixels_mut().enumerate() {
        let alpha = mask.get(index).copied().unwrap_or(0);

        if alpha == 0 {
            pixel[3] = 0;
            continue;
        }

        if alpha < 220 {
            pixel[0] =
                suppress_background_spill(pixel[0], profile.primary[0], alpha, spill_suppression);
            pixel[1] =
                suppress_background_spill(pixel[1], profile.primary[1], alpha, spill_suppression);
            pixel[2] =
                suppress_background_spill(pixel[2], profile.primary[2], alpha, spill_suppression);
        }

        pixel[3] = alpha;
    }
}

fn suppress_background_spill(
    channel: u8,
    background_channel: u8,
    alpha: u8,
    spill_suppression: f32,
) -> u8 {
    let blend = 1.0 - (alpha as f32 / 255.0);
    let corrected = channel as f32
        + ((channel as f32 - background_channel as f32)
            * blend
            * spill_suppression.clamp(0.0, 1.0));

    corrected.clamp(0.0, 255.0).round() as u8
}

fn score_procedural_background_removal(warnings: &[String], foreground_pixels: usize) -> u16 {
    if foreground_pixels == 0 {
        return 45;
    }

    let penalty = (warnings.len() as u16).saturating_mul(7);

    94_u16.saturating_sub(penalty).max(62)
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

fn is_low_contrast_background(color: [u8; 3]) -> bool {
    let max_channel = color[0].max(color[1]).max(color[2]);
    let min_channel = color[0].min(color[1]).min(color[2]);

    max_channel.saturating_sub(min_channel) < 18 && max_channel > 190
}

fn mask_len(width: u32, height: u32) -> Option<usize> {
    usize::try_from(width)
        .ok()
        .and_then(|w| usize::try_from(height).ok().and_then(|h| w.checked_mul(h)))
}

