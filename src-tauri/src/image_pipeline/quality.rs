use image::RgbaImage;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QualityBoundingBox {
    pub height: u32,
    pub width: u32,
    pub x: u32,
    pub y: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImageQualityReport {
    pub alpha_coverage: f64,
    pub bbox: Option<QualityBoundingBox>,
    pub foot_line_y: Option<u32>,
    pub height: u32,
    pub warnings: Vec<String>,
    pub width: u32,
}

pub fn analyze_rgba_image(image: &RgbaImage) -> ImageQualityReport {
    let width = image.width();
    let height = image.height();
    let total_pixels = (width as u64).saturating_mul(height as u64).max(1);
    let mut opaque_pixels = 0_u64;
    let mut min_x = width;
    let mut min_y = height;
    let mut max_x = 0;
    let mut max_y = 0;
    let mut found_foreground = false;

    for (x, y, pixel) in image.enumerate_pixels() {
        if pixel[3] <= 8 {
            continue;
        }

        opaque_pixels += 1;
        found_foreground = true;
        min_x = min_x.min(x);
        min_y = min_y.min(y);
        max_x = max_x.max(x);
        max_y = max_y.max(y);
    }

    let alpha_coverage = opaque_pixels as f64 / total_pixels as f64;
    let bbox = if found_foreground {
        Some(QualityBoundingBox {
            height: max_y - min_y + 1,
            width: max_x - min_x + 1,
            x: min_x,
            y: min_y,
        })
    } else {
        None
    };

    let foot_line_y = bbox.as_ref().map(|value| value.y + value.height - 1);
    let mut warnings = Vec::new();

    if !found_foreground {
        warnings.push("未检测到有效不透明像素。".to_string());
    }
    if alpha_coverage < 0.02 {
        warnings.push("主体 Alpha 覆盖率过低。".to_string());
    }
    if let Some(bbox_value) = &bbox {
        if bbox_value.height as f64 / height as f64 > 0.95 {
            warnings.push("主体 bbox 高度接近全画布，可能需要裁剪。".to_string());
        }
    }

    ImageQualityReport {
        alpha_coverage,
        bbox,
        foot_line_y,
        height,
        warnings,
        width,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    #[test]
    fn detects_bbox_and_foot_line() {
        let mut image = RgbaImage::new(64, 64);
        for y in 20..44 {
            for x in 24..40 {
                image.put_pixel(x, y, Rgba([200, 100, 50, 255]));
            }
        }

        let report = analyze_rgba_image(&image);
        assert!(report.bbox.is_some());
        assert_eq!(report.foot_line_y, Some(43));
    }
}
