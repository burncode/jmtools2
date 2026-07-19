use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde_json::{json, Value};
use tauri::AppHandle;

use crate::commands::asset_tools::{
    run_background_removal_asset_tool, AssetToolResult, BackgroundRemovalToolOptionsInput,
};
use crate::commands::characters::bind_character_tool_result;
use crate::character::{character_record_preview_image_output, get_character_asset};
use crate::character::{
    BindCharacterToolResultInput, BoundingBox, CharacterAssetRecord, CharacterToolResultImageInput,
};
use crate::engine::graph::ports::{resolve_merged_inputs, resolve_pass_through_output};
use crate::engine::graph::types::WorkflowEdgeInput;
use crate::engine::graph::types::WorkflowNodeInput;

pub struct ExecutorContext<'a> {
    pub app: Option<&'a AppHandle>,
    pub project_root: &'a Path,
    pub report_progress: Option<&'a mut dyn FnMut(u8)>,
    /// 运行级取消标记。长任务执行器在进入耗时步骤前调用 `check_canceled`，
    /// 使取消请求无需等待当前节点整段执行完即可生效。
    pub cancel_flag: Option<Arc<AtomicBool>>,
}

impl ExecutorContext<'_> {
    pub fn report_progress(&mut self, progress: u8) {
        if let Some(callback) = self.report_progress.as_mut() {
            callback(progress.min(99));
        }
    }

    pub fn is_canceled(&self) -> bool {
        self.cancel_flag
            .as_ref()
            .map(|flag| flag.load(Ordering::SeqCst))
            .unwrap_or(false)
    }

    /// 若运行已被取消则返回取消错误，供执行器在耗时步骤前提前中断。
    pub fn check_canceled(&self) -> Result<(), String> {
        if self.is_canceled() {
            Err("用户取消了运行。".to_string())
        } else {
            Ok(())
        }
    }
}

pub fn execute_node(
    context: &mut ExecutorContext<'_>,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    match node.kind.as_str() {
        "image.input" => execute_image_input_node(context.project_root, node),
        "tool.backgroundRemoval" => {
            execute_background_removal_node(context, node, edges, outputs_by_node)
        }
        "character.load" => execute_character_load_node(context.project_root, node),
        "character.bindToolResult" => {
            execute_character_bind_tool_result_node(context.project_root, node, edges, outputs_by_node)
        }
        "ai.prompt" => execute_ai_prompt_node(context, node, edges, outputs_by_node),
        "ai.imageGenerate" => execute_ai_image_generate_node(context, node, edges, outputs_by_node),
        "output.spritesheet" => {
            execute_output_spritesheet_node(context.project_root, node, edges, outputs_by_node)
        }
        "preview.image" => execute_preview_image_node(context.project_root, node, edges, outputs_by_node),
        "preview.actionSequence" => {
            execute_action_sequence_preview_node(node, edges, outputs_by_node)
        }
        "output.asset" => Ok(
            resolve_pass_through_output(&node.id, edges, outputs_by_node)
                .unwrap_or_else(|| json!({})),
        ),
        "character.inputSeed"
        | "character.styleProfile"
        | "character.outfitProfile"
        | "ai.negativePrompt"
        |         "logic.promptMerge"
        | "logic.promptCompiler"
        | "character.create"
        | "character.generatePlan"
        | "character.generateCandidates"
        | "character.generateViews"
        | "character.removeBackground"
        | "character.normalize"
        | "character.analyze"
        | "character.generateActionFrames"
        | "output.spriteSplit"
        | "output.atlasPack"
        | "output.animationExport"
        | "output.godotSpriteFrames" => {
            character_nodes::execute_character_domain_node(context, node, edges, outputs_by_node)
        }
        "control.consistencyLock" | "control.referenceStrength" | "control.seedLock" => {
            control_nodes::execute_control_domain_node(node, edges, outputs_by_node)
        }
        // 人工节点由运行时拦截处理（暂停/恢复）；此处兜底透传，避免恢复后缓存命中时报错。
        "control.manualGate" => Ok(
            resolve_pass_through_output(&node.id, edges, outputs_by_node)
                .unwrap_or_else(|| json!({})),
        ),
        _ => Err("节点类型暂不支持执行。".to_string()),
    }
}

