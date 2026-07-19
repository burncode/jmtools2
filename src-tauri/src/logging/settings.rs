use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Arc;

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tracing::Level;

use crate::storage::database::{ensure_app_settings_schema, open_app_database};

const LOG_SETTINGS_KEY: &str = "app.log.settings";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogSettings {
    #[serde(default = "default_log_level")]
    pub log_level: String,
    #[serde(default = "default_true")]
    pub log_redact_prompts: bool,
}

impl Default for LogSettings {
    fn default() -> Self {
        Self {
            log_level: default_log_level(),
            log_redact_prompts: true,
        }
    }
}

pub struct LogSettingsState {
    pub redact_prompts: Arc<AtomicBool>,
    max_level: Arc<AtomicU8>,
}

use std::sync::atomic::AtomicBool;

impl LogSettingsState {
    pub fn from_settings(settings: &LogSettings) -> Self {
        Self {
            redact_prompts: Arc::new(AtomicBool::new(settings.log_redact_prompts)),
            max_level: Arc::new(AtomicU8::new(level_to_code(settings.log_level.as_str()))),
        }
    }

    pub fn should_redact_prompts(&self) -> bool {
        self.redact_prompts.load(Ordering::Relaxed)
    }

    pub fn set_redact_prompts(&self, enabled: bool) {
        self.redact_prompts.store(enabled, Ordering::Relaxed);
    }

    pub fn set_max_level(&self, level: &str) {
        self.max_level
            .store(level_to_code(level), Ordering::Relaxed);
    }

    pub fn max_level_handle(&self) -> Arc<AtomicU8> {
        Arc::clone(&self.max_level)
    }
}

pub fn load_log_settings(app: &AppHandle) -> Result<LogSettings, String> {
    let connection = open_app_database(app)?;
    ensure_app_settings_schema(&connection)?;

    let settings_json: Option<String> = connection
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![LOG_SETTINGS_KEY],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("读取日志设置失败：{error}"))?;

    match settings_json {
        Some(value) => {
            serde_json::from_str(&value).map_err(|error| format!("日志设置格式错误：{error}"))
        }
        None => Ok(LogSettings::default()),
    }
}

pub fn save_log_settings(app: &AppHandle, settings: &LogSettings) -> Result<LogSettings, String> {
    let normalized = normalize_log_settings(settings.clone());
    let connection = open_app_database(app)?;
    ensure_app_settings_schema(&connection)?;
    let payload = serde_json::to_string(&normalized)
        .map_err(|error| format!("序列化日志设置失败：{error}"))?;

    connection
        .execute(
            "INSERT INTO app_settings (key, value, updated_at)
             VALUES (?1, ?2, strftime('%s','now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![LOG_SETTINGS_KEY, payload],
        )
        .map_err(|error| format!("保存日志设置失败：{error}"))?;

    Ok(normalized)
}

pub fn env_filter_from_settings(settings: &LogSettings) -> String {
    let level = normalize_log_level(settings.log_level.as_str());
    format!("jmtools={level},jmtools_lib={level}")
}

pub fn level_to_code(level: &str) -> u8 {
    match normalize_log_level(level) {
        "error" => 1,
        "warn" => 2,
        "info" => 3,
        "debug" => 4,
        "trace" => 5,
        _ => 3,
    }
}

pub fn level_enabled(max_level_code: u8, level: &Level) -> bool {
    let current = match *level {
        Level::ERROR => 1,
        Level::WARN => 2,
        Level::INFO => 3,
        Level::DEBUG => 4,
        Level::TRACE => 5,
    };
    current <= max_level_code
}

fn normalize_log_settings(mut settings: LogSettings) -> LogSettings {
    settings.log_level = normalize_log_level(settings.log_level.as_str()).to_string();
    settings
}

fn normalize_log_level(level: &str) -> &'static str {
    match level.trim().to_lowercase().as_str() {
        "error" => "error",
        "warn" | "warning" => "warn",
        "debug" => "debug",
        "trace" => "trace",
        _ => "info",
    }
}

fn default_log_level() -> String {
    "info".to_string()
}

fn default_true() -> bool {
    true
}
