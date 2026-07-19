use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Manager};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundRemovalRuntimeStatus {
    available: bool,
    command: String,
    detail: String,
    version: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestBackgroundRemovalRuntimeInput {
    #[serde(default)]
    executable_path: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundRemovalModelStatus {
    description: String,
    id: String,
    installed: bool,
    label: String,
    path: String,
    recommended: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WarmupBackgroundRemovalModelInput {
    #[serde(default)]
    executable_path: String,
    #[serde(default = "default_background_removal_model")]
    model: String,
    #[serde(default)]
    model_path: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WarmupBackgroundRemovalModelResult {
    model: String,
    model_path: String,
    message: String,
    runtime: BackgroundRemovalRuntimeStatus,
}

#[derive(Clone)]
pub struct RembgRemovalOptions {
    pub alpha_matting: bool,
    pub custom_model_path: String,
    pub executable_path: String,
    pub model: String,
}

const REMBG_COMMAND: &str = "rembg";

#[tauri::command]
pub fn test_background_removal_runtime(
    input: TestBackgroundRemovalRuntimeInput,
) -> BackgroundRemovalRuntimeStatus {
    detect_rembg_runtime(input.executable_path.trim())
}

#[tauri::command]
pub fn list_background_removal_models(
    app: AppHandle,
) -> Result<Vec<BackgroundRemovalModelStatus>, String> {
    let model_directory = rembg_model_directory(&app)?;

    Ok(known_rembg_models()
        .into_iter()
        .map(|model| {
            let model_path = model_directory.join(format!("{}.onnx", model.id));

            BackgroundRemovalModelStatus {
                description: model.description.to_string(),
                id: model.id.to_string(),
                installed: model_path.is_file(),
                label: model.label.to_string(),
                path: model_path.to_string_lossy().to_string(),
                recommended: model.recommended,
            }
        })
        .collect())
}

#[tauri::command]
pub fn warmup_background_removal_model(
    app: AppHandle,
    input: WarmupBackgroundRemovalModelInput,
) -> Result<WarmupBackgroundRemovalModelResult, String> {
    let model = normalize_rembg_model(&input.model)?;
    let custom_model_path = input.model_path.trim().to_string();
    let executable_path = input.executable_path.trim().to_string();
    let runtime = detect_rembg_runtime(&executable_path);

    if !runtime.available {
        return Err(format!(
            "未检测到 rembg 运行器。请先在本机 Python 环境安装 rembg 后重试：{}",
            runtime.detail
        ));
    }

    if model == "custom" && custom_model_path.is_empty() {
        return Err("自定义去背景模型需要先填写本地模型路径。".to_string());
    }

    let cache_directory = app
        .path()
        .app_cache_dir()
        .map(|path| path.join("background-removal"))
        .map_err(|error| format!("获取模型预热缓存目录失败：{error}"))?;

    fs::create_dir_all(&cache_directory)
        .map_err(|error| format!("创建模型预热缓存目录失败：{error}"))?;

    let input_path = cache_directory.join("rembg-warmup-input.png");
    let output_path = cache_directory.join("rembg-warmup-output.png");
    fs::write(&input_path, create_warmup_png()?)
        .map_err(|error| format!("写入模型预热图片失败：{error}"))?;

    run_rembg_remove(
        &input_path,
        &output_path,
        RembgRemovalOptions {
            alpha_matting: false,
            custom_model_path,
            executable_path,
            model: model.clone(),
        },
    )?;

    let model_directory = rembg_model_directory(&app)?;
    let model_path = if model == "custom" {
        input.model_path.trim().to_string()
    } else {
        model_directory
            .join(format!("{model}.onnx"))
            .to_string_lossy()
            .to_string()
    };

    Ok(WarmupBackgroundRemovalModelResult {
        model,
        model_path,
        message: "模型预热完成。若该模型未下载，rembg 已在预热过程中完成首次下载。".to_string(),
        runtime,
    })
}

pub fn run_rembg_remove(
    input_path: &Path,
    output_path: &Path,
    options: RembgRemovalOptions,
) -> Result<(), String> {
    if !input_path.is_file() {
        return Err("去背景源图不存在。".to_string());
    }

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建去背景输出目录失败：{error}"))?;
    }

    let model = normalize_rembg_model(&options.model)?;
    let executable = resolve_rembg_executable(&options.executable_path)?;
    let mut command = Command::new(&executable);

    command.arg("i");

    if options.alpha_matting {
        command.arg("-a");
    }

    if model == "custom" {
        let custom_model_path = options.custom_model_path.trim();

        if custom_model_path.is_empty() {
            return Err("自定义去背景模型需要提供本地模型路径。".to_string());
        }

        if !Path::new(custom_model_path).is_file() {
            return Err("自定义去背景模型文件不存在。".to_string());
        }

        let extra_args = serde_json::json!({ "model_path": custom_model_path });

        command
            .arg("-m")
            .arg("u2net_custom")
            .arg("-x")
            .arg(extra_args.to_string());
    } else {
        command.arg("-m").arg(model);
    }

    let output = command
        .arg(input_path)
        .arg(output_path)
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("启动 rembg 运行器失败：{error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };

        return Err(format!(
            "rembg 去背景失败：{}",
            if detail.is_empty() {
                "运行器没有返回错误详情。".to_string()
            } else {
                detail
            }
        ));
    }

    if !output_path.is_file() {
        return Err("rembg 已运行完成，但没有生成透明 PNG。".to_string());
    }

    Ok(())
}

fn detect_rembg_runtime(executable_path: &str) -> BackgroundRemovalRuntimeStatus {
    let executable = match resolve_rembg_executable(executable_path) {
        Ok(value) => value,
        Err(error) => {
            return BackgroundRemovalRuntimeStatus {
                available: false,
                command: executable_path.trim().to_string(),
                detail: error,
                version: String::new(),
            };
        }
    };

    match Command::new(&executable)
        .arg("--version")
        .stdin(Stdio::null())
        .output()
    {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let version = if stdout.is_empty() { stderr } else { stdout };

            BackgroundRemovalRuntimeStatus {
                available: true,
                command: executable.to_string_lossy().to_string(),
                detail: "已检测到 rembg 命令行运行器。".to_string(),
                version,
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

            BackgroundRemovalRuntimeStatus {
                available: false,
                command: executable.to_string_lossy().to_string(),
                detail: if stderr.is_empty() {
                    "rembg 命令存在，但版本检测失败。".to_string()
                } else {
                    stderr
                },
                version: String::new(),
            }
        }
        Err(error) => BackgroundRemovalRuntimeStatus {
            available: false,
            command: executable.to_string_lossy().to_string(),
            detail: format!("未找到 rembg 命令：{error}"),
            version: String::new(),
        },
    }
}

fn resolve_rembg_executable(executable_path: &str) -> Result<PathBuf, String> {
    let trimmed_path = executable_path.trim();

    if trimmed_path.is_empty() {
        return Ok(PathBuf::from(REMBG_COMMAND));
    }

    let path = PathBuf::from(trimmed_path);

    if !path.is_file() {
        return Err("rembg 运行器路径不存在或不是文件。".to_string());
    }

    Ok(path)
}

fn rembg_model_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let home_directory = app
        .path()
        .home_dir()
        .map_err(|error| format!("获取用户目录失败：{error}"))?;

    Ok(home_directory.join(".u2net"))
}

fn create_warmup_png() -> Result<Vec<u8>, String> {
    let mut image = RgbaImage::from_pixel(16, 16, Rgba([255, 255, 255, 255]));

    for y in 4..12 {
        for x in 4..12 {
            image.put_pixel(x, y, Rgba([36, 90, 180, 255]));
        }
    }

    let mut output = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image)
        .write_to(&mut output, ImageFormat::Png)
        .map_err(|error| format!("编码模型预热图片失败：{error}"))?;

    Ok(output.into_inner())
}

fn normalize_rembg_model(model: &str) -> Result<String, String> {
    let normalized_model = model.trim();

    if matches!(
        normalized_model,
        "isnet-general-use" | "birefnet-general-lite" | "birefnet-general" | "silueta" | "custom"
    ) {
        return Ok(normalized_model.to_string());
    }

    Err("去背景模型设置不受支持。".to_string())
}

fn default_background_removal_model() -> String {
    "isnet-general-use".to_string()
}

fn known_rembg_models() -> Vec<KnownRembgModel> {
    vec![
        KnownRembgModel {
            description: "通用前景分割，适合角色、物体和大多数游戏素材。",
            id: "isnet-general-use",
            label: "IS-Net 通用模型",
            recommended: true,
        },
        KnownRembgModel {
            description: "更轻量的 BiRefNet 方案，适合先做快速验证。",
            id: "birefnet-general-lite",
            label: "BiRefNet 轻量模型",
            recommended: false,
        },
        KnownRembgModel {
            description: "更高质量的 BiRefNet 通用方案，适合复杂边缘。",
            id: "birefnet-general",
            label: "BiRefNet 通用模型",
            recommended: false,
        },
        KnownRembgModel {
            description: "轻量模型，适合资源受限环境。",
            id: "silueta",
            label: "Silueta 轻量模型",
            recommended: false,
        },
    ]
}

struct KnownRembgModel {
    description: &'static str,
    id: &'static str,
    label: &'static str,
    recommended: bool,
}
