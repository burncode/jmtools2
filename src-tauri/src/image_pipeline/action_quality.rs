use image::RgbaImage;

use super::segment::alpha_centroid;

#[derive(Debug, Clone)]
pub struct ActionFrameQualityReport {
    pub dhash_similarity: f64,
    pub errors: Vec<String>,
    pub expected_frames: usize,
    pub found_frames: usize,
    pub grade: String,
    pub histogram_similarity: f64,
    pub motion_presence: f64,
    pub score: u16,
    pub warnings: Vec<String>,
}

pub fn score_action_frames(frames: &[RgbaImage], expected_frames: usize) -> ActionFrameQualityReport {
    let found_frames = frames.len();
    let expected = expected_frames.max(1);
    let mut score = 100_i32;
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    if found_frames != expected {
        let delta = found_frames.abs_diff(expected) as i32;
        score -= 35 + delta * 10;
        errors.push(format!("帧数不符：期望 {expected}，实际 {found_frames}。"));
    }

    let histogram_similarity = if frames.len() >= 2 {
        average_histogram_similarity(frames)
    } else {
        1.0
    };
    if histogram_similarity < 0.45 {
        score -= 18;
        errors.push(format!(
            "角色配色一致性偏低（{histogram_similarity:.2}）。"
        ));
    } else if histogram_similarity < 0.62 {
        score -= 8;
        warnings.push(format!(
            "角色配色一致性一般（{histogram_similarity:.2}）。"
        ));
    }

    let dhash_similarity = if frames.len() >= 2 {
        average_dhash_similarity(frames)
    } else {
        1.0
    };
    if dhash_similarity < 0.55 {
        score -= 10;
        errors.push(format!("结构一致性偏低（dHash {dhash_similarity:.2}）。"));
    }

    let motion_presence = motion_presence_score(frames);
    if frames.len() >= 2 && motion_presence < 0.01 {
        score -= 12;
        warnings.push("动作变化过小，可能接近静态图。".to_string());
    }

    if frames.iter().all(|frame| is_mostly_transparent(frame)) {
        score -= 40;
        errors.push("所有帧几乎完全透明。".to_string());
    }

    let score = score.clamp(0, 100) as u16;
    let grade = grade_from_score(score).to_string();

    ActionFrameQualityReport {
        dhash_similarity,
        errors,
        expected_frames: expected,
        found_frames,
        grade,
        histogram_similarity,
        motion_presence,
        score,
        warnings,
    }
}

pub fn build_corrective_hint(report: &ActionFrameQualityReport) -> String {
    let mut hints = Vec::new();
    if report.found_frames != report.expected_frames {
        hints.push(format!(
            "the previous result had {} poses but exactly {} are required; split the canvas into {} even columns with clear gutters",
            report.found_frames,
            report.expected_frames,
            report.expected_frames
        ));
    }
    if report.motion_presence < 0.01 && report.expected_frames >= 2 {
        hints.push(
            "frames looked nearly identical; exaggerate motion between adjacent poses".to_string(),
        );
    }
    if report.dhash_similarity < 0.55 {
        hints.push(
            "character silhouette drifted between frames; keep the same outfit, proportions and colors"
                .to_string(),
        );
    }
    if report.histogram_similarity < 0.45 {
        hints.push(
            "palette drifted between frames; preserve the same hair, armor and accent colors"
                .to_string(),
        );
    }
    if hints.is_empty() {
        "improve frame separation, motion clarity and character consistency".to_string()
    } else {
        hints.join("; ")
    }
}

fn grade_from_score(score: u16) -> &'static str {
    if score >= 85 {
        "excellent"
    } else if score >= 70 {
        "good"
    } else if score >= 50 {
        "fair"
    } else {
        "poor"
    }
}

fn motion_presence_score(frames: &[RgbaImage]) -> f64 {
    if frames.len() < 2 {
        return 0.0;
    }
    let mut total = 0.0;
    let mut count = 0.0;
    for pair in frames.windows(2) {
        total += frame_difference_ratio(&pair[0], &pair[1]);
        count += 1.0;
    }
    if count <= f64::EPSILON {
        0.0
    } else {
        total / count
    }
}

