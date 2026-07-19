use std::collections::HashMap;
use std::fs;
use std::path::Path;

use image::{imageops, RgbaImage};
use serde_json::{json, Value};

use crate::character::{
    character_record_preview_image_output, workflow_analyze_character, workflow_build_draft,
    workflow_create_character_asset, workflow_default_master_plan, workflow_generate_action_frames,
    workflow_generate_candidates, workflow_generate_master_plan, workflow_generate_views,
    workflow_build_draft_with_generation_count, workflow_normalize_character_view, workflow_remove_background, workflow_resolve_selected_plan,
    ActionFrameGenerationOptions,
};
use crate::commands::settings::{get_app_settings, resolve_text_ai_defaults};
use crate::engine::graph::ports::resolve_merged_inputs;
use crate::engine::graph::types::WorkflowEdgeInput;
use crate::engine::graph::types::WorkflowNodeInput;
use crate::engine::workflow_assets::{
    asset_data, asset_kind, extract_negative_prompt_text, extract_prompt_text, string_field, wrap_asset,
    KIND_CANDIDATE_IMAGES, KIND_CHARACTER_SEED, KIND_MASTER_PLAN, KIND_OUTFIT_PROFILE, KIND_PROMPT_BUNDLE,
    KIND_PROMPT_TEXT, KIND_STYLE_PROFILE,
};
use crate::prompt_compiler::{compile_prompt_from_inputs, CompileOptions};

use super::ExecutorContext;
use tauri::AppHandle;

pub fn execute_character_domain_node(
    context: &mut ExecutorContext<'_>,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    match node.kind.as_str() {
        "character.inputSeed" => execute_input_seed_node(node),
        "character.styleProfile" => execute_style_profile_node(context, node),
        "character.outfitProfile" => execute_outfit_profile_node(node),
        "ai.negativePrompt" => execute_negative_prompt_node(node),
        "logic.promptMerge" => execute_prompt_merge_node(node, edges, outputs_by_node),
        "logic.promptCompiler" => execute_prompt_compiler_node(node, edges, outputs_by_node),
        "character.create" => execute_character_create_node(context.project_root, node, edges, outputs_by_node),
        "character.generatePlan" => {
            execute_generate_plan_node(context, node, edges, outputs_by_node)
        }
        "character.generateCandidates" => {
            execute_generate_candidates_node(context, node, edges, outputs_by_node)
        }
        "character.generateViews" => execute_generate_views_node(context, node, edges, outputs_by_node),
        "character.removeBackground" => {
            execute_remove_background_node(context, node, edges, outputs_by_node)
        }
        "character.normalize" => execute_normalize_node(context.project_root, node, edges, outputs_by_node),
        "character.analyze" => execute_analyze_node(context.project_root, node, edges, outputs_by_node),
        "character.generateActionFrames" => {
            execute_generate_action_frames_node(context, node, edges, outputs_by_node)
        }
        "output.spriteSplit" => execute_sprite_split_node(context.project_root, node, edges, outputs_by_node),
        "output.atlasPack" => execute_atlas_pack_node(context.project_root, node, edges, outputs_by_node),
        "output.animationExport" => {
            execute_animation_export_node(context.project_root, node, edges, outputs_by_node)
        }
        "output.godotSpriteFrames" => {
            execute_godot_sprite_frames_node(context.project_root, node, edges, outputs_by_node)
        }
        _ => Err("未知角色域节点。".to_string()),
    }
}

fn execute_input_seed_node(node: &WorkflowNodeInput) -> Result<Value, String> {
    let name = required_param(node, "name")?;
    let data = json!({
        "age": param_i64(node, "age", 20),
        "class": string_param(node, "characterClass", "warrior"),
        "gender": string_param(node, "gender", "unknown"),
        "name": name,
        "race": string_param(node, "race", "human"),
    });

    Ok(wrap_asset(KIND_CHARACTER_SEED, data))
}

use crate::style_compiler::compile_style_profile_from_node;

fn execute_style_profile_node(
    context: &ExecutorContext<'_>,
    node: &WorkflowNodeInput,
) -> Result<Value, String> {
    let data = compile_style_profile_from_node(node, context.app);

    Ok(wrap_asset(KIND_STYLE_PROFILE, data))
}

fn execute_outfit_profile_node(node: &WorkflowNodeInput) -> Result<Value, String> {
    let layers = [
        ("hair", string_param(node, "hairStyle", "")),
        ("helmet", string_param(node, "helmet", "")),
        ("armor", string_param(node, "armorType", "")),
        ("cloth", string_param(node, "clothStyle", "")),
        ("weapon", string_param(node, "weaponType", "")),
        ("accessory", string_param(node, "cape", "")),
        ("effect", string_param(node, "auraEffect", "")),
    ]
    .into_iter()
    .filter(|(_, value)| !value.is_empty())
    .map(|(kind, value)| json!({ "kind": kind, "value": value }))
    .collect::<Vec<_>>();

    Ok(wrap_asset(
        KIND_OUTFIT_PROFILE,
        json!({
            "armorType": string_param(node, "armorType", ""),
            "auraEffect": string_param(node, "auraEffect", ""),
            "cape": string_param(node, "cape", ""),
            "clothStyle": string_param(node, "clothStyle", ""),
            "hairStyle": string_param(node, "hairStyle", ""),
            "helmet": string_param(node, "helmet", ""),
            "layers": layers,
            "weaponSize": string_param(node, "weaponSize", "medium"),
            "weaponType": string_param(node, "weaponType", ""),
        }),
    ))
}

