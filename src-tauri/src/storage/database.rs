use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

const DATABASE_FILE_NAME: &str = "jmtools.db";
const PROJECT_DATABASE_FILE_NAME: &str = "project.db";

pub fn open_app_database(app: &AppHandle) -> Result<Connection, String> {
    let database_path = app
        .path()
        .app_data_dir()
        .map(|path| path.join(DATABASE_FILE_NAME))
        .map_err(|error| format!("获取应用数据目录失败：{error}"))?;
    let parent = database_path
        .parent()
        .ok_or_else(|| "无法解析应用数据目录。".to_string())?;

    fs::create_dir_all(parent).map_err(|error| format!("创建应用数据目录失败：{error}"))?;

    Connection::open(database_path).map_err(|error| format!("打开本地数据库失败：{error}"))
}

pub fn open_project_database(project_root: &Path) -> Result<Connection, String> {
    let database_directory = project_root.join(".jmtools");
    let database_path: PathBuf = database_directory.join(PROJECT_DATABASE_FILE_NAME);

    fs::create_dir_all(&database_directory)
        .map_err(|error| format!("创建项目数据库目录失败：{error}"))?;

    Connection::open(database_path).map_err(|error| format!("打开项目数据库失败：{error}"))
}

pub fn ensure_app_settings_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );",
        )
        .map_err(|error| format!("初始化设置数据库失败：{error}"))
}

pub fn ensure_ai_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS ai_model_providers (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                provider_type TEXT NOT NULL,
                preset TEXT NOT NULL,
                api_base TEXT NOT NULL,
                api_key TEXT NOT NULL DEFAULT '',
                text_model TEXT NOT NULL DEFAULT '',
                image_model TEXT NOT NULL DEFAULT '',
                is_default INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ai_provider_models (
                id TEXT PRIMARY KEY NOT NULL,
                provider_id TEXT NOT NULL,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                model_kind TEXT NOT NULL,
                context_length INTEGER NOT NULL DEFAULT 0,
                max_output_tokens INTEGER NOT NULL DEFAULT 0,
                default_temperature REAL NOT NULL DEFAULT 0,
                default_width INTEGER NOT NULL DEFAULT 0,
                default_height INTEGER NOT NULL DEFAULT 0,
                is_enabled INTEGER NOT NULL DEFAULT 1,
                is_default INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                UNIQUE(provider_id, name)
            );",
        )
        .map_err(|error| format!("初始化 AI 数据库失败：{error}"))
}

pub fn ensure_project_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS project_profile (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS character_assets (
                id TEXT PRIMARY KEY NOT NULL,
                display_name TEXT NOT NULL,
                status TEXT NOT NULL,
                style TEXT NOT NULL,
                size TEXT NOT NULL,
                direction TEXT NOT NULL,
                project_relative_path TEXT NOT NULL,
                selected_plan_name TEXT NOT NULL,
                selected_plan_score INTEGER NOT NULL DEFAULT 0,
                provider_name TEXT NOT NULL DEFAULT '',
                model TEXT NOT NULL DEFAULT '',
                summary TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                visual_keywords_json TEXT NOT NULL DEFAULT '[]',
                palette_json TEXT NOT NULL DEFAULT '[]',
                record_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_character_assets_updated_at
                ON character_assets(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_character_assets_status
                ON character_assets(status);
            CREATE INDEX IF NOT EXISTS idx_character_assets_size
                ON character_assets(size);

            CREATE TABLE IF NOT EXISTS workflow_runs (
                id TEXT PRIMARY KEY NOT NULL,
                workflow_id TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at INTEGER NOT NULL,
                finished_at INTEGER,
                error TEXT NOT NULL DEFAULT '',
                run_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS workflow_node_runs (
                run_id TEXT NOT NULL,
                node_id TEXT NOT NULL,
                node_kind TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at INTEGER,
                finished_at INTEGER,
                error TEXT NOT NULL DEFAULT '',
                output_json TEXT NOT NULL DEFAULT '{}',
                PRIMARY KEY (run_id, node_id)
            );

            CREATE TABLE IF NOT EXISTS workflow_run_checkpoints (
                run_id TEXT PRIMARY KEY NOT NULL,
                workflow_id TEXT NOT NULL,
                awaiting_node_id TEXT NOT NULL,
                checkpoint_json TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id
                ON workflow_runs(workflow_id, started_at DESC);
            CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
                ON workflow_runs(status);",
        )
        .map_err(|error| format!("初始化项目数据库失败：{error}"))
}

pub fn current_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}
