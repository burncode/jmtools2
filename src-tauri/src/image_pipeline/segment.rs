use image::{imageops, Rgba, RgbaImage};

const ALPHA_THRESHOLD: u8 = 12;

pub struct ExtractFilmstripOptions {
    pub expected_frame_count: usize,
    pub target_height: u32,
    pub target_width: u32,
}

pub fn extract_filmstrip_frames(
    strip: &RgbaImage,
    options: ExtractFilmstripOptions,
) -> Result<Vec<RgbaImage>, String> {
    extract_filmstrip_frames_with_cuts(strip, options, None).map(|result| result.frames)
}

pub struct ExtractFilmstripResult {
    pub cut_positions: Vec<u32>,
    pub frames: Vec<RgbaImage>,
}

pub fn extract_filmstrip_frames_with_cuts(
    strip: &RgbaImage,
    options: ExtractFilmstripOptions,
    manual_cuts: Option<Vec<u32>>,
) -> Result<ExtractFilmstripResult, String> {
    let expected = options.expected_frame_count.max(1);
    if expected == 1 {
        return Ok(ExtractFilmstripResult {
            cut_positions: Vec::new(),
            frames: vec![align_frame_centroid(
                strip,
                options.target_width,
                options.target_height,
            )],
        });
    }

    let cuts = if let Some(manual) = manual_cuts {
        validate_manual_cuts(strip.width(), expected, &manual)?
    } else {
        find_optimal_cuts(strip, expected)?
    };
    let mut frames = Vec::with_capacity(expected);
    let width = strip.width();
    let mut start_x = 0_u32;

    for index in 0..expected {
        let end_x = if index + 1 == expected {
            width
        } else {
            cuts[index].saturating_add(1).min(width)
        };
        if end_x <= start_x {
            return Err(format!(
                "filmstrip 切帧失败：第 {} 段宽度无效。",
                index + 1
            ));
        }
        let slice = imageops::crop_imm(strip, start_x, 0, end_x - start_x, strip.height()).to_image();
        frames.push(align_frame_centroid(
            &slice,
            options.target_width,
            options.target_height,
        ));
        start_x = end_x;
    }

    if frames.len() != expected {
        return Err(format!(
            "filmstrip 切帧数量不符：期望 {expected}，实际 {}。",
            frames.len()
        ));
    }

    Ok(ExtractFilmstripResult {
        cut_positions: cuts,
        frames,
    })
}

fn validate_manual_cuts(width: u32, expected: usize, cuts: &[u32]) -> Result<Vec<u32>, String> {
    let cut_count = expected.saturating_sub(1);
    if cuts.len() != cut_count {
        return Err(format!(
            "手动切线数量不符：期望 {cut_count}，实际 {}。",
            cuts.len()
        ));
    }

    let mut previous = 0_u32;
    for cut in cuts {
        if *cut <= previous || *cut >= width {
            return Err("手动切线位置无效。".to_string());
        }
        previous = *cut;
    }

    Ok(cuts.to_vec())
}

fn vertical_alpha_projection(strip: &RgbaImage) -> Vec<f64> {
    let width = strip.width() as usize;
    let mut projection = vec![0.0; width.max(1)];
    for x in 0..width {
        let mut sum = 0.0;
        for y in 0..strip.height() as usize {
            let alpha = strip.get_pixel(x as u32, y as u32)[3];
            if alpha > ALPHA_THRESHOLD {
                sum += f64::from(alpha);
            }
        }
        projection[x] = sum;
    }
    smooth_projection(&mut projection, 3);
    projection
}

fn smooth_projection(values: &mut [f64], radius: usize) {
    if values.is_empty() {
        return;
    }
    let original = values.to_vec();
    for (index, slot) in values.iter_mut().enumerate() {
        let start = index.saturating_sub(radius);
        let end = (index + radius + 1).min(original.len());
        let count = (end - start).max(1) as f64;
        *slot = original[start..end].iter().sum::<f64>() / count;
    }
}

pub fn find_optimal_cuts(strip: &RgbaImage, expected: usize) -> Result<Vec<u32>, String> {
    let width = strip.width();
    if width < expected as u32 {
        return Err("filmstrip 宽度过小，无法切分。".to_string());
    }

    let projection = vertical_alpha_projection(strip);
    let cut_count = expected.saturating_sub(1);
    if cut_count == 0 {
        return Ok(Vec::new());
    }

    let ideal_cell_width = f64::from(width) / f64::from(expected as u32);
    let lambda = projection.iter().copied().fold(0.0_f64, f64::max) * 0.05 + 1.0;

    let mut dp = vec![vec![f64::INFINITY; expected]; width as usize + 1];
    let mut prev = vec![vec![0_u32; expected]; width as usize + 1];
    dp[0][0] = 0.0;

    for x in 1..=width as usize {
        for cuts_used in 1..=cut_count.min(x) {
            for previous in cuts_used.saturating_sub(1)..x {
                if !dp[previous][cuts_used - 1].is_finite() {
                    continue;
                }
                let cut_x = previous as u32;
                let cut_cost = projection.get(previous).copied().unwrap_or(0.0);
                let width_penalty = lambda * ((x - previous) as f64 - ideal_cell_width).powi(2);
                let candidate = dp[previous][cuts_used - 1] + cut_cost + width_penalty;
                if candidate < dp[x][cuts_used] {
                    dp[x][cuts_used] = candidate;
                    prev[x][cuts_used] = cut_x;
                }
            }
        }
    }

    let mut cuts = Vec::with_capacity(cut_count);
    let mut x = width as usize;
    let mut cuts_used = cut_count;
    while cuts_used > 0 {
        let cut = prev[x][cuts_used];
        if cut == 0 && cuts_used > 1 {
            return Err("filmstrip DP 切线求解失败。".to_string());
        }
        cuts.push(cut);
        x = cut as usize;
        cuts_used -= 1;
    }
    cuts.reverse();
    Ok(cuts)
}

