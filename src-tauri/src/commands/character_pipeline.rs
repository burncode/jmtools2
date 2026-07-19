use std::fs;
use std::path::{Path, PathBuf};

use image::{imageops, ImageFormat, RgbaImage};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::AppHandle;

use crate::character::{
    character_record_target_canvas, get_character_asset, validate_character_id, validate_project_root,
    workflow_analyze_character, workflow_generate_action_frames, workflow_normalize_character_view,
    ActionFrameGenerationOptions, CharacterAssetRecord, CharacterMasterPlanInput, CharacterWorkshopDraftInput,
};
use crate::commands::ai_generation::{generate_ai_text_blocking, AiTextGenerationRequest};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateCharacterMasterPlanInput {
    pub draft: CharacterWorkshopDraftInput,
    pub project_root: String,
    #[serde(default)]
    pub provider_id: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    pub task_id: String,
    #[serde(default)]
    pub compiled_prompt: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateCharacterMasterPlanResult {
    pub model: String,
    pub plan: CharacterMasterPlanInput,
    pub provider_id: String,
    pub provider_name: String,
    pub task_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateCharacterActionFramesInput {
    pub project_root: String,
    pub character_id: String,
    #[serde(default)]
    pub action_ids: Vec<String>,
    #[serde(default)]
    pub frame_count: Option<u16>,
    #[serde(default)]
    pub all_views: Option<bool>,
    #[serde(default)]
    pub preview_fps: Option<u16>,
    #[serde(default)]
    pub loop_mode: Option<String>,
    #[serde(default)]
    pub generation_mode: Option<String>,
    #[serde(default)]
    pub max_retries: Option<u16>,
    #[serde(default)]
    pub motion_prompt: Option<String>,
    #[serde(default)]
    pub reference_mode: Option<String>,
    #[serde(default)]
    pub reference_strength: Option<f64>,
    #[serde(default)]
    pub pose_reference_png: Option<Vec<u8>>,
    #[serde(default)]
    pub user_feedback: Option<String>,
    #[serde(default)]
    pub view_kind: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizeCharacterViewInput {
    pub project_root: String,
    pub character_id: String,
    #[serde(default)]
    pub view_id: Option<String>,
    #[serde(default)]
    pub target_width: Option<u32>,
    #[serde(default)]
    pub target_height: Option<u32>,
    #[serde(default)]
    pub scale_mode: Option<String>,
    #[serde(default)]
    pub palette_size: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeCharacterInput {
    pub project_root: String,
    pub character_id: String,
    #[serde(default)]
    pub view_id: Option<String>,
    #[serde(default)]
    pub min_alpha_coverage_pct: Option<f64>,
    #[serde(default)]
    pub max_bbox_ratio_pct: Option<f64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportCharacterAnimationInput {
    pub project_root: String,
    pub character_id: String,
    pub action_id: String,
    #[serde(default)]
    pub export_format: Option<String>,
    #[serde(default)]
    pub file_name: Option<String>,
    #[serde(default)]
    pub fps: Option<u16>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterExportAssetResult {
    pub absolute_path: String,
    pub kind: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manifest_path: Option<String>,
}

#[tauri::command]
pub async fn generate_character_master_plan(
    app: AppHandle,
    input: GenerateCharacterMasterPlanInput,
) -> Result<GenerateCharacterMasterPlanResult, String> {
    tauri::async_runtime::spawn_blocking(move || generate_character_master_plan_blocking(app, input))
        .await
        .map_err(|error| format!("角色母版方案生成任务执行失败：{error}"))?
}

fn generate_character_master_plan_blocking(
    app: AppHandle,
    input: GenerateCharacterMasterPlanInput,
) -> Result<GenerateCharacterMasterPlanResult, String> {
    let _project_root = validate_project_root(&input.project_root)?;
    let prompt = crate::character::build_workflow_master_plan_prompt(
        &input.draft,
        &input.task_id,
        input.compiled_prompt.as_deref(),
    );
    let ai_result = generate_ai_text_blocking(
        app,
        AiTextGenerationRequest {
            max_tokens: Some(1800),
            model: input.model,
            prompt,
            provider_id: input.provider_id,
            system_prompt: Some(
                "你是 JMTools 的游戏资产生成流水线助手，擅长像素角色设计、动画拆解和独立游戏资源规范。必须输出可解析 JSON，不要输出 Markdown 说明。".to_string(),
            ),
            task_id: Some(input.task_id.clone()),
            temperature: Some(0.45),
        },
    )?;

    let plan = crate::character::parse_workflow_master_plan(&ai_result.content, &input.draft)?;

    Ok(GenerateCharacterMasterPlanResult {
        model: ai_result.model,
        plan,
        provider_id: ai_result.provider_id,
        provider_name: ai_result.provider_name,
        task_id: input.task_id,
    })
}

#[tauri::command]
pub async fn generate_character_action_frames(
    app: AppHandle,
    input: GenerateCharacterActionFramesInput,
) -> Result<CharacterAssetRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let project_root = validate_project_root(&input.project_root)?;
        let character_id = validate_character_id(&input.character_id)?;
        workflow_generate_action_frames(
            &app,
            &project_root,
            character_id,
            input.action_ids,
            input.frame_count.unwrap_or(4),
            input.all_views.unwrap_or(false),
            input.view_kind,
            input.preview_fps.unwrap_or(12),
            input.loop_mode.as_deref().unwrap_or("loop"),
            ActionFrameGenerationOptions {
                generation_mode: input.generation_mode,
                max_retries: input.max_retries,
                motion_prompt: input.motion_prompt,
                reference_mode: input.reference_mode,
                pose_reference_png: input.pose_reference_png,
                reference_strength: input.reference_strength,
                user_feedback: input.user_feedback,
            },
        )
    })
    .await
    .map_err(|error| format!("角色动作帧生成任务执行失败：{error}"))?
}

#[tauri::command]
pub fn normalize_character_view(input: NormalizeCharacterViewInput) -> Result<CharacterAssetRecord, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;
    let record = get_character_asset(input.project_root.clone(), character_id.clone())?;
    let (width, height) = character_record_target_canvas(&record);
    workflow_normalize_character_view(
        &project_root,
        &character_id,
        input.view_id.as_deref(),
        input.target_width.unwrap_or(width),
        input.target_height.unwrap_or(height),
        input.scale_mode.as_deref().unwrap_or("fitFootLine"),
        input.palette_size.unwrap_or(0),
    )
}

#[tauri::command]
pub fn analyze_character(input: AnalyzeCharacterInput) -> Result<CharacterAssetRecord, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;
    workflow_analyze_character(
        &project_root,
        character_id,
        input.view_id,
        input.min_alpha_coverage_pct.unwrap_or(6.0),
        input.max_bbox_ratio_pct.unwrap_or(85.0),
    )
}

#[tauri::command]
pub fn export_character_animation(
    input: ExportCharacterAnimationInput,
) -> Result<CharacterExportAssetResult, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let character_id = validate_character_id(&input.character_id)?;
    let action_id = input.action_id.trim().to_string();
    if action_id.is_empty() {
        return Err("导出动作 ID 不能为空。".to_string());
    }

    let record = get_character_asset(input.project_root.clone(), character_id.clone())?;
    let record_value = serde_json::to_value(&record).map_err(|error| format!("序列化角色记录失败：{error}"))?;
    let frames = collect_export_frames(&project_root, &record_value, &action_id)?;
    let export_format = input
        .export_format
        .as_deref()
        .unwrap_or("png")
        .trim()
        .to_ascii_lowercase();
    let file_name = input
        .file_name
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(&action_id)
        .trim()
        .to_string();
    let fps = input.fps.unwrap_or(12).max(1);

    match export_format.as_str() {
        "png" => export_png_sequence(&project_root, &character_id, &action_id, &file_name, &frames),
        "json" => export_animation_json(&project_root, &action_id, &file_name, fps, &frames),
        "godot" => export_godot_sprite_frames(&project_root, &action_id, &file_name, fps, &frames),
        "aseprite" => export_aseprite_bundle(&project_root, &character_id, &action_id, &file_name, fps, &frames),
        "manifest" => export_engine_manifest_bundle(
            &project_root,
            &character_id,
            &action_id,
            &file_name,
            fps,
            &frames,
        ),
        "spritesheet" => Err("Spritesheet 导出请在工作流节点中使用 atlasPack，或后续版本接入。".to_string()),
        other => Err(format!("不支持的导出格式：{other}")),
    }
}

