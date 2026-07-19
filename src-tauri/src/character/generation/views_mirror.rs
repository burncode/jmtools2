use std::path::Path;

use image::{imageops, RgbaImage};

use crate::character::model::*;
use crate::character::store::normalize_cache_segment;
use crate::storage::database::current_timestamp;

pub(crate) fn turnaround_quadrant_index(kind: &str) -> Option<usize> {
    match kind {
        "front" | "single" => Some(0),
        "back" => Some(1),
        "left" => Some(2),
        "right" => Some(3),
        _ => None,
    }
}

/// 将一张 2x2 sheet 等分为四个象限，顺序为 [左上, 右上, 左下, 右下]。
pub(crate) fn split_turnaround_sheet(sheet: &RgbaImage) -> Vec<RgbaImage> {
    let half_width = (sheet.width() / 2).max(1);
    let half_height = (sheet.height() / 2).max(1);
    [
        (0, 0),
        (half_width, 0),
        (0, half_height),
        (half_width, half_height),
    ]
    .iter()
    .map(|&(x, y)| imageops::crop_imm(sheet, x, y, half_width, half_height).to_image())
    .collect()
}

const QUADRANT_SIMILARITY_SAMPLE: u32 = 32;

/// 采样比较两个象限像素相似度，返回 0.0~1.0。
pub(crate) fn quadrant_pixel_similarity(a: &RgbaImage, b: &RgbaImage) -> f64 {
    let a_small = imageops::resize(
        a,
        QUADRANT_SIMILARITY_SAMPLE,
        QUADRANT_SIMILARITY_SAMPLE,
        imageops::FilterType::Nearest,
    );
    let b_small = imageops::resize(
        b,
        QUADRANT_SIMILARITY_SAMPLE,
        QUADRANT_SIMILARITY_SAMPLE,
        imageops::FilterType::Nearest,
    );

    let matching = a_small
        .pixels()
        .zip(b_small.pixels())
        .filter(|(left, right)| left.0 == right.0)
        .count();

    matching as f64 / (QUADRANT_SIMILARITY_SAMPLE * QUADRANT_SIMILARITY_SAMPLE) as f64
}

pub(crate) fn build_turnaround_sheet_prompt(record: &CharacterAssetRecord) -> String {
    format!(
        "为游戏角色生成一张 2x2 网格的四方向 turnaround 转身表，背景透明或纯净。\n\
角色名称：{}\n角色描述：{}\n像素风格：{}\n视觉关键词：{}\n像素提示词：{}\n\
严格布局：左上=正面(front)，右上=背面(back)，左下=左侧(left)，右下=右侧(right)。\n\
四个格子必须是同一个角色：相同体型、服装、配色、发型与装备，只改变观察角度。\n\
每个格子角色居中、完整、等高、朝向清晰；不要文字、水印、UI 边框、网格说明文字、复杂场景。",
        record.display_name,
        record.description,
        record.style,
        record.visual_keywords.join("，"),
        record.pixel_prompt
    )
}


pub(crate) fn character_view_specs(direction: &str) -> Vec<(&'static str, &'static str)> {
    match direction {
        "eight" => vec![
            ("front", "前"),
            ("back", "后"),
            ("left", "左"),
            ("right", "右"),
            ("frontLeft", "左前"),
            ("frontRight", "右前"),
            ("backLeft", "左后"),
            ("backRight", "右后"),
        ],
        "four" => vec![
            ("front", "前"),
            ("back", "后"),
            ("left", "左"),
            ("right", "右"),
        ],
        _ => vec![("single", "正面")],
    }
}

pub(crate) fn build_initial_character_views(record: &CharacterAssetRecord) -> Vec<CharacterViewAsset> {
    let kind = match record.direction.as_str() {
        "single" | "单视图" => "single",
        _ => "front",
    };

    vec![CharacterViewAsset {
        anchor: None,
        bbox: None,
        id: format!("{}-{kind}", record.id),
        kind: kind.to_string(),
        normalized_image: None,
        quality: Some(CharacterViewQualityReport {
            checked_at: String::new(),
            score: None,
            warnings: vec!["尚未进行视图风格一致性检查。".to_string()],
        }),
        raw_image: record.master_image.clone(),
        transparent_image: None,
    }]
}

