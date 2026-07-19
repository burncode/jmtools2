use std::fs;
use std::thread;
use std::time::Duration;
use std::path::Path;

use tauri::AppHandle;
use tracing::{info, warn};

use crate::character::generation::provider::*;
use crate::character::generation::settings::*;
use crate::character::model::*;
use crate::character::preview::attach_character_image_previews;
use crate::character::prompt::*;
use crate::character::store::*;
use crate::storage::database::{current_timestamp, open_app_database, ensure_ai_schema, ensure_app_settings_schema};

pub(crate) use super::views_mirror::{
    api_view_kinds_for_mirror_strategy, build_initial_character_views, build_turnaround_sheet_prompt, mirror_character_view_from_kind, mirror_source_view_kind,
    prepare_character_view_slots, split_turnaround_sheet, turnaround_quadrant_index,
    uses_three_view_mirror_strategy,
};

pub(crate) fn generate_character_view_images_blocking(
    app: AppHandle,
    input: GenerateCharacterViewImagesInput,
) -> Result<CharacterAssetRecord, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;

    info!(
        target = "jmtools::character",
        character_id = %character_id,
        view_mode = input.view_mode.as_deref().unwrap_or("followCharacter"),
        "character view images generation started"
    );

    let mut record = get_character_asset(input.project_root, character_id)?;

    if let Some(view_mode) = input
        .view_mode
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty() && *value != "followCharacter")
    {
        record.direction = view_mode.to_string();
    }

    prepare_character_view_slots(&mut record);

    let app_connection = open_app_database(&app)?;
    ensure_ai_schema(&app_connection)?;
    ensure_app_settings_schema(&app_connection)?;
    let settings = load_character_generation_settings(&app_connection)?;
    validate_character_generation_settings(&settings)?;
    // 视图/turnaround 使用图像编辑(img2img)绑定（带正面参考图），未单独配置时回退角色生成模型。
    let (provider, model) = resolve_character_edit_binding(&app_connection, &settings)?;
    let view_directory = project_root
        .join("assets")
        .join("characters")
        .join(&record.id)
        .join("views");

    fs::create_dir_all(&view_directory)
        .map_err(|error| format!("创建角色视图目录失败：{error}"))?;

    let view_filter = input
        .views
        .as_ref()
        .map(|items| {
            items
                .iter()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .collect::<Vec<_>>()
        })
        .filter(|items| !items.is_empty());

    let missing_view_indices = record
        .views
        .iter()
        .enumerate()
        .filter_map(|(index, view)| {
            if view.raw_image.is_none() && !matches!(view.kind.as_str(), "front" | "single") {
                if let Some(filter) = &view_filter {
                    if !filter.iter().any(|kind| kind == &view.kind) {
                        return None;
                    }
                }
                Some(index)
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    if missing_view_indices.is_empty() {
        attach_character_image_previews(&project_root, &mut record);
        return Ok(record);
    }

    // 取正面（front/single）定妆图作为图像参考，让其余方向基于同一角色生成而非凭文字重新想象。
    let reference_view_bytes = record
        .views
        .iter()
        .find(|view| matches!(view.kind.as_str(), "front" | "single"))
        .and_then(|view| {
            view.transparent_image
                .as_ref()
                .or(view.raw_image.as_ref())
        })
        .or(record.master_image.as_ref())
        .and_then(|image| resolve_project_image_path(&project_root, image).ok())
        .and_then(|path| fs::read(path).ok());
    if reference_view_bytes.is_none() {
        warn!(
            target = "jmtools::characters",
            character_id = %record.id,
            "未找到可用的正面参考图，多视图将退化为纯文生图"
        );
    }
    let dual_reference = input.reference_mode.as_deref() == Some("dualReference")
        && input
            .pose_reference_png
            .as_ref()
            .is_some_and(|bytes| !bytes.is_empty());
    if input.reference_mode.as_deref() == Some("dualReference")
        && !dual_reference
    {
        warn!(
            target = "jmtools::characters",
            character_id = %record.id,
            "双参考模式已启用但未提供姿势/视图参考图，已回退为角色正面参考"
        );
    }
    let img2img_reference_bytes = if dual_reference {
        input.pose_reference_png.as_deref()
    } else {
        reference_view_bytes.as_deref()
    };
    // 记录本次生成实际采用的条件化方式，写入每个视图的 quality.warnings 供前端展示。
    let consistency_note = if dual_reference {
        if provider.preset != "qwen" {
            "双参考模式：当前服务商不支持图像参考条件化，已回退为纯文生图。".to_string()
        } else {
            "双参考模式：姿势/视图参考图 img2img，角色正面图约束身份与配色。".to_string()
        }
    } else if reference_view_bytes.is_none() {
        "未找到正面参考图，本次按纯文生图生成，跨视图一致性可能下降。".to_string()
    } else if provider.preset != "qwen" {
        "当前服务商不支持图像参考条件化，已回退为纯文生图，跨视图一致性可能下降。".to_string()
    } else {
        "已基于正面参考图（img2img）生成，保持跨视图一致性。".to_string()
    };
    // 同一次生成的所有方向共用稳定 seed，进一步降低跨调用差异。
    let view_seed = record
        .config
        .as_ref()
        .and_then(|config| config.generation.seed)
        .unwrap_or_else(|| stable_seed_from_id(&record.id));

    let (target_width, target_height) = record_target_canvas(&record);
    let (gen_width, gen_height) = resolve_api_generation_size(target_width, target_height);

    // Turnaround 策略：一次生成含四朝向的单张 sheet，拆分填入四向 raw_image，跨视图天然一致。
    let handled_by_turnaround: Vec<usize> =
        if input.generation_strategy.as_deref() == Some("turnaroundGrid") {
            generate_turnaround_views(
                Some(&app),
                &provider,
                &model,
                &mut record,
                &view_directory,
                &missing_view_indices,
                img2img_reference_bytes,
                view_seed,
                input.reference_strength,
                gen_width.max(gen_height),
                &consistency_note,
            )?
        } else {
            Vec::new()
        };
    let pending_view_indices: Vec<usize> = missing_view_indices
        .iter()
        .copied()
        .filter(|index| !handled_by_turnaround.contains(index))
        .collect();

    let use_mirror_strategy = uses_three_view_mirror_strategy(input.generation_strategy.as_deref());
    let direction = record.direction.as_str();
    let mut api_view_indices = Vec::new();
    let mut mirror_targets: Vec<(usize, String)> = Vec::new();

    for view_index in &pending_view_indices {
        let view_kind = record.views[*view_index].kind.clone();
        if use_mirror_strategy && matches!(direction, "four" | "eight") {
            if let Some(from_kind) = mirror_source_view_kind(&view_kind, direction) {
                mirror_targets.push((*view_index, from_kind.to_string()));
                continue;
            }
            if api_view_kinds_for_mirror_strategy(direction)
                .iter()
                .any(|kind| *kind == view_kind.as_str())
            {
                api_view_indices.push(*view_index);
                continue;
            }
        }

        api_view_indices.push(*view_index);
    }

    for (order, view_index) in api_view_indices.iter().enumerate() {
        let view_kind = record.views[*view_index].kind.clone();
        let view_label = format_view_kind_label(&view_kind);
        let prompt = if dual_reference {
            build_character_dual_reference_view_prompt(&record, &view_kind, view_label)
        } else {
            build_character_view_image_prompt(&project_root, &record, &view_kind, view_label)
        };

        info!(
            target = "jmtools::characters",
            character_id = %record.id,
            view = %view_kind,
            provider = %provider.name,
            model = %model.name,
            "start character view image generation"
        );

        let image_url = request_character_view_image_url(
            Some(&app),
            &provider,
            &model,
            &prompt,
            img2img_reference_bytes,
            Some(view_seed),
            input.reference_strength,
            Some((gen_width, gen_height)),
        )?;
        let image_bytes = download_generated_image(&image_url)?;
        let timestamp = current_timestamp().to_string();
        let file_name = format!(
            "view_{}_{}.png",
            normalize_cache_segment(&view_kind),
            timestamp
        );
        let image_path = view_directory.join(&file_name);

        fs::write(&image_path, &image_bytes)
            .map_err(|error| format!("保存角色视图图片失败：{error}"))?;

        let project_relative_path = format!("assets/characters/{}/views/{file_name}", record.id);
        record.views[*view_index].raw_image = Some(CharacterImageAsset {
            absolute_path: String::new(),
            data_url: String::new(),
            height: gen_height,
            id: format!(
                "{}-view-{}-{timestamp}",
                record.id,
                normalize_cache_segment(&view_kind)
            ),
            project_relative_path,
            role: "master".to_string(),
            source: "ai-generated".to_string(),
            width: gen_width,
        });
        record.views[*view_index].quality = Some(CharacterViewQualityReport {
            checked_at: timestamp,
            score: Some(82),
            warnings: vec![
                "AI 已生成该方向视图，仍需后续一致性与透明背景检查。".to_string(),
                consistency_note.clone(),
            ],
        });

        if provider.preset == "qwen" && order + 1 < api_view_indices.len() {
            thread::sleep(Duration::from_millis(1800));
        }
    }

    for (to_index, from_kind) in mirror_targets {
        mirror_character_view_from_kind(
            &project_root,
            &mut record,
            &view_directory,
            to_index,
            &from_kind,
            model.default_width,
            model.default_height,
        )?;
    }

    record.updated_at = current_timestamp().to_string();
    write_character_record(&project_root, &record)?;
    upsert_character_index(&project_root, &record)?;
    upsert_character_database(&project_root, &record)?;
    attach_character_image_previews(&project_root, &mut record);

    info!(
        target = "jmtools::characters",
        character_id = %record.id,
        "character view images generated"
    );

    Ok(record)
}

/// Turnaround 单图策略：以母版/正面为参考一次生成 2x2 四朝向 sheet，再拆分填入缺失的基本四向。
/// 返回本次由 turnaround 填充的视图索引。front/single 不在缺失集合内，因此作为参考保留、不被覆盖。
#[allow(clippy::too_many_arguments)]
pub(crate) fn generate_turnaround_views(
    app: Option<&AppHandle>,
    provider: &StoredImageProvider,
    model: &StoredImageModel,
    record: &mut CharacterAssetRecord,
    view_directory: &Path,
    missing_view_indices: &[usize],
    reference_png: Option<&[u8]>,
    view_seed: u64,
    reference_strength: Option<f64>,
    cell_size: u32,
    consistency_note: &str,
) -> Result<Vec<usize>, String> {
    let mut targets: Vec<(usize, usize)> = Vec::new();
    for &index in missing_view_indices {
        if let Some(quadrant) = turnaround_quadrant_index(&record.views[index].kind) {
            targets.push((index, quadrant));
        }
    }
    if targets.is_empty() {
        return Ok(Vec::new());
    }

    let prompt = build_turnaround_sheet_prompt(record);
    let sheet_side = resolve_turnaround_sheet_side(
        app,
        provider,
        model,
        cell_size,
    );

    info!(
        target = "jmtools::characters",
        character_id = %record.id,
        sheet_side,
        "start character turnaround sheet generation"
    );

    let image_url = request_character_view_image_url(
        app,
        provider,
        model,
        &prompt,
        reference_png,
        Some(view_seed),
        reference_strength,
        Some((sheet_side, sheet_side)),
    )?;
    let image_bytes = download_generated_image(&image_url)?;
    let sheet = image::load_from_memory(&image_bytes)
        .map_err(|error| format!("解析 turnaround 拼图失败：{error}"))?
        .to_rgba8();
    let quadrants = split_turnaround_sheet(&sheet);

    let mut handled = Vec::new();
    for (view_index, quadrant_index) in targets {
        let quadrant = &quadrants[quadrant_index];
        let view_kind = record.views[view_index].kind.clone();
        let timestamp = current_timestamp().to_string();
        let file_name = format!(
            "view_{}_{}.png",
            normalize_cache_segment(&view_kind),
            timestamp
        );
        let image_path = view_directory.join(&file_name);
        quadrant
            .save(&image_path)
            .map_err(|error| format!("保存 turnaround 视图失败：{error}"))?;

        let project_relative_path = format!("assets/characters/{}/views/{file_name}", record.id);
        record.views[view_index].raw_image = Some(CharacterImageAsset {
            absolute_path: String::new(),
            data_url: String::new(),
            height: quadrant.height(),
            id: format!(
                "{}-view-{}-{timestamp}",
                record.id,
                normalize_cache_segment(&view_kind)
            ),
            project_relative_path,
            role: "master".to_string(),
            source: "ai-generated".to_string(),
            width: quadrant.width(),
        });
        record.views[view_index].quality = Some(CharacterViewQualityReport {
            checked_at: timestamp,
            score: Some(84),
            warnings: vec![
                "由 Turnaround 单图拆分得到，四向同源一致；仍需后续透明背景检查。".to_string(),
                consistency_note.to_string(),
            ],
        });
        handled.push(view_index);
    }

    Ok(handled)
}

fn resolve_turnaround_sheet_side(
    app: Option<&AppHandle>,
    provider: &StoredImageProvider,
    model: &StoredImageModel,
    cell_size: u32,
) -> u32 {
    let raw = cell_size.saturating_mul(2).clamp(256, 2048);
    if !crate::character::generation::local::provider_bridge::is_local_image_preset(
        provider.preset.as_str(),
    ) {
        return raw;
    }

    let Some(app) = app else {
        return raw;
    };

    let connection = match open_app_database(app) {
        Ok(value) => value,
        Err(_) => return raw,
    };
    if ensure_app_settings_schema(&connection).is_err() {
        return raw;
    }

    let settings = match crate::character::generation::local::load_local_inference_settings(&connection)
    {
        Ok(value) => value,
        Err(_) => return raw,
    };
    let hardware = match crate::character::generation::local::resolve_hardware_profile(&connection, false)
    {
        Ok(value) => value,
        Err(_) => return raw,
    };
    let profile_override = if model.name.trim().is_empty() {
        None
    } else {
        Some(model.name.as_str())
    };
    let limits = match crate::character::generation::local::generation_limits::build_generation_limits(
        &hardware.hardware,
        &settings,
        profile_override,
    ) {
        Ok(value) => value,
        Err(_) => return raw,
    };
    let capped = crate::character::generation::local::resolution::resolve_local_turnaround_sheet_side(
        cell_size,
        limits.max_side,
    );
    if capped < raw {
        warn!(
            target = "jmtools::characters",
            cell_size,
            sheet_side = capped,
            max_side = limits.max_side,
            "本地生图 turnaround 拼图分辨率已按显存封顶"
        );
    }
    capped
}
