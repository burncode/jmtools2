use image::{imageops, Rgba, RgbaImage};
use serde_json::{json, Value};

use crate::character::model::*;

/// 返回角色 processing 预检的可读摘要（取最后一条 warning，通常为预检结论行）。
pub(crate) fn character_processing_summary(record: &CharacterAssetRecord) -> Option<String> {
    record
        .processing
        .as_ref()
        .and_then(|processing| processing.warnings.last().cloned())
        .filter(|value| !value.trim().is_empty())
}

pub(crate) fn character_image_to_workflow_output(image: &CharacterImageAsset) -> Value {
    json!({
        "absolutePath": image.absolute_path,
        "height": image.height,
        "kind": "projectRelativePath",
        "path": image.project_relative_path,
        "width": image.width,
    })
}

pub(crate) fn character_record_preview_image_output(
    record: &CharacterAssetRecord,
    prefer_normalized: bool,
) -> Option<Value> {
    let view = record.views.first()?;
    let image = if prefer_normalized {
        view.normalized_image
            .as_ref()
            .or(view.transparent_image.as_ref())
            .or(view.raw_image.as_ref())
            .or(record.master_image.as_ref())
    } else {
        view.transparent_image
            .as_ref()
            .or(view.raw_image.as_ref())
            .or(record.master_image.as_ref())
    }?;

    Some(character_image_to_workflow_output(image))
}

const NORMALIZE_ALPHA_THRESHOLD: u8 = 8;

fn alpha_bounding_box(image: &RgbaImage) -> Option<(u32, u32, u32, u32)> {
    let (width, height) = image.dimensions();
    let mut min_x = width;
    let mut min_y = height;
    let mut max_x = 0;
    let mut max_y = 0;
    let mut found = false;

    for y in 0..height {
        for x in 0..width {
            if image.get_pixel(x, y).0[3] > NORMALIZE_ALPHA_THRESHOLD {
                found = true;
                min_x = min_x.min(x);
                min_y = min_y.min(y);
                max_x = max_x.max(x);
                max_y = max_y.max(y);
            }
        }
    }

    if !found {
        return None;
    }

    Some((min_x, min_y, max_x - min_x + 1, max_y - min_y + 1))
}

fn defringe_rgba(image: &mut RgbaImage) {
    let (width, height) = image.dimensions();
    let original = image.clone();

    for y in 0..height {
        for x in 0..width {
            let pixel = original.get_pixel(x, y);
            if pixel[3] == 0 || pixel[3] == 255 {
                continue;
            }

            let mut near_transparent = false;
            for (nx, ny) in [
                (x.saturating_sub(1), y),
                (x + 1, y),
                (x, y.saturating_sub(1)),
                (x, y + 1),
            ] {
                if nx < width && ny < height && original.get_pixel(nx, ny).0[3] <= NORMALIZE_ALPHA_THRESHOLD {
                    near_transparent = true;
                    break;
                }
            }

            if !near_transparent {
                continue;
            }

            let alpha = f64::from(pixel[3]) / 255.0;
            image.put_pixel(
                x,
                y,
                Rgba([
                    (f64::from(pixel[0]) * alpha).round() as u8,
                    (f64::from(pixel[1]) * alpha).round() as u8,
                    (f64::from(pixel[2]) * alpha).round() as u8,
                    pixel[3],
                ]),
            );
        }
    }
}