fn execute_negative_prompt_node(node: &WorkflowNodeInput) -> Result<Value, String> {
    let exclude_terms = string_param(node, "excludeTerms", "blurry, low quality, deformed hands, extra limbs");
    let negative_text = exclude_terms
        .split(',')
        .map(str::trim)
        .filter(|term| !term.is_empty())
        .collect::<Vec<_>>()
        .join(", ");

    Ok(wrap_asset(
        KIND_PROMPT_TEXT,
        json!({
            "negativeText": negative_text,
            "text": "",
        }),
    ))
}

fn execute_prompt_merge_node(
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let mut segments = Vec::new();

    for key in ["characterSeed", "styleProfile", "outfitProfile", "negativePrompt", "prompt"] {
        if let Some(value) = inputs.get(key) {
            append_asset_segments(value, &mut segments);
        }
    }

    if segments.is_empty() {
        return Err("提示词合并节点缺少上游 asset 输入。".to_string());
    }

    let negative = inputs
        .get("negativePrompt")
        .map(extract_negative_prompt_text)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            let value = string_param(node, "negativePrompt", "");
            if value.is_empty() { None } else { Some(value) }
        })
        .unwrap_or_default();

    let prefix = string_param(node, "prefix", "");
    let mut text = if prefix.is_empty() {
        segments.join(", ")
    } else {
        format!("{prefix}, {}", segments.join(", "))
    };

    if let Some(suffix) = node.params.get("suffix").and_then(Value::as_str) {
        if !suffix.trim().is_empty() {
            text = format!("{text}, {}", suffix.trim());
        }
    }

    Ok(wrap_asset(
        KIND_PROMPT_TEXT,
        json!({
            "negativeText": negative,
            "text": text,
        }),
    ))
}

fn execute_prompt_compiler_node(
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let bundle = compile_prompt_from_inputs(
        &inputs,
        &CompileOptions {
            prefix: string_param(node, "prefix", "pixel art game character"),
            suffix: string_param(node, "suffix", ""),
            extra_negative: string_param(node, "negativePrompt", ""),
            weights_json: string_param(node, "weights", ""),
            override_slots_json: string_param(node, "overrideSlots", ""),
        },
    )?;

    Ok(wrap_asset(
        KIND_PROMPT_BUNDLE,
        serde_json::to_value(bundle).map_err(|error| format!("序列化 PromptBundle 失败：{error}"))?,
    ))
}

fn resolve_effective_selected_plan_id(node: &WorkflowNodeInput, inputs: &Value) -> String {
    let param_plan_id = string_param(node, "selectedPlanId", "");
    if !param_plan_id.trim().is_empty() {
        return param_plan_id;
    }

    read_manual_selection_value(inputs.get("manualSelection"))
}

fn read_manual_selection_value(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(text)) => text.trim().to_string(),
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(|item| item.as_str().map(str::trim))
            .filter(|item| !item.is_empty())
            .collect::<Vec<_>>()
            .join(","),
        _ => String::new(),
    }
}

fn execute_character_create_node(
    project_root: &Path,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let seed = inputs.get("characterSeed").and_then(asset_data);
    let name = seed
        .map(|data| string_field(data, "name"))
        .filter(|value| !value.is_empty())
        .or_else(|| {
            let value = string_param(node, "name", "");
            if value.is_empty() { None } else { Some(value) }
        })
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "角色创建节点缺少名称。".to_string())?;
    let description = string_param(node, "description", &format!("工作流角色 {name}"));
    let style = string_param(node, "style", "pixel");
    let draft = workflow_build_draft(
        &name,
        &description,
        &style,
        &string_param(node, "size", "64x64"),
        &string_param(node, "direction", "single"),
    );

    let master_plan = if let Some(plan_asset) = inputs.get("masterPlan").and_then(asset_data) {
        serde_json::from_value(plan_asset.clone())
            .map_err(|error| format!("解析上游母版方案失败：{error}"))?
    } else {
        workflow_default_master_plan(&name, &description, &description)
    };

    let candidate_input = inputs.get("candidateImages");
    if let Some(value) = candidate_input {
        if asset_kind(value) != Some(KIND_CANDIDATE_IMAGES) {
            return Err("候选图输入类型不匹配。".to_string());
        }
    }
    let candidate_data = candidate_input.and_then(asset_data);

    let selected_plan = workflow_resolve_selected_plan(
        &master_plan,
        candidate_data,
        &resolve_effective_selected_plan_id(node, &inputs),
    )?;

    let task_id = candidate_data
        .and_then(|data| data.get("taskId").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| {
            format!(
                "workflow-create-{}",
                crate::storage::database::current_timestamp()
            )
        });

    let record = workflow_create_character_asset(
        project_root,
        draft,
        master_plan,
        selected_plan,
        string_param(node, "providerName", "workflow"),
        string_param(node, "model", "workflow"),
        task_id,
    )?;

    Ok(json!({ "character": record }))
}

