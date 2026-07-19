use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use super::project_character_generation::ProjectCharacterGenerationSettings;

const PROJECT_MANIFEST_FILE_NAME: &str = "jmproject.json";
const RECENT_PROJECTS_FILE_NAME: &str = "recent-projects.json";
const MAX_RECENT_PROJECTS: usize = 8;
const PROJECT_DIRECTORIES: [&str; 9] = [
    "project",
    "assets",
    "assets/images",
    "assets/sprites",
    "assets/tiles",
    "assets/audio",
    "generated",
    "exports",
    "cache",
];

fn default_template() -> String {
    "empty".to_string()
}

fn default_category() -> String {
    "other".to_string()
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineProject {
    version: u8,
    name: String,
    slug: String,
    #[serde(default = "default_category")]
    category: String,
    #[serde(default)]
    tags: Vec<String>,
    description: String,
    root_path: String,
    #[serde(default = "default_template")]
    template: String,
    #[serde(default)]
    cover_image: Option<String>,
    #[serde(default)]
    created_at: String,
    #[serde(default)]
    updated_at: String,
    #[serde(default)]
    assets: Vec<serde_json::Value>,
    #[serde(default)]
    generators: Vec<serde_json::Value>,
    #[serde(default)]
    export_targets: Vec<String>,
    #[serde(default)]
    character_generation: ProjectCharacterGenerationSettings,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    name: String,
    path: String,
    slug: String,
    #[serde(default = "default_category")]
    category: String,
    #[serde(default)]
    cover_image: Option<String>,
    #[serde(default = "default_template")]
    template: String,
    updated_at: String,
}

#[tauri::command]
pub fn open_project(app: AppHandle, project_path: String) -> Result<PipelineProject, String> {
    let path = PathBuf::from(project_path.trim());

    if project_path.trim().is_empty() {
        return Err("项目目录不能为空。".to_string());
    }

    if !path.exists() {
        return Err("项目目录不存在。".to_string());
    }

    if !path.is_dir() {
        return Err("请选择项目目录，而不是文件。".to_string());
    }

    let manifest_path = path.join(PROJECT_MANIFEST_FILE_NAME);

    if !manifest_path.exists() {
        return Err("未找到 jmproject.json，请选择有效的 JMTools 项目目录。".to_string());
    }

    let manifest_content =
        fs::read_to_string(&manifest_path).map_err(|error| format!("读取项目清单失败：{error}"))?;
    let mut manifest: PipelineProject = serde_json::from_str(&manifest_content)
        .map_err(|error| format!("项目清单格式错误：{error}"))?;

    if manifest.version != 1 {
        return Err(format!("不支持的项目版本：{}", manifest.version));
    }

    manifest.root_path = path.to_string_lossy().to_string();

    remember_project(&app, &manifest)?;

    Ok(manifest)
}

#[tauri::command]
pub fn list_recent_projects(app: AppHandle) -> Result<Vec<RecentProject>, String> {
    read_recent_projects(&app)
}

#[tauri::command]
pub fn create_project_manifest(name: String, root_path: String) -> Result<PipelineProject, String> {
    let slug = normalize_slug(&name);

    build_project_manifest(
        name,
        slug,
        root_path,
        "other".to_string(),
        Vec::new(),
        String::new(),
        "empty".to_string(),
        Vec::new(),
        None,
    )
}

#[tauri::command]
pub fn create_project(
    app: AppHandle,
    name: String,
    slug: String,
    category: String,
    tags: Vec<String>,
    description: String,
    root_path: String,
    cover_image_source: Option<String>,
) -> Result<PipelineProject, String> {
    let mut manifest = build_project_manifest(
        name,
        slug,
        root_path,
        category,
        tags,
        description,
        "empty".to_string(),
        Vec::new(),
        None,
    )?;
    let project_path = PathBuf::from(&manifest.root_path);

    if project_path.join(PROJECT_MANIFEST_FILE_NAME).exists() {
        return Err(
            "目标目录已经存在 jmproject.json，请选择一个空目录或更换项目标识。".to_string(),
        );
    }

    fs::create_dir_all(&project_path).map_err(|error| format!("创建项目目录失败：{error}"))?;

    for directory in PROJECT_DIRECTORIES {
        fs::create_dir_all(project_path.join(directory))
            .map_err(|error| format!("创建项目子目录失败：{directory}，{error}"))?;
    }

    manifest.cover_image = copy_cover_image(&project_path, cover_image_source)?;

    let manifest_path = project_path.join(PROJECT_MANIFEST_FILE_NAME);
    let temp_manifest_path = project_path.join("jmproject.json.tmp");
    let manifest_content = serde_json::to_string_pretty(&manifest)
        .map_err(|error| format!("序列化项目清单失败：{error}"))?;

    fs::write(&temp_manifest_path, manifest_content)
        .map_err(|error| format!("写入临时项目清单失败：{error}"))?;
    fs::rename(&temp_manifest_path, &manifest_path)
        .map_err(|error| format!("写入项目清单失败：{error}"))?;

    remember_project(&app, &manifest)?;

    Ok(manifest)
}

fn remember_project(app: &AppHandle, project: &PipelineProject) -> Result<(), String> {
    let mut recent_projects = read_recent_projects(app)?;
    let project_path = project.root_path.clone();

    recent_projects.retain(|recent_project| recent_project.path != project_path);
    recent_projects.insert(
        0,
        RecentProject {
            name: project.name.clone(),
            path: project.root_path.clone(),
            slug: project.slug.clone(),
            category: project.category.clone(),
            cover_image: project.cover_image.clone(),
            template: project.template.clone(),
            updated_at: current_timestamp(),
        },
    );
    recent_projects.truncate(MAX_RECENT_PROJECTS);

    write_recent_projects(app, &recent_projects)
}

fn read_recent_projects(app: &AppHandle) -> Result<Vec<RecentProject>, String> {
    let recent_path = recent_projects_path(app)?;

    if !recent_path.exists() {
        return Ok(Vec::new());
    }

    let content =
        fs::read_to_string(&recent_path).map_err(|error| format!("读取最近项目失败：{error}"))?;
    serde_json::from_str(&content).map_err(|error| format!("最近项目记录格式错误：{error}"))
}

fn write_recent_projects(app: &AppHandle, recent_projects: &[RecentProject]) -> Result<(), String> {
    let recent_path = recent_projects_path(app)?;
    let parent = recent_path
        .parent()
        .ok_or_else(|| "无法解析应用配置目录。".to_string())?;

    fs::create_dir_all(parent).map_err(|error| format!("创建应用配置目录失败：{error}"))?;

    let temp_path = recent_path.with_extension("json.tmp");
    let content = serde_json::to_string_pretty(recent_projects)
        .map_err(|error| format!("序列化最近项目失败：{error}"))?;

    fs::write(&temp_path, content).map_err(|error| format!("写入最近项目临时文件失败：{error}"))?;
    fs::rename(&temp_path, &recent_path).map_err(|error| format!("写入最近项目失败：{error}"))
}

fn recent_projects_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|path| path.join(RECENT_PROJECTS_FILE_NAME))
        .map_err(|error| format!("获取应用配置目录失败：{error}"))
}