fn frame_difference_ratio(left: &RgbaImage, right: &RgbaImage) -> f64 {
    if left.width() != right.width() || left.height() != right.height() {
        return 1.0;
    }
    let total = (left.width() as u64) * (left.height() as u64);
    if total == 0 {
        return 0.0;
    }
    let mut changed = 0_u64;
    for (pixel_left, pixel_right) in left.pixels().zip(right.pixels()) {
        if pixel_left.0 != pixel_right.0 {
            changed += 1;
        }
    }
    changed as f64 / total as f64
}

fn average_histogram_similarity(frames: &[RgbaImage]) -> f64 {
    let histograms: Vec<[u32; 64]> = frames.iter().map(rgb_histogram_64).collect();
    let mut total = 0.0;
    let mut count = 0.0;
    for index in 0..histograms.len() {
        for other in histograms.iter().skip(index + 1) {
            total += histogram_intersection(&histograms[index], other);
            count += 1.0;
        }
    }
    if count <= f64::EPSILON {
        1.0
    } else {
        total / count
    }
}

fn rgb_histogram_64(image: &RgbaImage) -> [u32; 64] {
    let mut bins = [0_u32; 64];
    for pixel in image.pixels() {
        if pixel[3] <= 12 {
            continue;
        }
        let r = (pixel[0] as usize) / 64;
        let g = (pixel[1] as usize) / 64;
        let b = (pixel[2] as usize) / 64;
        let index = (r * 16 + g * 4 + b).min(63);
        bins[index] += 1;
    }
    bins
}

fn histogram_intersection(left: &[u32; 64], right: &[u32; 64]) -> f64 {
    let sum_left: f64 = left.iter().map(|value| f64::from(*value)).sum();
    let sum_right: f64 = right.iter().map(|value| f64::from(*value)).sum();
    if sum_left <= f64::EPSILON || sum_right <= f64::EPSILON {
        return 0.0;
    }
    let mut intersection = 0.0;
    for index in 0..64 {
        intersection += f64::from(left[index]).min(f64::from(right[index]));
    }
    intersection / sum_left.max(sum_right)
}

fn average_dhash_similarity(frames: &[RgbaImage]) -> f64 {
    let hashes: Vec<u64> = frames.iter().map(dhash64).collect();
    let mut total = 0.0;
    let mut count = 0.0;
    for index in 0..hashes.len() {
        for other in hashes.iter().skip(index + 1) {
            total += dhash_similarity(hashes[index], *other);
            count += 1.0;
        }
    }
    if count <= f64::EPSILON {
        1.0
    } else {
        total / count
    }
}

fn dhash64(image: &RgbaImage) -> u64 {
    let sample = image::imageops::resize(image, 9, 8, image::imageops::FilterType::Triangle);
    let mut hash = 0_u64;
    for y in 0..8 {
        for x in 0..8 {
            let left = grayscale(sample.get_pixel(x, y));
            let right = grayscale(sample.get_pixel(x + 1, y));
            hash = (hash << 1) | u64::from(left > right);
        }
    }
    hash
}

fn dhash_similarity(left: u64, right: u64) -> f64 {
    let distance = (left ^ right).count_ones();
    1.0 - (f64::from(distance) / 64.0)
}

fn grayscale(pixel: &image::Rgba<u8>) -> u8 {
    ((u16::from(pixel[0]) * 299 + u16::from(pixel[1]) * 587 + u16::from(pixel[2]) * 114) / 1000)
        as u8
}

fn is_mostly_transparent(image: &RgbaImage) -> bool {
    let total = (image.width() as u64) * (image.height() as u64);
    if total == 0 {
        return true;
    }
    let mut opaque = 0_u64;
    for pixel in image.pixels() {
        if pixel[3] > 12 {
            opaque += 1;
        }
    }
    (opaque as f64 / total as f64) < 0.01
}

pub fn centroid_jitter_score(frames: &[RgbaImage]) -> f64 {
    if frames.is_empty() {
        return 0.0;
    }
    let centroids: Vec<(f64, f64)> = frames.iter().map(alpha_centroid).collect();
    let mean_x = centroids.iter().map(|value| value.0).sum::<f64>() / centroids.len() as f64;
    let variance = centroids
        .iter()
        .map(|value| (value.0 - mean_x).powi(2))
        .sum::<f64>()
        / centroids.len() as f64;
    variance.sqrt()
}