fn execute_image_input_node(
    project_root: &Path,
    node: &WorkflowNodeInput,
) -> Result<Value, String> {
    let path = node
        .params
        .get("path")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    let kind = node
        .params
        .get("sourceKind")
        .and_then(Value::as_str)
        .unwrap_or("projectRelativePath");

    if path.is_empty() {
        return Err("图片输入节点缺少图片路径。".to_string());
    }

    let image_path = resolve_source_path(project_root, kind, path)?;
    Ok(json!({
        "image": {
            "kind": kind,
            "path": path,
            "absolutePath": image_path.to_string_lossy(),
        }
    }))
}

fn execute_background_removal_node(
    context: &mut ExecutorContext<'_>,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    context.report_progress(10);
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let image = inputs
        .get("input")
        .or_else(|| inputs.get("image"))
        .or_else(|| inputs.pointer("/toolResult/outputImage"))
        .ok_or_else(|| "去背景节点缺少上游图片输入。".to_string())?;
    let kind = image
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or("projectRelativePath");
    let path = image
        .get("path")
        .or_else(|| image.get("projectRelativePath"))
        .and_then(Value::as_str)
        .ok_or_else(|| "去背景节点缺少上游图片路径。".to_string())?;
    let source_path = resolve_source_path(context.project_root, kind, path)?;
    context.report_progress(25);
    let options = serde_json::from_value::<BackgroundRemovalToolOptionsInput>(node.params.clone())
        .unwrap_or_default();
    context.report_progress(40);
    context.check_canceled()?;
    let result = run_background_removal_asset_tool(context.project_root, &source_path, options)?;
    context.report_progress(85);

    Ok(json!({
        "image": {
            "kind": "projectRelativePath",
            "path": result.output_image.project_relative_path,
            "absolutePath": result.output_image.absolute_path,
            "width": result.output_image.width,
            "height": result.output_image.height
        },
        "toolResult": serialize_asset_tool_result(&result)?
    }))
}

fn execute_character_load_node(
    project_root: &Path,
    node: &WorkflowNodeInput,
) -> Result<Value, String> {
    let character_id = node
        .params
        .get("characterId")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();

    if character_id.is_empty() {
        return Err("角色读取节点缺少角色 ID。".to_string());
    }

    let record = get_character_asset(
        project_root.to_string_lossy().to_string(),
        character_id.to_string(),
    )?;
    Ok(json!({ "character": record }))
}