fn execute_generate_plan_node(
    context: &ExecutorContext<'_>,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let app = context
        .app
        .ok_or_else(|| "母版方案生成需要应用上下文。".to_string())?
        .clone();
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let seed = inputs.get("characterSeed").and_then(asset_data);
    let name = seed
        .map(|data| string_field(data, "name"))
        .filter(|value| !value.is_empty())
        .or_else(|| {
            let value = string_param(node, "name", "");
            if value.is_empty() { None } else { Some(value) }
        })
        .unwrap_or_else(|| "未命名角色".to_string());
    let description = string_param(node, "description", "");
    let style = string_param(node, "style", "pixel");
    let draft = workflow_build_draft_with_generation_count(
        &name,
        &description,
        &style,
        "64x64",
        "single",
        Some(&string_param(node, "candidateCount", "2")),
    );
    let task_id = format!(
        "workflow-plan-{}",
        crate::storage::database::current_timestamp()
    );
    context.check_canceled()?;
    let compiled_prompt = inputs.get("promptBundle").and_then(extract_prompt_text);
    let (provider_id, model) = resolve_text_ai_from_settings(&app, node)?;
    let plan = workflow_generate_master_plan(
        app,
        draft,
        provider_id,
        model,
        task_id,
        compiled_prompt,
    )?;

    Ok(wrap_asset(
        KIND_MASTER_PLAN,
        serde_json::to_value(plan).map_err(|error| format!("序列化母版方案失败：{error}"))?,
    ))
}

fn execute_generate_candidates_node(
    context: &mut ExecutorContext<'_>,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    context.report_progress(12);
    let app = context
        .app
        .ok_or_else(|| "候选图生成需要应用上下文。".to_string())?
        .clone();
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let master_plan_value = inputs
        .get("masterPlan")
        .and_then(asset_data)
        .ok_or_else(|| "候选图生成节点缺少母版方案输入。")?;
    let master_plan: crate::character::CharacterMasterPlanInput =
        serde_json::from_value(master_plan_value.clone())
            .map_err(|error| format!("解析母版方案失败：{error}"))?;
    let seed = inputs.get("characterSeed").and_then(asset_data);
    let name = seed
        .map(|data| string_field(data, "name"))
        .filter(|value| !value.is_empty())
        .or_else(|| {
            let value = string_param(node, "name", "");
            if value.is_empty() { None } else { Some(value) }
        })
        .unwrap_or_else(|| "未命名角色".to_string());
    let description = string_param(node, "description", "工作流角色候选图");
    let draft = workflow_build_draft_with_generation_count(
        &name,
        &description,
        &string_param(node, "style", "pixel"),
        "64x64",
        "single",
        Some(&string_param(node, "candidateCount", "2")),
    );
    let task_id = format!(
        "workflow-candidates-{}",
        crate::storage::database::current_timestamp()
    );
    context.report_progress(28);
    context.check_canceled()?;
    let compiled_prompt = inputs.get("promptBundle").and_then(extract_prompt_text);
    let provider_id = optional_string_param(node, "providerId");
    let model = optional_string_param(node, "model");
    let images = workflow_generate_candidates(
        app,
        context.project_root,
        draft,
        master_plan,
        task_id.clone(),
        compiled_prompt,
        provider_id,
        model,
    )?;
    context.report_progress(88);

    Ok(wrap_asset(
        KIND_CANDIDATE_IMAGES,
        json!({
            "items": images,
            "taskId": task_id,
        }),
    ))
}

fn execute_generate_views_node(
    context: &ExecutorContext<'_>,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let app = context
        .app
        .ok_or_else(|| "视图生成需要应用上下文。".to_string())?
        .clone();
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let character_id = inputs
        .pointer("/character/id")
        .and_then(Value::as_str)
        .or_else(|| node.params.get("characterId").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "视图生成节点缺少角色 ID。".to_string())?
        .to_string();
    context.check_canceled()?;
    let view_mode = optional_string_param(node, "viewMode");
    let views = optional_string_list_param(node, "views");
    let generation_strategy = optional_string_param(node, "generationStrategy");
    let reference_strength = node
        .params
        .get("referenceStrength")
        .and_then(Value::as_f64)
        .filter(|value| *value > 0.0);
    let reference_mode = optional_string_param(node, "referenceMode");
    let pose_reference_png = resolve_pose_reference_bytes(
        context.project_root,
        &inputs,
        reference_mode.as_deref().unwrap_or("characterOnly"),
    )?;
    let record = workflow_generate_views(
        app,
        context.project_root,
        character_id,
        view_mode,
        views,
        generation_strategy,
        reference_strength,
        reference_mode,
        pose_reference_png,
    )?;
    Ok(json!({ "character": record }))
}

fn execute_remove_background_node(
    context: &mut ExecutorContext<'_>,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    context.report_progress(15);
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let character_id = inputs
        .pointer("/character/id")
        .and_then(Value::as_str)
        .or_else(|| node.params.get("characterId").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "角色去背景节点缺少角色 ID。".to_string())?
        .to_string();

    context.report_progress(35);
    context.check_canceled()?;
    let record = workflow_remove_background(
        context.project_root,
        character_id,
        node.params
            .get("viewId")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .map(str::to_string),
        node.params
            .get("engine")
            .and_then(Value::as_str)
            .map(str::to_string),
        node.params.get("tolerance").and_then(Value::as_u64).map(|value| value as u8),
        node.params.get("edgeSoftness").and_then(Value::as_u64).map(|value| value as u8),
        node.params
            .get("cleanupStrength")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .map(str::to_string),
        node.params
            .get("holeFillMaxPixels")
            .and_then(Value::as_u64)
            .map(|value| value as u32),
        node.params
            .get("spillSuppression")
            .and_then(Value::as_u64)
            .map(|value| value as u8),
        node.params.get("preserveSmallParts").and_then(Value::as_bool),
        node.params.get("alphaMatting").and_then(Value::as_bool),
    )?;
    context.report_progress(85);

    Ok(build_character_node_output(&record, false))
}