fn collect_export_frames(
    project_root: &Path,
    character: &Value,
    action_id: &str,
) -> Result<Vec<Value>, String> {
    let actions = character
        .get("actions")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("角色缺少动作「{action_id}」。"))?;
    let action = actions
        .iter()
        .find(|item| item.get("id").and_then(Value::as_str) == Some(action_id))
        .ok_or_else(|| format!("找不到动作「{action_id}」。"))?;
    let frames = action
        .get("frames")
        .and_then(Value::as_array)
        .filter(|items| !items.is_empty())
        .ok_or_else(|| format!("动作「{action_id}」没有可用帧，请先生成动作。"))?;

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
            let absolute_path = project_root.join(path.replace('/', std::path::MAIN_SEPARATOR_STR));
            Some(json!({
                "absolutePath": absolute_path.to_string_lossy(),
                "index": frame.get("index").cloned().unwrap_or(json!(index)),
                "path": path,
            }))
        })
        .collect::<Vec<_>>();

    if items.is_empty() {
        return Err(format!("动作「{action_id}」没有可导出的帧路径。"));
    }

    Ok(items)
}

fn export_png_sequence(
    project_root: &Path,
    character_id: &str,
    action_id: &str,
    file_name: &str,
    frames: &[Value],
) -> Result<CharacterExportAssetResult, String> {
    let export_dir = project_root
        .join("exports")
        .join("characters")
        .join(character_id)
        .join(action_id);
    fs::create_dir_all(&export_dir).map_err(|error| format!("创建 PNG 导出目录失败：{error}"))?;

    for frame in frames {
        let source_path = frame
            .get("absolutePath")
            .and_then(Value::as_str)
            .ok_or_else(|| "导出帧缺少绝对路径。".to_string())?;
        let index = frame.get("index").and_then(Value::as_u64).unwrap_or(0);
        let target_path = export_dir.join(format!("{file_name}_{index:02}.png"));
        fs::copy(source_path, &target_path).map_err(|error| format!("复制帧 PNG 失败：{error}"))?;
    }

    let project_relative_path = export_dir
        .strip_prefix(project_root)
        .map(|value| value.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| export_dir.to_string_lossy().replace('\\', "/"));

    Ok(CharacterExportAssetResult {
        absolute_path: export_dir.to_string_lossy().to_string(),
        kind: "pngSequence".to_string(),
        path: project_relative_path,
        manifest_path: None,
    })
}

