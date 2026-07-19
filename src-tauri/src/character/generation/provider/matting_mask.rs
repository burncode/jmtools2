use std::collections::VecDeque;

use image::RgbaImage;

use super::AlphaCleanupReport;
use super::{BackgroundColorProfile, ProceduralBackgroundRemovalOptions, ProceduralCleanupStrength};

use crate::character::model::BoundingBox;

pub(crate) fn refine_procedural_alpha_mask(
    mask: &mut [u8],
    width: u32,
    height: u32,
    options: ProceduralBackgroundRemovalOptions,
) -> AlphaCleanupReport {
    let mut report = keep_largest_foreground_regions(mask, width, height, options);
    let filled_holes = fill_internal_alpha_holes(mask, width, height, options.hole_fill_max_pixels);

    report.filled_holes = filled_holes;
    report.foreground_pixels = mask.iter().filter(|alpha| **alpha > 8).count();
    report
}

pub(crate) fn keep_largest_foreground_regions(
    mask: &mut [u8],
    width: u32,
    height: u32,
    options: ProceduralBackgroundRemovalOptions,
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

pub(crate) fn fill_internal_alpha_holes(
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

pub(crate) fn collect_alpha_component(
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

pub(crate) fn alpha_neighbors(index: usize, width: u32, height: u32) -> Vec<usize> {
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

pub(crate) fn touches_image_border(component: &[usize], width: u32, height: u32) -> bool {
    let width_usize = width as usize;
    let height_usize = height as usize;

    component.iter().any(|index| {
        let x = index % width_usize;
        let y = index / width_usize;

        x == 0 || y == 0 || x + 1 == width_usize || y + 1 == height_usize
    })
}

pub(crate) fn apply_alpha_mask_with_spill_suppression(
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

pub(crate) fn suppress_background_spill(
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

pub(crate) fn score_procedural_background_removal(warnings: &[String], foreground_pixels: usize) -> u16 {
    if foreground_pixels == 0 {
        return 45;
    }

    let penalty = (warnings.len() as u16).saturating_mul(7);

    94_u16.saturating_sub(penalty).max(62)
}

pub(crate) fn mask_len(width: u32, height: u32) -> Option<usize> {
    usize::try_from(width)
        .ok()
        .and_then(|w| usize::try_from(height).ok().and_then(|h| w.checked_mul(h)))
}


pub(crate) fn calculate_alpha_bbox(image: &RgbaImage) -> Option<BoundingBox> {
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
        height: max_y - min_y + 1,
        width: max_x - min_x + 1,
        x: min_x,
        y: min_y,
    })
}

pub(crate) fn is_low_contrast_background(background: [u8; 3]) -> bool {
    let max_channel = background[0].max(background[1]).max(background[2]);
    let min_channel = background[0].min(background[1]).min(background[2]);

    max_channel.saturating_sub(min_channel) < 14 && max_channel < 210
}