pub(crate) fn prepare_character_view_slots(record: &mut CharacterAssetRecord) -> Vec<String> {
    if record.views.is_empty() {
        record.views = build_initial_character_views(record);
    }

    let source_raw_image = record
        .views
        .iter()
        .find_map(|view| view.raw_image.clone())
        .or_else(|| record.master_image.clone());
    let source_transparent_image = record
        .views
        .iter()
        .find_map(|view| view.transparent_image.clone());
    let mut prepared_kinds = Vec::new();

    for (kind, label) in character_view_specs(&record.direction) {
        prepared_kinds.push(label.to_string());

        if let Some(view) = record.views.iter_mut().find(|view| view.kind == kind) {
            if kind == "front" || kind == "single" {
                if view.raw_image.is_none() {
                    view.raw_image = source_raw_image.clone();
                }

                if view.transparent_image.is_none() {
                    view.transparent_image = source_transparent_image.clone();
                }
            }

            if view.quality.is_none() {
                view.quality = Some(CharacterViewQualityReport {
                    checked_at: current_timestamp().to_string(),
                    score: None,
                    warnings: vec![format!("{label}视图已建立，等待素材生成或一致性检查。")],
                });
            }

            continue;
        }

        record.views.push(CharacterViewAsset {
            anchor: None,
            bbox: None,
            id: format!("{}-{}", record.id, kind),
            kind: kind.to_string(),
            normalized_image: None,
            quality: Some(CharacterViewQualityReport {
                checked_at: current_timestamp().to_string(),
                score: None,
                warnings: vec![format!("{label}视图待生成。")],
            }),
            raw_image: if kind == "front" || kind == "single" {
                source_raw_image.clone()
            } else {
                None
            },
            transparent_image: if kind == "front" || kind == "single" {
                source_transparent_image.clone()
            } else {
                None
            },
        });
    }

    prepared_kinds
}

pub(crate) fn uses_three_view_mirror_strategy(strategy: Option<&str>) -> bool {
    !matches!(strategy.map(str::trim), Some("perView"))
}

pub(crate) fn api_view_kinds_for_mirror_strategy(direction: &str) -> &'static [&'static str] {
    match direction {
        "eight" => &["back", "right", "frontRight", "backLeft"],
        "four" => &["back", "right"],
        _ => &[],
    }
}

pub(crate) fn mirror_source_view_kind(target_kind: &str, direction: &str) -> Option<&'static str> {
    match direction {
        "four" => match target_kind {
            "left" => Some("right"),
            _ => None,
        },
        "eight" => match target_kind {
            "left" => Some("right"),
            "frontLeft" => Some("frontRight"),
            "backRight" => Some("backLeft"),
            _ => None,
        },
        _ => None,
    }
}

pub(crate) fn mirror_character_view_from_kind(
    project_root: &Path,
    record: &mut CharacterAssetRecord,
    view_directory: &Path,
    to_index: usize,
    from_kind: &str,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let source_image = record
        .views
        .iter()
        .find(|view| view.kind == from_kind)
        .and_then(|view| view.raw_image.clone())
        .ok_or_else(|| format!("镜像视图缺少来源方向「{from_kind}」。"))?;
    let source_path = project_root.join(source_image.project_relative_path.trim());
    if !source_path.is_file() {
        return Err(format!("镜像来源图片不存在：{}", source_path.display()));
    }

    let rgba = image::open(&source_path)
        .map_err(|error| format!("读取镜像来源图片失败：{error}"))?
        .to_rgba8();
    let mirrored = imageops::flip_horizontal(&rgba);
    let timestamp = current_timestamp().to_string();
    let to_kind = record.views[to_index].kind.clone();
    let file_name = format!(
        "view_{}_mirrored_{timestamp}.png",
        normalize_cache_segment(&to_kind)
    );
    let image_path = view_directory.join(&file_name);
    image::DynamicImage::ImageRgba8(mirrored)
        .save(&image_path)
        .map_err(|error| format!("保存镜像视图失败：{error}"))?;

    let project_relative_path = format!("assets/characters/{}/views/{file_name}", record.id);
    record.views[to_index].raw_image = Some(CharacterImageAsset {
        absolute_path: String::new(),
        data_url: String::new(),
        height,
        id: format!(
            "{}-view-{}-{timestamp}",
            record.id,
            normalize_cache_segment(&to_kind)
        ),
        project_relative_path,
        role: "master".to_string(),
        source: "mirrored".to_string(),
        width,
    });
    record.views[to_index].quality = Some(CharacterViewQualityReport {
        checked_at: timestamp,
        score: Some(80),
        warnings: vec![format!("由 {from_kind} 镜像生成，非对称装备可能需要人工检查。")],
    });

    Ok(())
}