fn execute_normalize_node(
    project_root: &Path,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let character_id = inputs
        .pointer("/character/id")
        .and_then(Value::as_str)
        .or_else(|| node.params.get("characterId").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty());

    if let Some(character_id) = character_id {
        let scale_mode = if node
            .params
            .get("preserveSourceResolution")
            .and_then(Value::as_bool)
            .unwrap_or(false)
        {
            "none"
        } else {
            node.params
                .get("scaleMode")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("integer")
        };
        let record = workflow_normalize_character_view(
            project_root,
            character_id,
            node.params
                .get("viewId")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty()),
            node.params.get("targetWidth").and_then(Value::as_u64).unwrap_or(64) as u32,
            node.params.get("targetHeight").and_then(Value::as_u64).unwrap_or(64) as u32,
            scale_mode,
            node.params
                .get("paletteSize")
                .and_then(Value::as_u64)
                .unwrap_or(0) as u32,
        )?;
        return Ok(build_character_node_output(&record, true));
    }

    let image = inputs
        .get("input")
        .or_else(|| inputs.get("image"))
        .ok_or_else(|| "规范化节点缺少图片或角色输入。")?;
    let path = image
        .get("path")
        .or_else(|| image.get("projectRelativePath"))
        .and_then(Value::as_str)
        .ok_or_else(|| "规范化节点缺少图片路径。")?;
    let source_path = super::resolve_source_path(project_root, "projectRelativePath", path)?;
    let target_width = node.params.get("targetWidth").and_then(Value::as_u64).unwrap_or(64) as u32;
    let target_height = node.params.get("targetHeight").and_then(Value::as_u64).unwrap_or(64) as u32;
    let rgba = image::open(&source_path)
        .map_err(|error| format!("读取图片失败：{error}"))?
        .to_rgba8();
    let normalized = fit_rgba_image(&rgba, target_width, target_height);
    let export_dir = project_root.join("exports").join("workflows").join("normalized");
    fs::create_dir_all(&export_dir).map_err(|error| format!("创建导出目录失败：{error}"))?;
    let file_name = format!(
        "normalized_{}.png",
        crate::storage::database::current_timestamp()
    );
    let output_path = export_dir.join(&file_name);
    normalized
        .save(&output_path)
        .map_err(|error| format!("写入规范化图片失败：{error}"))?;
    let project_relative_path = format!("exports/workflows/normalized/{file_name}");
    Ok(json!({
        "image": {
            "absolutePath": output_path.to_string_lossy(),
            "height": target_height,
            "kind": "projectRelativePath",
            "path": project_relative_path,
            "width": target_width
        }
    }))
}

fn execute_sprite_split_node(
    project_root: &Path,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let image = inputs
        .get("input")
        .or_else(|| inputs.get("image"))
        .ok_or_else(|| "帧切分节点缺少图片输入。")?;
    let path = image
        .get("path")
        .or_else(|| image.get("projectRelativePath"))
        .and_then(Value::as_str)
        .ok_or_else(|| "帧切分节点缺少图片路径。")?;
    let source_path = super::resolve_source_path(project_root, "projectRelativePath", path)?;
    let frame_width = node.params.get("frameWidth").and_then(Value::as_u64).unwrap_or(64) as u32;
    let frame_height = node.params.get("frameHeight").and_then(Value::as_u64).unwrap_or(64) as u32;
    let columns = node.params.get("columns").and_then(Value::as_u64).unwrap_or(1).max(1) as u32;
    let rows = node.params.get("rows").and_then(Value::as_u64).unwrap_or(1).max(1) as u32;
    let rgba = image::open(&source_path)
        .map_err(|error| format!("读取切分源图失败：{error}"))?
        .to_rgba8();
    let export_name = string_param(node, "exportName", "frames");
    let export_dir = project_root
        .join("exports")
        .join("workflows")
        .join(&export_name);
    fs::create_dir_all(&export_dir).map_err(|error| format!("创建帧目录失败：{error}"))?;
    let mut frames = Vec::new();

    for row in 0..rows {
        for column in 0..columns {
            let index = row * columns + column;
            let x = column * frame_width;
            let y = row * frame_height;
            if x + frame_width > rgba.width() || y + frame_height > rgba.height() {
                continue;
            }
            let sub = imageops::crop_imm(&rgba, x, y, frame_width, frame_height).to_image();
            let file_name = format!("frame_{index:02}.png");
            let output_path = export_dir.join(&file_name);
            sub.save(&output_path)
                .map_err(|error| format!("保存切分帧失败：{error}"))?;
            let project_relative_path =
                format!("exports/workflows/{export_name}/{file_name}").replace('\\', "/");
            frames.push(json!({
                "absolutePath": output_path.to_string_lossy(),
                "index": index,
                "path": project_relative_path,
            }));
        }
    }

    Ok(wrap_asset(
        "spriteFrames",
        json!({
            "frames": frames,
            "frameHeight": frame_height,
            "frameWidth": frame_width,
        }),
    ))
}