fn execute_character_bind_tool_result_node(
    project_root: &Path,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let tool_result = inputs
        .get("toolResult")
        .ok_or_else(|| "角色绑定节点缺少上游工具输出。".to_string())?;
    let output_image = tool_result
        .get("outputImage")
        .ok_or_else(|| "角色绑定节点缺少输出图片。".to_string())?;
    let mut character_id = node
        .params
        .get("characterId")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();

    if character_id.is_empty() {
        character_id = inputs
            .get("character")
            .and_then(|value| value.get("id"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim()
            .to_string();
    }

    if character_id.is_empty() {
        return Err("角色绑定节点缺少角色 ID。".to_string());
    }

    let bbox = tool_result.get("bbox").and_then(|value| {
        Some(BoundingBox {
            height: value.get("height")?.as_u64()? as u32,
            width: value.get("width")?.as_u64()? as u32,
            x: value.get("x")?.as_u64()? as u32,
            y: value.get("y")?.as_u64()? as u32,
        })
    });
    let record = bind_character_tool_result(BindCharacterToolResultInput {
        bbox,
        character_id: character_id.clone(),
        output_image: CharacterToolResultImageInput {
            absolute_path: string_field(output_image, "absolutePath")?,
            data_url: string_field(output_image, "dataUrl")?,
            height: u32_field(output_image, "height")?,
            project_relative_path: string_field(output_image, "projectRelativePath")?,
            width: u32_field(output_image, "width")?,
        },
        project_root: project_root.to_string_lossy().to_string(),
        score: tool_result
            .get("score")
            .and_then(Value::as_u64)
            .map(|value| value as u16),
        view_id: node
            .params
            .get("viewId")
            .and_then(Value::as_str)
            .map(str::to_string),
        warnings: tool_result
            .get("warnings")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default(),
    })?;

    Ok(json!({ "character": record }))
}

fn execute_ai_prompt_node(
    context: &ExecutorContext<'_>,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let prompt = node
        .params
        .get("prompt")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| inputs.get("prompt").and_then(extract_prompt_text))
        .unwrap_or_default();

    if prompt.is_empty() {
        return Err("AI 提示词节点缺少 prompt。".to_string());
    }

    let negative_prompt = node
        .params
        .get("negativePrompt")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| inputs.get("prompt").map(extract_negative_prompt_text))
        .unwrap_or_default();

    if node.params.get("enhance").and_then(Value::as_bool) == Some(true) {
        let app = context
            .app
            .ok_or_else(|| "AI 提示词增强需要应用上下文。".to_string())?;
        context.check_canceled()?;
        let result = crate::commands::ai_generation::generate_ai_text_blocking(
            app.clone(),
            crate::commands::ai_generation::AiTextGenerationRequest {
                provider_id: node.params.get("providerId").and_then(Value::as_str).map(str::to_string),
                model: node.params.get("model").and_then(Value::as_str).map(str::to_string),
                system_prompt: Some("你是游戏资产提示词工程师，请输出简洁的中文图像生成提示词。".to_string()),
                prompt: format!("请优化以下图像生成提示词，只返回优化后的提示词正文：{prompt}"),
                task_id: None,
                temperature: Some(0.4),
                max_tokens: Some(512),
            },
        )?;

        return Ok(json!({
            "prompt": {
                "text": result.content.trim(),
                "negativePrompt": negative_prompt,
            }
        }));
    }

    Ok(json!({
        "prompt": {
            "text": prompt,
            "negativePrompt": negative_prompt,
        }
    }))
}

fn execute_ai_image_generate_node(
    context: &mut ExecutorContext<'_>,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let app = context
        .app
        .ok_or_else(|| "AI 生图节点需要应用上下文。".to_string())?
        .clone();
    context.report_progress(15);
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let prompt_text = node
        .params
        .get("prompt")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| inputs.get("prompt").and_then(extract_prompt_text))
        .or_else(|| inputs.get("promptBundle").and_then(extract_prompt_text))
        .unwrap_or_default();

    if prompt_text.is_empty() {
        return Err("AI 生图节点缺少提示词。".to_string());
    }

    context.report_progress(30);
    context.check_canceled()?;
    let image = crate::engine::executor::ai_image::generate_workflow_image(
        &app,
        context.project_root,
        &prompt_text,
        node.params
            .get("providerId")
            .and_then(Value::as_str)
            .map(str::to_string),
        node.params
            .get("model")
            .and_then(Value::as_str)
            .map(str::to_string),
        Some(context),
    )?;
    context.report_progress(92);

    Ok(json!({ "image": image }))
}