fn current_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();

    seconds.to_string()
}

fn build_project_manifest(
    name: String,
    slug: String,
    root_path: String,
    category: String,
    tags: Vec<String>,
    description: String,
    template: String,
    export_targets: Vec<String>,
    cover_image: Option<String>,
) -> Result<PipelineProject, String> {
    let project_name = name.trim();
    let project_slug = slug.trim();
    let project_root = root_path.trim();
    let project_category = category.trim();

    if project_name.is_empty() {
        return Err("项目名称不能为空。".to_string());
    }

    if project_slug.is_empty() {
        return Err("项目标识不能为空。".to_string());
    }

    if !is_valid_slug(project_slug) {
        return Err("项目标识只能包含小写字母、数字、短横线和下划线。".to_string());
    }

    if project_root.is_empty() {
        return Err("项目目录不能为空。".to_string());
    }

    if project_category.is_empty() {
        return Err("项目分类不能为空。".to_string());
    }

    let project_path = PathBuf::from(project_root).join(project_slug);
    let timestamp = current_timestamp();

    Ok(PipelineProject {
        version: 1,
        name: project_name.to_string(),
        slug: project_slug.to_string(),
        category: project_category.to_string(),
        tags: normalize_tags(tags),
        description: description.trim().to_string(),
        root_path: project_path.to_string_lossy().to_string(),
        template,
        cover_image,
        created_at: timestamp.clone(),
        updated_at: timestamp,
        assets: Vec::new(),
        generators: Vec::new(),
        export_targets,
        character_generation: ProjectCharacterGenerationSettings::default(),
    })
}

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut normalized_tags = Vec::new();

    for tag in tags {
        let value = tag.trim();

        if !value.is_empty() && !normalized_tags.iter().any(|item| item == value) {
            normalized_tags.push(value.to_string());
        }
    }

    normalized_tags
}

fn copy_cover_image(
    project_path: &Path,
    cover_image_source: Option<String>,
) -> Result<Option<String>, String> {
    let Some(source) = cover_image_source else {
        return Ok(None);
    };

    let source_path = PathBuf::from(source.trim());

    if source.trim().is_empty() {
        return Ok(None);
    }

    if !source_path.exists() {
        return Err("封面图文件不存在。".to_string());
    }

    if !source_path.is_file() {
        return Err("封面图必须是图片文件。".to_string());
    }

    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| "封面图缺少文件扩展名。".to_string())?;

    if !matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "webp") {
        return Err("封面图仅支持 PNG、JPG、JPEG 或 WebP。".to_string());
    }

    let cover_directory = project_path.join("project");
    fs::create_dir_all(&cover_directory)
        .map_err(|error| format!("创建项目封面目录失败：{error}"))?;

    let cover_file_name = format!("cover.{extension}");
    let cover_path = cover_directory.join(&cover_file_name);

    fs::copy(&source_path, &cover_path).map_err(|error| format!("复制封面图失败：{error}"))?;

    Ok(Some(format!("project/{cover_file_name}")))
}

fn is_valid_slug(slug: &str) -> bool {
    slug.chars().all(|character| {
        character.is_ascii_lowercase()
            || character.is_ascii_digit()
            || character == '-'
            || character == '_'
    })
}

fn normalize_slug(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .filter_map(|character| {
            if character.is_ascii_lowercase()
                || character.is_ascii_digit()
                || character == '-'
                || character == '_'
            {
                Some(character)
            } else if character.is_whitespace() {
                Some('_')
            } else {
                None
            }
        })
        .collect()
}