fn execute_atlas_pack_node(
    project_root: &Path,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let frame_width = node.params.get("frameWidth").and_then(Value::as_u64).unwrap_or(64) as u32;
    let frame_height = node.params.get("frameHeight").and_then(Value::as_u64).unwrap_or(64) as u32;
    let columns = node.params.get("columns").and_then(Value::as_u64).unwrap_or(1).max(1) as u32;
    let export_name = string_param(node, "fileName", "atlas");

    if let Some(character) = inputs.get("character") {
        let action_id = string_param(node, "actionId", "idle");
        let frame_paths = collect_character_frame_image_paths(project_root, character, &action_id)?;
        let rows = ((frame_paths.len() as u32) + columns - 1) / columns;
        let atlas_width = frame_width * columns;
        let atlas_height = frame_height * rows.max(1);
        let mut atlas = RgbaImage::new(atlas_width, atlas_height);
        let mut frame_entries = serde_json::Map::new();

        for (index, source_path) in frame_paths.iter().enumerate() {
            let column = (index as u32) % columns;
            let row = (index as u32) / columns;
            let x = column * frame_width;
            let y = row * frame_height;
            let rgba = image::open(source_path)
                .map_err(|error| format!("读取动作帧 {index} 失败：{error}"))?
                .to_rgba8();
            let resized = if rgba.width() == frame_width && rgba.height() == frame_height {
                rgba
            } else {
                imageops::resize(&rgba, frame_width, frame_height, imageops::FilterType::Nearest)
            };
            imageops::overlay(&mut atlas, &resized, i64::from(x), i64::from(y));
            let frame_key = format!("frame_{index:02}");
            frame_entries.insert(
                frame_key,
                json!({
                    "frame": { "x": x, "y": y, "w": frame_width, "h": frame_height },
                    "sourceSize": { "w": frame_width, "h": frame_height }
                }),
            );
        }

        return write_atlas_export(
            project_root,
            &export_name,
            &atlas,
            atlas_width,
            atlas_height,
            frame_entries,
        );
    }

    let image = inputs
        .get("input")
        .or_else(|| inputs.get("image"))
        .ok_or_else(|| "图集打包节点缺少图片或角色输入。")?;
    let path = image
        .get("path")
        .or_else(|| image.get("projectRelativePath"))
        .and_then(Value::as_str)
        .ok_or_else(|| "图集打包节点缺少图片路径。")?;
    let source_path = super::resolve_source_path(project_root, "projectRelativePath", path)?;
    let rows = node.params.get("rows").and_then(Value::as_u64).unwrap_or(1).max(1) as u32;
    let rgba = image::open(&source_path)
        .map_err(|error| format!("读取图集源图失败：{error}"))?
        .to_rgba8();
    let atlas_width = frame_width * columns;
    let atlas_height = frame_height * rows;
    let mut atlas = RgbaImage::new(atlas_width, atlas_height);
    let mut frame_entries = serde_json::Map::new();

    for row in 0..rows {
        for column in 0..columns {
            let index = row * columns + column;
            let x = column * frame_width;
            let y = row * frame_height;
            if x + frame_width > rgba.width() || y + frame_height > rgba.height() {
                continue;
            }
            let sub = imageops::crop_imm(&rgba, x, y, frame_width, frame_height).to_image();
            imageops::overlay(&mut atlas, &sub, i64::from(column * frame_width), i64::from(row * frame_height));
            let frame_key = format!("frame_{index:02}");
            frame_entries.insert(
                frame_key,
                json!({
                    "frame": { "x": x, "y": y, "w": frame_width, "h": frame_height },
                    "sourceSize": { "w": frame_width, "h": frame_height }
                }),
            );
        }
    }

    write_atlas_export(
        project_root,
        &export_name,
        &atlas,
        atlas_width,
        atlas_height,
        frame_entries,
    )
}

fn write_atlas_export(
    project_root: &Path,
    export_name: &str,
    atlas: &RgbaImage,
    atlas_width: u32,
    atlas_height: u32,
    frame_entries: serde_json::Map<String, Value>,
) -> Result<Value, String> {
    let export_dir = project_root.join("exports").join("workflows");
    fs::create_dir_all(&export_dir).map_err(|error| format!("创建导出目录失败：{error}"))?;
    let png_path = export_dir.join(format!("{export_name}.png"));
    let json_path = export_dir.join(format!("{export_name}.json"));
    atlas
        .save(&png_path)
        .map_err(|error| format!("保存图集 PNG 失败：{error}"))?;
    let manifest = json!({
        "frames": Value::Object(frame_entries),
        "meta": {
            "image": format!("{export_name}.png"),
            "size": { "w": atlas_width, "h": atlas_height }
        }
    });
    fs::write(
        &json_path,
        serde_json::to_string_pretty(&manifest)
            .map_err(|error| format!("序列化图集 JSON 失败：{error}"))?,
    )
    .map_err(|error| format!("写入图集 JSON 失败：{error}"))?;
    let project_relative_png = png_path
        .strip_prefix(project_root)
        .map(|value| value.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| png_path.to_string_lossy().replace('\\', "/"));

    Ok(json!({
        "asset": {
            "absolutePath": png_path.to_string_lossy(),
            "kind": "atlas",
            "manifestPath": json_path.to_string_lossy(),
            "path": project_relative_png,
        }
    }))
}