pub(crate) fn workflow_fit_rgba_image_pixel_friendly(
    source: &RgbaImage,
    target_width: u32,
    target_height: u32,
    foot_line_y: Option<u32>,
    scale_mode: &str,
) -> RgbaImage {
    let cropped = if let Some((x, y, width, height)) = alpha_bounding_box(source) {
        imageops::crop_imm(source, x, y, width, height).to_image()
    } else {
        source.clone()
    };

    let mut content = cropped;
    defringe_rgba(&mut content);

    let content_width = content.width().max(1);
    let content_height = content.height().max(1);
    let scale_x = f64::from(target_width) / f64::from(content_width);
    let scale_y = f64::from(target_height) / f64::from(content_height);
    let mut scale = scale_x.min(scale_y);
    if scale > 1.0 {
        scale = 1.0;
    }

    let (scaled_width, scaled_height) = match scale_mode {
        // 整数倍降采样：用整除因子保持像素网格清晰，避免非整数缩放糊边。
        "integer" => {
            if scale >= 1.0 {
                (content_width, content_height)
            } else {
                let divisor = (1.0 / scale).round().max(1.0) as u32;
                (
                    (content_width / divisor).max(1),
                    (content_height / divisor).max(1),
                )
            }
        }
        // 仅居中：保持原生分辨率（超出画布时由 overlay 裁切），不做缩放。
        "none" => (content_width, content_height),
        // 默认 fit：等比缩放至画布内（不放大）。
        _ => (
            ((f64::from(content_width) * scale).floor() as u32).max(1),
            ((f64::from(content_height) * scale).floor() as u32).max(1),
        ),
    };
    let resized = if scaled_width == content_width && scaled_height == content_height {
        content.clone()
    } else {
        imageops::resize(
            &content,
            scaled_width,
            scaled_height,
            imageops::FilterType::Nearest,
        )
    };

    let mut canvas = RgbaImage::new(target_width, target_height);
    // 使用带符号差值，内容大于画布时居中裁切而非下溢 panic。
    let offset_x = (i64::from(target_width) - i64::from(scaled_width)) / 2;
    let foot_ratio = foot_line_y.map(|value| {
        let source_height = source.height().max(1);
        f64::from(value.min(source_height)) / f64::from(source_height)
    });
    let anchor_y = foot_ratio
        .map(|ratio| ((f64::from(scaled_height) * ratio).round() as u32).min(scaled_height))
        .unwrap_or(scaled_height);
    let offset_y = i64::from(target_height.saturating_sub(anchor_y));

    imageops::overlay(&mut canvas, &resized, offset_x, offset_y);
    canvas
}

/// 将图像 RGB 量化到至多 `palette_size` 种颜色，保持像素风的有限色板。
/// 透明像素（alpha 很低）直接置为全透明，且不参与调色板训练，避免透明区污染色板。
pub(crate) fn quantize_rgba_palette(image: &RgbaImage, palette_size: u32) -> RgbaImage {
    use color_quant::NeuQuant;

    const ALPHA_CUTOFF: u8 = 16;
    let colors = (palette_size.clamp(2, 256)) as usize;

    let mut training: Vec<u8> = Vec::new();
    for pixel in image.pixels() {
        if pixel[3] >= ALPHA_CUTOFF {
            training.extend_from_slice(&[pixel[0], pixel[1], pixel[2], 255]);
        }
    }
    if training.is_empty() {
        return image.clone();
    }

    let quantizer = NeuQuant::new(10, colors, &training);
    let color_map = quantizer.color_map_rgba();

    let mut output = RgbaImage::new(image.width(), image.height());
    for (x, y, pixel) in image.enumerate_pixels() {
        if pixel[3] < ALPHA_CUTOFF {
            output.put_pixel(x, y, Rgba([0, 0, 0, 0]));
            continue;
        }
        let index = quantizer.index_of(&[pixel[0], pixel[1], pixel[2], 255]);
        let base = index * 4;
        output.put_pixel(
            x,
            y,
            Rgba([
                color_map[base],
                color_map[base + 1],
                color_map[base + 2],
                pixel[3],
            ]),
        );
    }
    output
}

pub(crate) fn character_record_target_canvas(record: &CharacterAssetRecord) -> (u32, u32) {
    if let Some(processing) = record.processing.as_ref() {
        if processing.canvas.width > 0 && processing.canvas.height > 0 {
            return (processing.canvas.width, processing.canvas.height);
        }
    }
    if let Some(master) = record.master_image.as_ref() {
        if master.width > 0 && master.height > 0 {
            return (master.width, master.height);
        }
    }
    (64, 64)
}