fn export_animation_json(
    project_root: &Path,
    action_id: &str,
    file_name: &str,
    fps: u16,
    frames: &[Value],
) -> Result<CharacterExportAssetResult, String> {
    let export_dir = project_root.join("exports").join("characters");
    fs::create_dir_all(&export_dir).map_err(|error| format!("创建导出目录失败：{error}"))?;
    let json_path = export_dir.join(format!("{file_name}.animation.json"));
    let manifest = json!({
        "animation": action_id,
        "engine": "generic",
        "fps": fps,
        "frames": frames,
    });
    fs::write(
        &json_path,
        serde_json::to_string_pretty(&manifest).map_err(|error| format!("序列化动画 JSON 失败：{error}"))?,
    )
    .map_err(|error| format!("写入动画 JSON 失败：{error}"))?;

    let project_relative_path = json_path
        .strip_prefix(project_root)
        .map(|value| value.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| json_path.to_string_lossy().replace('\\', "/"));

    Ok(CharacterExportAssetResult {
        absolute_path: json_path.to_string_lossy().to_string(),
        kind: "animationExport".to_string(),
        path: project_relative_path.clone(),
        manifest_path: Some(project_relative_path),
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizeCharacterDescriptionInput {
    pub class_or_occupation: String,
    pub description: String,
    pub entity_type: String,
    pub model: String,
    pub provider_id: String,
    pub role: String,
}

#[tauri::command]
pub async fn optimize_character_description(
    app: AppHandle,
    input: OptimizeCharacterDescriptionInput,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || optimize_character_description_blocking(app, input))
        .await
        .map_err(|error| format!("角色描述优化任务执行失败：{error}"))?
}

fn optimize_character_description_blocking(
    app: AppHandle,
    input: OptimizeCharacterDescriptionInput,
) -> Result<String, String> {
    let description = input.description.trim();
    if description.is_empty() {
        return Err("请先填写角色描述后再优化。".to_string());
    }

    let entity_type = input.entity_type.trim();
    let role = input.role.trim();
    let class_or_occupation = input.class_or_occupation.trim();
    let context = [
        if entity_type.is_empty() {
            None
        } else {
            Some(format!("实体类型：{entity_type}"))
        },
        if role.is_empty() {
            None
        } else {
            Some(format!("游戏职能：{role}"))
        },
        if class_or_occupation.is_empty() {
            None
        } else {
            Some(format!("职业/定位：{class_or_occupation}"))
        },
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join("；");

    let prompt = if context.is_empty() {
        format!("请优化以下像素游戏角色描述，保留关键视觉信息，补充轮廓与特征层次，总长度不超过 280 字：\n{description}")
    } else {
        format!(
            "请优化以下像素游戏角色描述。上下文：{context}。保留关键视觉信息，补充轮廓与特征层次，总长度不超过 280 字：\n{description}"
        )
    };

    let ai_result = generate_ai_text_blocking(
        app,
        AiTextGenerationRequest {
            max_tokens: Some(420),
            model: Some(input.model),
            prompt,
            provider_id: Some(input.provider_id),
            system_prompt: Some(
                "你是 JMTools 像素游戏角色设定助手。输出简洁中文描述，不要 Markdown，不要列表编号，不要解释过程。"
                    .to_string(),
            ),
            task_id: None,
            temperature: Some(0.55),
        },
    )?;

    let optimized = ai_result.content.trim();
    if optimized.is_empty() {
        return Err("AI 未返回有效描述，请检查文本模型配置。".to_string());
    }

    Ok(optimized.chars().take(300).collect())
}

fn export_godot_sprite_frames(
    project_root: &Path,
    action_id: &str,
    file_name: &str,
    fps: u16,
    frames: &[Value],
) -> Result<CharacterExportAssetResult, String> {
    let export_dir = project_root.join("exports").join("characters").join("godot");
    fs::create_dir_all(&export_dir).map_err(|error| format!("创建 Godot 导出目录失败：{error}"))?;
    let tres_path = export_dir.join(format!("{file_name}.tres"));
    let frame_lines = frames
        .iter()
        .enumerate()
        .map(|(index, _frame)| format!("SubResource(\"AtlasTexture_{index}\") # duration 1.0 / {fps}.0"))
        .collect::<Vec<_>>()
        .join(",\n");
    let tres_content = format!(
        "[gd_resource type=\"SpriteFrames\" format=3]\n\n[resource]\nanimations = [{{\n\"frames\": [{frame_lines}],\n\"loop\": true,\n\"name\": \"{action_id}\",\n\"speed\": {fps}.0\n}}]\n"
    );
    fs::write(&tres_path, tres_content).map_err(|error| format!("写入 Godot .tres 失败：{error}"))?;

    let project_relative_path = tres_path
        .strip_prefix(project_root)
        .map(|value| value.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| tres_path.to_string_lossy().replace('\\', "/"));

    Ok(CharacterExportAssetResult {
        absolute_path: tres_path.to_string_lossy().to_string(),
        kind: "godotSpriteFrames".to_string(),
        path: project_relative_path,
        manifest_path: None,
    })
}

fn export_aseprite_bundle(
    project_root: &Path,
    character_id: &str,
    action_id: &str,
    file_name: &str,
    fps: u16,
    frames: &[Value],
) -> Result<CharacterExportAssetResult, String> {
    let export_dir = project_root
        .join("exports")
        .join("characters")
        .join(character_id)
        .join(action_id);
    fs::create_dir_all(&export_dir).map_err(|error| format!("创建 Aseprite 导出目录失败：{error}"))?;

    let loaded = load_export_frame_images(frames)?;
    let (sheet, frame_meta) = build_horizontal_spritesheet(&loaded)?;
    let sheet_path = export_dir.join("sprite-sheet.png");
    sheet
        .save_with_format(&sheet_path, ImageFormat::Png)
        .map_err(|error| format!("写入 sprite-sheet.png 失败：{error}"))?;

    let frame_duration_ms = 1000_u64 / u64::from(fps.max(1));
    let mut aseprite_frames = serde_json::Map::new();
    for meta in &frame_meta {
        aseprite_frames.insert(
            format!("{file_name}_{}", meta.index),
            json!({
                "frame": {
                    "h": meta.height,
                    "w": meta.width,
                    "x": meta.x,
                    "y": meta.y,
                },
                "duration": frame_duration_ms,
            }),
        );
    }

    let aseprite_json = json!({
        "frames": aseprite_frames,
        "meta": {
            "format": "RGBA8888",
            "image": "sprite-sheet.png",
            "scale": "1",
            "size": {
                "h": sheet.height(),
                "w": sheet.width(),
            },
        },
    });
    let json_path = export_dir.join("sprite-sheet.json");
    fs::write(
        &json_path,
        serde_json::to_string_pretty(&aseprite_json)
            .map_err(|error| format!("序列化 Aseprite JSON 失败：{error}"))?,
    )
    .map_err(|error| format!("写入 sprite-sheet.json 失败：{error}"))?;

    let project_relative_path = export_dir
        .strip_prefix(project_root)
        .map(|value| value.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| export_dir.to_string_lossy().replace('\\', "/"));

    Ok(CharacterExportAssetResult {
        absolute_path: export_dir.to_string_lossy().to_string(),
        kind: "asepriteSpriteSheet".to_string(),
        path: project_relative_path.clone(),
        manifest_path: Some(format!("{project_relative_path}/sprite-sheet.json")),
    })
}

fn export_engine_manifest_bundle(
    project_root: &Path,
    character_id: &str,
    action_id: &str,
    file_name: &str,
    fps: u16,
    frames: &[Value],
) -> Result<CharacterExportAssetResult, String> {
    let export_dir = project_root
        .join("exports")
        .join("characters")
        .join(character_id)
        .join(action_id);
    fs::create_dir_all(&export_dir).map_err(|error| format!("创建 manifest 导出目录失败：{error}"))?;
    let frames_dir = export_dir.join("frames").join(action_id);
    fs::create_dir_all(&frames_dir).map_err(|error| format!("创建 frames 目录失败：{error}"))?;

    let loaded = load_export_frame_images(frames)?;
    let (sheet, frame_meta) = build_horizontal_spritesheet(&loaded)?;
    let sheet_path = export_dir.join("sprite-sheet.png");
    sheet
        .save_with_format(&sheet_path, ImageFormat::Png)
        .map_err(|error| format!("写入 sprite-sheet.png 失败：{error}"))?;

    let mut manifest_frames = Vec::new();
    for meta in &frame_meta {
        let source = &loaded[meta.index as usize];
        let target_path = frames_dir.join(format!("{file_name}_{:02}.png", meta.index));
        fs::copy(&source.absolute_path, &target_path)
            .map_err(|error| format!("复制帧 PNG 失败：{error}"))?;
        manifest_frames.push(json!({
            "durationMs": 1000_u64 / u64::from(fps.max(1)),
            "file": format!("frames/{action_id}/{file_name}_{:02}.png", meta.index),
            "index": meta.index,
            "trim": {
                "h": meta.height,
                "w": meta.width,
                "x": meta.x,
                "y": meta.y,
            },
        }));
    }

    let gif_path = export_dir.join("gif").join(format!("{action_id}.gif"));
    if let Some(parent) = gif_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建 gif 目录失败：{error}"))?;
    }
    let _ = write_preview_gif(&loaded, &gif_path, fps);

    let manifest = json!({
        "actionId": action_id,
        "characterId": character_id,
        "engine": "generic",
        "footPivot": { "x": 0.5, "y": 1.0 },
        "fps": fps,
        "loop": true,
        "previewGif": format!("gif/{action_id}.gif"),
        "spriteSheet": "sprite-sheet.png",
        "spriteSheetJson": "sprite-sheet.json",
        "states": [{
            "frames": manifest_frames,
            "id": action_id,
            "loop": true,
        }],
    });
    let manifest_path = export_dir.join("manifest.json");
    fs::write(
        &manifest_path,
        serde_json::to_string_pretty(&manifest)
            .map_err(|error| format!("序列化 manifest.json 失败：{error}"))?,
    )
    .map_err(|error| format!("写入 manifest.json 失败：{error}"))?;

    export_aseprite_bundle(project_root, character_id, action_id, file_name, fps, frames)?;

    let project_relative_path = export_dir
        .strip_prefix(project_root)
        .map(|value| value.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| export_dir.to_string_lossy().replace('\\', "/"));

    Ok(CharacterExportAssetResult {
        absolute_path: export_dir.to_string_lossy().to_string(),
        kind: "engineManifestBundle".to_string(),
        path: project_relative_path.clone(),
        manifest_path: Some(format!("{project_relative_path}/manifest.json")),
    })
}

struct LoadedExportFrame {
    absolute_path: PathBuf,
    image: RgbaImage,
    index: u64,
}

struct SpritesheetFrameMeta {
    height: u32,
    index: u64,
    width: u32,
    x: u32,
    y: u32,
}

fn load_export_frame_images(frames: &[Value]) -> Result<Vec<LoadedExportFrame>, String> {
    let mut loaded = Vec::new();
    for frame in frames {
        let source_path = frame
            .get("absolutePath")
            .and_then(Value::as_str)
            .ok_or_else(|| "导出帧缺少绝对路径。".to_string())?;
        let index = frame.get("index").and_then(Value::as_u64).unwrap_or(loaded.len() as u64);
        let image = image::open(source_path)
            .map_err(|error| format!("读取导出帧失败：{error}"))?
            .to_rgba8();
        loaded.push(LoadedExportFrame {
            absolute_path: PathBuf::from(source_path),
            image,
            index,
        });
    }
    loaded.sort_by_key(|item| item.index);
    Ok(loaded)
}

fn build_horizontal_spritesheet(frames: &[LoadedExportFrame]) -> Result<(RgbaImage, Vec<SpritesheetFrameMeta>), String> {
    if frames.is_empty() {
        return Err("没有可打包的帧。".to_string());
    }
    let frame_height = frames
        .iter()
        .map(|frame| frame.image.height())
        .max()
        .unwrap_or(1);
    let frame_width = frames
        .iter()
        .map(|frame| frame.image.width())
        .max()
        .unwrap_or(1);
    let sheet_width = frame_width.saturating_mul(frames.len() as u32);
    let mut sheet = RgbaImage::new(sheet_width.max(1), frame_height.max(1));
    let mut meta = Vec::with_capacity(frames.len());

    for (column, frame) in frames.iter().enumerate() {
        let x = frame_width.saturating_mul(column as u32);
        imageops::overlay(&mut sheet, &frame.image, i64::from(x), 0);
        meta.push(SpritesheetFrameMeta {
            height: frame.image.height(),
            index: frame.index,
            width: frame.image.width(),
            x,
            y: 0,
        });
    }

    Ok((sheet, meta))
}

fn write_preview_gif(frames: &[LoadedExportFrame], output_path: &Path, fps: u16) -> Result<(), String> {
    use image::codecs::gif::{GifEncoder, Repeat};
    use image::Delay;
    use std::fs::File;
    use std::io::BufWriter;

    if frames.is_empty() {
        return Ok(());
    }

    let delay = Delay::from_numer_denom_ms(1000, u32::from(fps.max(1)));
    let file = File::create(output_path).map_err(|error| format!("创建 GIF 失败：{error}"))?;
    let mut encoder = GifEncoder::new(BufWriter::new(file));
    encoder
        .set_repeat(Repeat::Infinite)
        .map_err(|error| format!("设置 GIF 循环失败：{error}"))?;

    for frame in frames {
        let gif_frame = image::Frame::from_parts(frame.image.clone(), 0, 0, delay);
        encoder
            .encode_frame(gif_frame)
            .map_err(|error| format!("写入 GIF 帧失败：{error}"))?;
    }

    Ok(())
}
