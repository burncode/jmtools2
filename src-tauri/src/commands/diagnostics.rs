use serde::Deserialize;
use tauri::{AppHandle};
use tauri_plugin_opener::OpenerExt;

use crate::logging::{
    apply_log_settings, export_log_entries, list_log_files, log_dir, load_log_settings,
    query_log_entries, LogQueryInput, LogQueryResult, LogSettings,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportLogEntriesInput {
    pub output_path: String,
    pub query: LogQueryInput,
}

#[tauri::command]
pub fn get_log_settings(app: AppHandle) -> Result<LogSettings, String> {
    load_log_settings(&app)
}

#[tauri::command]
pub fn set_log_settings(app: AppHandle, settings: LogSettings) -> Result<LogSettings, String> {
    apply_log_settings(&app, &settings)
}

#[tauri::command]
pub fn get_log_directory(app: AppHandle) -> Result<String, String> {
    Ok(log_dir(&app)?.display().to_string())
}

#[tauri::command]
pub fn list_log_files_command(app: AppHandle) -> Result<Vec<crate::logging::LogFileInfo>, String> {
    list_log_files(&log_dir(&app)?)
}

#[tauri::command]
pub fn query_log_entries_command(app: AppHandle, query: LogQueryInput) -> Result<LogQueryResult, String> {
    query_log_entries(&log_dir(&app)?, &query)
}

#[tauri::command]
pub fn export_log_entries_command(app: AppHandle, input: ExportLogEntriesInput) -> Result<usize, String> {
    let output_path = input.output_path.trim();
    if output_path.is_empty() {
        return Err("导出路径不能为空。".to_string());
    }

    export_log_entries(&log_dir(&app)?, &input.query, std::path::Path::new(output_path))
}

#[tauri::command]
pub fn open_log_directory(app: AppHandle) -> Result<(), String> {
    let directory = log_dir(&app)?;
    app.opener()
        .open_path(directory.display().to_string(), None::<&str>)
        .map_err(|error| format!("打开日志目录失败：{error}"))
}