fn execute_output_spritesheet_node(
    project_root: &Path,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    use std::fs;

    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let image = inputs
        .get("input")
        .or_else(|| inputs.get("image"))
        .or_else(|| inputs.pointer("/toolResult/outputImage"))
        .ok_or_else(|| "精灵图导出节点缺少上游图片。".to_string())?;
    let source_kind = image
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or("projectRelativePath");
    let source_path_value = image
        .get("path")
        .or_else(|| image.get("projectRelativePath"))
        .and_then(Value::as_str)
        .ok_or_else(|| "精灵图导出节点缺少图片路径。".to_string())?;
    let source_path = resolve_source_path(project_root, source_kind, source_path_value)?;
    let export_name = node
        .params
        .get("fileName")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("spritesheet");
    let export_dir = project_root.join("exports").join("workflows");
    fs::create_dir_all(&export_dir)
        .map_err(|error| format!("创建导出目录失败：{error}"))?;
    let png_path = export_dir.join(format!("{export_name}.png"));
    let json_path = export_dir.join(format!("{export_name}.json"));
    fs::copy(&source_path, &png_path).map_err(|error| format!("复制导出图片失败：{error}"))?;
    let width = image.get("width").and_then(Value::as_u64).unwrap_or(0);
    let height = image.get("height").and_then(Value::as_u64).unwrap_or(0);
    let manifest = json!({
        "frames": {
            export_name: {
                "frame": { "x": 0, "y": 0, "w": width, "h": height },
                "sourceSize": { "w": width, "h": height }
            }
        },
        "meta": {
            "image": format!("{export_name}.png"),
            "size": { "w": width, "h": height }
        }
    });
    fs::write(
        &json_path,
        serde_json::to_string_pretty(&manifest)
            .map_err(|error| format!("序列化导出 JSON 失败：{error}"))?,
    )
    .map_err(|error| format!("写入导出 JSON 失败：{error}"))?;

    let project_relative_png = png_path
        .strip_prefix(project_root)
        .map(|path| path.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| png_path.to_string_lossy().replace('\\', "/"));

    Ok(json!({
        "asset": {
            "kind": "spritesheet",
            "path": project_relative_png,
            "absolutePath": png_path.to_string_lossy(),
            "manifestPath": json_path.to_string_lossy(),
        },
        "image": {
            "kind": "projectRelativePath",
            "path": project_relative_png,
            "absolutePath": png_path.to_string_lossy(),
            "width": width,
            "height": height
        }
    }))
}

fn execute_preview_image_node(
    _project_root: &Path,
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    if let Some(character) = inputs.get("character") {
        let record = serde_json::from_value::<CharacterAssetRecord>(character.clone())
            .map_err(|error| format!("解析角色输入失败：{error}"))?;
        if let Some(image) = character_record_preview_image_output(&record, true) {
            return Ok(json!({ "image": image, "output": image }));
        }
        return Err("角色缺少可预览图片。".to_string());
    }

    Ok(
        resolve_pass_through_output(&node.id, edges, outputs_by_node)
            .unwrap_or_else(|| json!({})),
    )
}

fn execute_action_sequence_preview_node(
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    if let Some(character) = inputs.get("character") {
        return Ok(json!({ "character": character.clone() }));
    }

    Ok(
        resolve_pass_through_output(&node.id, edges, outputs_by_node)
            .unwrap_or_else(|| json!({})),
    )
}

pub(crate) fn resolve_source_path(project_root: &Path, kind: &str, path: &str) -> Result<std::path::PathBuf, String> {
    let candidate_path = match kind {
        "absolutePath" => std::path::PathBuf::from(path),
        "projectRelativePath" => project_root.join(path),
        _ => return Err("图片路径类型不受支持。".to_string()),
    };

    if !candidate_path.is_file() {
        return Err("图片文件不存在。".to_string());
    }

    candidate_path
        .canonicalize()
        .map_err(|error| format!("解析图片路径失败：{error}"))
}

fn serialize_asset_tool_result(result: &AssetToolResult) -> Result<Value, String> {
    serde_json::to_value(result).map_err(|error| format!("序列化工具结果失败：{error}"))
}

fn string_field(value: &Value, field: &str) -> Result<String, String> {
    value
        .get(field)
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| format!("工具输出缺少字段：{field}"))
}

fn u32_field(value: &Value, field: &str) -> Result<u32, String> {
    value
        .get(field)
        .and_then(Value::as_u64)
        .map(|number| number as u32)
        .ok_or_else(|| format!("工具输出缺少字段：{field}"))
}

pub mod ai_image;
mod character_nodes;
mod control_nodes;

use crate::engine::workflow_assets::{extract_negative_prompt_text, extract_prompt_text};