fn execute_animation_export_node(
    project_root: &Path,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let target_engine = string_param(node, "targetEngine", "godot");
    let animation_name = string_param(node, "animationName", "idle");
    let fps = node.params.get("fps").and_then(Value::as_u64).unwrap_or(8);
    let has_wired_frames = edges
        .iter()
        .any(|edge| edge.to_node_id == node.id && edge.to_port == "frames");
    let has_wired_character = edges
        .iter()
        .any(|edge| edge.to_node_id == node.id && edge.to_port == "character");
    let has_wired_input = has_wired_frames || has_wired_character;

    let mut frames = inputs
        .get("frames")
        .and_then(asset_data)
        .and_then(|data| data.get("frames"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    if frames.is_empty() {
        if let Some(character) = inputs.get("character") {
            frames = collect_character_animation_export_frames(project_root, character, &animation_name)?;
        }
    }

    if has_wired_input && frames.is_empty() {
        return Err("动画导出缺少帧数据，请确认上游动作帧已生成。".to_string());
    }

    if !has_wired_input && frames.is_empty() {
        return Err("动画导出需要接入帧列表或角色输入。".to_string());
    }

    let export_name = string_param(node, "fileName", "animation");
    let export_dir = project_root.join("exports").join("workflows");
    fs::create_dir_all(&export_dir).map_err(|error| format!("创建导出目录失败：{error}"))?;
    let json_path = export_dir.join(format!("{export_name}.animation.json"));
    let manifest = json!({
        "animation": animation_name,
        "engine": target_engine,
        "fps": fps,
        "frames": frames,
    });
    fs::write(
        &json_path,
        serde_json::to_string_pretty(&manifest)
            .map_err(|error| format!("序列化动画导出 JSON 失败：{error}"))?,
    )
    .map_err(|error| format!("写入动画导出 JSON 失败：{error}"))?;
    let project_relative_path = json_path
        .strip_prefix(project_root)
        .map(|value| value.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| json_path.to_string_lossy().replace('\\', "/"));

    Ok(json!({
        "asset": {
            "absolutePath": json_path.to_string_lossy(),
            "kind": "animationExport",
            "path": project_relative_path,
        }
    }))
}

fn execute_analyze_node(
    project_root: &Path,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let character_id = inputs
        .pointer("/character/id")
        .and_then(Value::as_str)
        .or_else(|| node.params.get("characterId").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "图像预检节点缺少角色 ID。".to_string())?
        .to_string();
    let view_id = node
        .params
        .get("viewId")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string);
    let min_alpha_coverage = node
        .params
        .get("minAlphaCoverage")
        .and_then(Value::as_f64)
        .unwrap_or(6.0)
        .clamp(0.0, 100.0);
    let max_bbox_ratio = node
        .params
        .get("maxBboxRatio")
        .and_then(Value::as_f64)
        .unwrap_or(98.0)
        .clamp(10.0, 100.0);

    let record =
        workflow_analyze_character(project_root, character_id, view_id, min_alpha_coverage, max_bbox_ratio)?;
    let summary = crate::character::character_processing_summary(&record)
        .unwrap_or_else(|| "图像预检完成。".to_string());
    Ok(json!({ "character": record, "summary": summary }))
}

fn execute_generate_action_frames_node(
    context: &ExecutorContext<'_>,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let app = context
        .app
        .ok_or_else(|| "动作帧生成需要应用上下文。".to_string())?;
    let project_root = context.project_root;
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let character_id = inputs
        .pointer("/character/id")
        .and_then(Value::as_str)
        .or_else(|| node.params.get("characterId").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "动作帧生成节点缺少角色 ID。".to_string())?
        .to_string();
    let frame_count = node.params.get("frameCount").and_then(Value::as_u64).unwrap_or(8) as u16;
    let all_views = node
        .params
        .get("allViews")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let preview_fps = node
        .params
        .get("previewFps")
        .and_then(Value::as_u64)
        .unwrap_or(12)
        .clamp(1, 60) as u16;
    let loop_mode = node
        .params
        .get("loopMode")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("auto")
        .to_string();

    // actionIds 为 multiSelect 控件，前端以逗号分隔字符串存储；为空时回退到待机。
    let action_ids: Vec<String> = {
        let raw = node
            .params
            .get("actionIds")
            .and_then(Value::as_str)
            .unwrap_or("idle");
        let mut parsed: Vec<String> = raw
            .split(',')
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .collect();
        parsed.dedup();
        if parsed.is_empty() {
            vec!["idle".to_string()]
        } else {
            parsed
        }
    };

    let record = workflow_generate_action_frames(
        app,
        project_root,
        character_id,
        action_ids,
        frame_count,
        all_views,
        None,
        preview_fps,
        &loop_mode,
        ActionFrameGenerationOptions {
            generation_mode: optional_string_param(node, "generationMode"),
            max_retries: node
                .params
                .get("maxRetries")
                .and_then(Value::as_u64)
                .map(|value| value as u16),
            motion_prompt: optional_string_param(node, "motionPrompt"),
            reference_mode: optional_string_param(node, "referenceMode"),
            pose_reference_png: resolve_pose_reference_bytes(
                project_root,
                &inputs,
                node.params
                    .get("referenceMode")
                    .and_then(Value::as_str)
                    .unwrap_or("characterOnly"),
            )?,
            reference_strength: node
                .params
                .get("referenceStrength")
                .and_then(Value::as_f64)
                .filter(|value| *value > 0.0),
            user_feedback: optional_string_param(node, "userFeedback"),
        },
    )?;
    Ok(json!({ "character": record }))
}

fn execute_godot_sprite_frames_node(
    project_root: &Path,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let animation_name = string_param(node, "animationName", "idle");
    let fps = node.params.get("fps").and_then(Value::as_u64).unwrap_or(8);
    let export_name = string_param(node, "fileName", "sprite_frames");
    let export_dir = project_root.join("exports").join("workflows").join("godot");
    fs::create_dir_all(&export_dir).map_err(|error| format!("创建 Godot 导出目录失败：{error}"))?;

    let frames = inputs
        .get("frames")
        .and_then(asset_data)
        .and_then(|data| data.get("frames"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let tres_path = export_dir.join(format!("{export_name}.tres"));
    let frame_lines = if frames.is_empty() {
        "[]".to_string()
    } else {
        frames
            .iter()
            .enumerate()
            .map(|(index, _frame)| {
                format!(
                    "SubResource(\"AtlasTexture_{index}\") # duration 1.0 / {fps}.0"
                )
            })
            .collect::<Vec<_>>()
            .join(",\n")
    };

    let tres_content = format!(
        "[gd_resource type=\"SpriteFrames\" format=3]\n\n[resource]\nanimations = [{{\n\"frames\": [{frame_lines}],\n\"loop\": true,\n\"name\": \"{animation_name}\",\n\"speed\": {fps}.0\n}}]\n"
    );
    fs::write(&tres_path, tres_content).map_err(|error| format!("写入 Godot .tres 失败：{error}"))?;

    let project_relative_path = tres_path
        .strip_prefix(project_root)
        .map(|value| value.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| tres_path.to_string_lossy().replace('\\', "/"));

    Ok(json!({
        "asset": {
            "absolutePath": tres_path.to_string_lossy(),
            "kind": "godotSpriteFrames",
            "path": project_relative_path,
        }
    }))
}

fn append_asset_segments(value: &Value, segments: &mut Vec<String>) {
    let Some(data) = asset_data(value) else {
        if let Some(text) = extract_prompt_text(value) {
            segments.push(text);
        }
        return;
    };

    match asset_kind(value).unwrap_or_default() {
        KIND_CHARACTER_SEED => {
            let name = string_field(data, "name");
            let race = string_field(data, "race");
            let class_name = string_field(data, "class");
            if !name.is_empty() {
                segments.push(format!("character {name}"));
            }
            if !race.is_empty() {
                segments.push(format!("race {race}"));
            }
            if !class_name.is_empty() {
                segments.push(format!("class {class_name}"));
            }
        }
        KIND_STYLE_PROFILE => {
            if let Some(style_prompt) = data.get("stylePrompt").and_then(Value::as_str) {
                segments.push(style_prompt.to_string());
            }
        }
        KIND_OUTFIT_PROFILE => {
            if let Some(layers) = data.get("layers").and_then(Value::as_array) {
                for layer in layers {
                    if let (Some(kind), Some(value)) = (
                        layer.get("kind").and_then(Value::as_str),
                        layer.get("value").and_then(Value::as_str),
                    ) {
                        segments.push(format!("{kind}: {value}"));
                    }
                }
            }
        }
        KIND_PROMPT_TEXT => {
            if let Some(text) = data.get("text").and_then(Value::as_str) {
                if !text.trim().is_empty() {
                    segments.push(text.trim().to_string());
                }
            }
        }
        KIND_MASTER_PLAN => {
            if let Some(prompt) = data.get("pixelPrompt").and_then(Value::as_str) {
                segments.push(prompt.to_string());
            }
        }
        _ => {
            if let Some(text) = data.get("text").and_then(Value::as_str) {
                if !text.trim().is_empty() {
                    segments.push(text.trim().to_string());
                }
            }
        }
    }
}

fn fit_rgba_image(source: &RgbaImage, target_width: u32, target_height: u32) -> RgbaImage {
    let mut canvas = RgbaImage::new(target_width, target_height);
    let scale = (f64::from(target_width) / f64::from(source.width()))
        .min(f64::from(target_height) / f64::from(source.height()));
    let scaled_width = ((f64::from(source.width()) * scale).round() as u32).max(1);
    let scaled_height = ((f64::from(source.height()) * scale).round() as u32).max(1);
    let resized = imageops::resize(source, scaled_width, scaled_height, imageops::FilterType::Nearest);
    let offset_x = i64::from((target_width - scaled_width) / 2);
    let offset_y = i64::from((target_height - scaled_height) / 2);
    imageops::overlay(&mut canvas, &resized, offset_x, offset_y);
    canvas
}

fn build_character_node_output(record: &crate::character::CharacterAssetRecord, prefer_normalized: bool) -> Value {
    let mut output = json!({ "character": record });

    if let Some(image) = character_record_preview_image_output(record, prefer_normalized) {
        output["image"] = image;
    }

    output
}

fn optional_string_param(node: &WorkflowNodeInput, key: &str) -> Option<String> {
    node.params
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn optional_string_list_param(node: &WorkflowNodeInput, key: &str) -> Option<Vec<String>> {
    let value = node.params.get(key)?;

    if let Some(items) = value.as_array() {
        let parsed = items
            .iter()
            .filter_map(|item| item.as_str().map(str::trim).filter(|part| !part.is_empty()))
            .map(str::to_string)
            .collect::<Vec<_>>();

        return if parsed.is_empty() { None } else { Some(parsed) };
    }

    value
        .as_str()
        .map(|raw| {
            raw.split(',')
                .map(str::trim)
                .filter(|part| !part.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|items| !items.is_empty())
}

fn resolve_text_ai_from_settings(
    app: &AppHandle,
    node: &WorkflowNodeInput,
) -> Result<(Option<String>, Option<String>), String> {
    let mut provider_id = optional_string_param(node, "providerId");
    let mut model = optional_string_param(node, "model");

    if provider_id.is_none() || model.is_none() {
        let settings = get_app_settings(app.clone())?;
        let defaults = resolve_text_ai_defaults(&settings);
        if provider_id.is_none() {
            provider_id = defaults.0;
        }
        if model.is_none() {
            model = defaults.1;
        }
    }

    Ok((provider_id, model))
}

fn required_param(node: &WorkflowNodeInput, key: &str) -> Result<String, String> {
    let value = string_param(node, key, "");
    if value.is_empty() {
        return Err(format!("节点参数 {key} 不能为空。"));
    }
    Ok(value)
}

fn read_input_image_bytes(project_root: &Path, image: &Value) -> Result<Vec<u8>, String> {
    let path = image
        .get("path")
        .or_else(|| image.get("projectRelativePath"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "参考图缺少路径。".to_string())?;
    let kind = image
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or("projectRelativePath");
    let source_path = super::resolve_source_path(project_root, kind, path)?;
    fs::read(&source_path).map_err(|error| format!("读取参考图失败：{error}"))
}

fn resolve_pose_reference_bytes(
    project_root: &Path,
    inputs: &Value,
    reference_mode: &str,
) -> Result<Option<Vec<u8>>, String> {
    if reference_mode != "dualReference" {
        return Ok(None);
    }

    let Some(image) = inputs.get("poseReference") else {
        return Ok(None);
    };

    read_input_image_bytes(project_root, image).map(Some)
}

fn find_character_action<'a>(character: &'a Value, action_id: &str) -> Result<&'a Value, String> {
    let actions = character
        .get("actions")
        .and_then(Value::as_array)
        .ok_or_else(|| "角色缺少 actions 数据。".to_string())?;
    actions
        .iter()
        .find(|item| {
            item.get("id").and_then(Value::as_str).map(str::trim) == Some(action_id)
                || item.get("label").and_then(Value::as_str).map(str::trim) == Some(action_id)
        })
        .ok_or_else(|| format!("角色缺少动作「{action_id}」。"))
}

fn collect_character_frame_image_paths(
    project_root: &Path,
    character: &Value,
    action_id: &str,
) -> Result<Vec<std::path::PathBuf>, String> {
    let action = find_character_action(character, action_id)?;
    let frames = action
        .get("frames")
        .and_then(Value::as_array)
        .filter(|items| !items.is_empty())
        .ok_or_else(|| format!("动作「{action_id}」没有可用帧。"))?;

    frames
        .iter()
        .enumerate()
        .map(|(index, frame)| {
            let image = frame
                .get("image")
                .ok_or_else(|| format!("动作帧 {index} 缺少图片。"))?;
            let path = image
                .get("projectRelativePath")
                .or_else(|| image.get("path"))
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| format!("动作帧 {index} 缺少图片路径。"))?;
            super::resolve_source_path(project_root, "projectRelativePath", path)
                .map_err(|error| format!("读取动作帧 {index} 失败：{error}"))
        })
        .collect()
}

fn collect_character_animation_export_frames(
    project_root: &Path,
    character: &Value,
    action_id: &str,
) -> Result<Vec<Value>, String> {
    let action = find_character_action(character, action_id)?;
    let frames = action
        .get("frames")
        .and_then(Value::as_array)
        .filter(|items| !items.is_empty())
        .ok_or_else(|| format!("动作「{action_id}」没有可用帧。"))?;

    let items = frames
        .iter()
        .enumerate()
        .filter_map(|(index, frame)| {
            let image = frame.get("image")?;
            let path = image
                .get("projectRelativePath")
                .or_else(|| image.get("path"))
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())?;
            let absolute_path = super::resolve_source_path(project_root, "projectRelativePath", path)
                .ok()
                .map(|value| value.to_string_lossy().to_string());
            Some(json!({
                "absolutePath": absolute_path,
                "index": frame.get("index").cloned().unwrap_or(json!(index)),
                "path": path,
            }))
        })
        .collect::<Vec<_>>();

    if items.is_empty() {
        return Err(format!("动作「{action_id}」没有可用帧。"));
    }

    Ok(items)
}

fn string_param(node: &WorkflowNodeInput, key: &str, fallback: &str) -> String {
    node.params
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn param_i64(node: &WorkflowNodeInput, key: &str, fallback: i64) -> i64 {
    node.params
        .get(key)
        .and_then(Value::as_i64)
        .unwrap_or(fallback)
}

#[cfg(test)]
mod create_selection_tests {
    use super::*;
    use serde_json::json;

    fn sample_create_node(selected_plan_id: &str) -> WorkflowNodeInput {
        WorkflowNodeInput {
            id: "create".to_string(),
            kind: "character.create".to_string(),
            params: json!({ "selectedPlanId": selected_plan_id }),
            ..WorkflowNodeInput::default()
        }
    }

    #[test]
    fn selected_plan_id_param_takes_priority_over_manual_selection() {
        let node = sample_create_node("A");
        let inputs = json!({ "manualSelection": "B" });

        assert_eq!(resolve_effective_selected_plan_id(&node, &inputs), "A");
    }

    #[test]
    fn manual_selection_used_when_param_empty() {
        let node = sample_create_node("");
        let inputs = json!({ "manualSelection": "B" });

        assert_eq!(resolve_effective_selected_plan_id(&node, &inputs), "B");
    }
}