pub fn alpha_centroid(image: &RgbaImage) -> (f64, f64) {
    let mut sum_x = 0.0;
    let mut sum_y = 0.0;
    let mut sum_alpha = 0.0;

    for (x, y, pixel) in image.enumerate_pixels() {
        let alpha = f64::from(pixel[3]) / 255.0;
        if alpha <= 0.08 {
            continue;
        }
        sum_x += f64::from(x) * alpha;
        sum_y += f64::from(y) * alpha;
        sum_alpha += alpha;
    }

    if sum_alpha <= f64::EPSILON {
        return (
            f64::from(image.width()) / 2.0,
            f64::from(image.height()) / 2.0,
        );
    }

    (sum_x / sum_alpha, sum_y / sum_alpha)
}

pub fn align_frame_centroid(frame: &RgbaImage, target_width: u32, target_height: u32) -> RgbaImage {
    let cropped = if let Some((x, y, width, height)) = alpha_bbox(frame) {
        imageops::crop_imm(frame, x, y, width, height).to_image()
    } else {
        frame.clone()
    };

    let content_width = cropped.width().max(1);
    let content_height = cropped.height().max(1);
    let scale_x = f64::from(target_width) / f64::from(content_width);
    let scale_y = f64::from(target_height) / f64::from(content_height);
    let scale = scale_x.min(scale_y).min(1.0);
    let scaled_width = ((f64::from(content_width) * scale).floor() as u32).max(1);
    let scaled_height = ((f64::from(content_height) * scale).floor() as u32).max(1);
    let resized = if scaled_width == content_width && scaled_height == content_height {
        cropped
    } else {
        imageops::resize(
            &cropped,
            scaled_width,
            scaled_height,
            imageops::FilterType::Nearest,
        )
    };

    let (centroid_x, centroid_y) = alpha_centroid(&resized);
    let mut canvas = RgbaImage::from_pixel(target_width, target_height, Rgba([0, 0, 0, 0]));
    let target_center_x = f64::from(target_width) / 2.0;
    let target_center_y = f64::from(target_height) * 0.82;
    let offset_x = (target_center_x - centroid_x).round() as i64;
    let offset_y = (target_center_y - centroid_y).round() as i64;
    imageops::overlay(&mut canvas, &resized, offset_x, offset_y);
    canvas
}

/// 移除 Filmstrip 品红底 (#FF00FF) 与近邻色。
pub fn remove_magenta_chroma_key(image: &RgbaImage, tolerance: u8) -> RgbaImage {
    let mut output = image.clone();
    let tol = u32::from(tolerance);
    for pixel in output.pixels_mut() {
        let r = u32::from(pixel[0]);
        let g = u32::from(pixel[1]);
        let b = u32::from(pixel[2]);
        if r + tol >= 255 && g <= tol && b + tol >= 255 {
            pixel[3] = 0;
        }
    }
    output
}

fn alpha_bbox(image: &RgbaImage) -> Option<(u32, u32, u32, u32)> {
    let mut min_x = image.width();
    let mut min_y = image.height();
    let mut max_x = 0;
    let mut max_y = 0;
    let mut found = false;

    for (x, y, pixel) in image.enumerate_pixels() {
        if pixel[3] <= ALPHA_THRESHOLD {
            continue;
        }
        found = true;
        min_x = min_x.min(x);
        min_y = min_y.min(y);
        max_x = max_x.max(x);
        max_y = max_y.max(y);
    }

    if !found {
        return None;
    }

    Some((min_x, min_y, max_x - min_x + 1, max_y - min_y + 1))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_equal_blank_gutters() {
        let mut strip = RgbaImage::new(300, 60);
        for frame_index in 0..3 {
            for local_x in 20..80 {
                let x = frame_index * 100 + local_x;
                for y in 10..50 {
                    strip.put_pixel(x, y, Rgba([240, 120, 40, 255]));
                }
            }
        }

        let frames = extract_filmstrip_frames(
            &strip,
            ExtractFilmstripOptions {
                expected_frame_count: 3,
                target_height: 64,
                target_width: 64,
            },
        )
        .expect("split");

        assert_eq!(frames.len(), 3);
    }
}
