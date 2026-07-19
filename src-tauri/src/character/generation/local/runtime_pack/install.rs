use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::Instant;

use reqwest::blocking::Client;
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};
use tauri::AppHandle;
use tauri::Manager;
use zip::ZipArchive;

use crate::character::generation::local::activity::{
    clear_local_inference_activity, set_local_inference_activity_detailed, LocalInferencePhase,
};
use crate::character::generation::local::download_progress::{report_download_progress, reset_download_speed_sample};
use crate::storage::database::{ensure_app_settings_schema, open_app_database};

use super::manifest::{
    default_runtime_id, find_manifest_entry, recommended_runtime_id_for_hardware, runtimes_for_platform,
};
use super::types::{
    InstalledRuntimeRecord, LocalDiffusionRuntimeStatus, RuntimeInstallState, RuntimeManifestEntry,
};
use crate::character::generation::local::hardware_cache::{load_hardware_cache, resolve_hardware_profile};

const RUNTIME_STATE_KEY: &str = "local.inference.runtime_state";

pub fn local_runtimes_root(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("获取应用数据目录失败：{error}"))?;

    Ok(base.join("runtimes"))
}

pub fn diffusion_runtime_available(app: &AppHandle) -> bool {
    resolve_cli_executable(app).is_ok()
}

pub fn resolve_cli_executable(app: &AppHandle) -> Result<PathBuf, String> {
    let state = load_runtime_state(app)?;
    let runtime_id = preferred_runtime_id_from_state(&state);
    let record = state
        .records
        .iter()
        .find(|entry| entry.runtime_id == runtime_id)
        .ok_or_else(|| {
            "未安装生图 Runtime。请前往 设置 → 本地生图 → 生图 Runtime 下载扩展包。".to_string()
        })?;

    let executable = PathBuf::from(&record.executable_path);
    if executable.is_file() {
        return Ok(executable);
    }

    Err(format!(
        "Runtime 可执行文件缺失：{}。请重新下载。",
        record.executable_path
    ))
}

pub fn preferred_runtime_id(app: &AppHandle) -> Result<String, String> {
    let state = load_runtime_state(app)?;
    Ok(preferred_runtime_id_from_state(&state))
}

fn preferred_runtime_id_from_state(state: &RuntimeInstallState) -> String {
    if !state.active_runtime_id.trim().is_empty() {
        if state
            .records
            .iter()
            .any(|entry| entry.runtime_id == state.active_runtime_id)
        {
            return state.active_runtime_id.clone();
        }
    }

    state
        .records
        .first()
        .map(|entry| entry.runtime_id.clone())
        .or_else(default_runtime_id)
        .unwrap_or_else(|| "sd-cpp-vulkan-win-x64".to_string())
}

pub fn list_runtime_statuses(app: &AppHandle) -> Result<Vec<LocalDiffusionRuntimeStatus>, String> {
    let state = load_runtime_state(app)?;
    let active_id = preferred_runtime_id_from_state(&state);
    let entries = runtimes_for_platform()?;
    let recommended_id = resolve_recommended_runtime_id(app);

    Ok(entries
        .into_iter()
        .map(|entry| {
            build_runtime_status(
                &entry,
                &state,
                active_id.as_str(),
                recommended_id.as_deref(),
            )
        })
        .collect())
}

fn resolve_recommended_runtime_id(app: &AppHandle) -> Option<String> {
    let connection = open_app_database(app).ok()?;
    ensure_app_settings_schema(&connection).ok()?;
    if let Ok(cache) = load_hardware_cache(&connection) {
        if let Some(cached) = cache {
            return recommended_runtime_id_for_hardware(&cached.hardware);
        }
    }
    resolve_hardware_profile(&connection, false)
        .ok()
        .and_then(|resolved| recommended_runtime_id_for_hardware(&resolved.hardware))
}

fn build_runtime_status(
    entry: &RuntimeManifestEntry,
    state: &RuntimeInstallState,
    active_id: &str,
    recommended_id: Option<&str>,
) -> LocalDiffusionRuntimeStatus {
    let installed_record = state
        .records
        .iter()
        .find(|record| record.runtime_id == entry.id);

    let installed = installed_record.is_some();
    let installed_version = installed_record.map(|record| record.package_version.clone());
    let update_available = installed_record
        .map(|record| record.package_version != entry.package_version)
        .unwrap_or(false);

    LocalDiffusionRuntimeStatus {
        id: entry.id.clone(),
        label: entry.label.clone(),
        platform: entry.platform.clone(),
        channel: entry.channel.clone(),
        package_version: entry.package_version.clone(),
        download_url: entry.download_url.clone(),
        executable: entry.executable.clone(),
        description: entry.description.clone(),
        installed,
        installed_version,
        executable_path: installed_record.map(|record| record.executable_path.clone()),
        install_directory: installed_record.map(|record| record.install_directory.clone()),
        update_available,
        active: entry.id == active_id,
        recommended: recommended_id.is_some_and(|id| id == entry.id),
    }
}

pub fn download_runtime(app: &AppHandle, runtime_id: &str) -> Result<InstalledRuntimeRecord, String> {
    let manifest_entry = find_manifest_entry(runtime_id)?;
    let runtimes_root = local_runtimes_root(app)?;
    let cache_dir = runtimes_root.join(".cache");
    let install_dir = runtimes_root.join(runtime_id.trim());

    fs::create_dir_all(&cache_dir).map_err(|error| format!("创建 Runtime 缓存目录失败：{error}"))?;

    struct ClearGuard;
    impl Drop for ClearGuard {
        fn drop(&mut self) {
            clear_local_inference_activity();
        }
    }
    let _guard = ClearGuard;

    reset_download_speed_sample();
    let estimated_bytes = manifest_entry
        .estimated_size_mb
        .saturating_mul(1024 * 1024);

    set_local_inference_activity_detailed(
        LocalInferencePhase::Downloading,
        format!("正在下载生图 Runtime（{}）…", manifest_entry.label),
        None,
        Some(0),
        if estimated_bytes > 0 {
            Some(estimated_bytes)
        } else {
            None
        },
        Some("downloading".to_string()),
        None,
    );

    let zip_path = cache_dir.join(format!("{}.zip", manifest_entry.id));
    download_file(
        manifest_entry.download_url.as_str(),
        &zip_path,
        &manifest_entry.label,
        estimated_bytes,
    )?;

    if !manifest_entry.sha256.trim().is_empty() {
        set_local_inference_activity_detailed(
            LocalInferencePhase::Downloading,
            "正在校验 Runtime 包…".to_string(),
            None,
            None,
            None,
            Some("verifying".to_string()),
            None,
        );
        verify_sha256(&zip_path, manifest_entry.sha256.trim())?;
    }

    let record = install_runtime_from_zip(
        app,
        &manifest_entry,
        &zip_path,
        &install_dir,
    )?;

    let _ = fs::remove_file(&zip_path);
    Ok(record)
}

pub fn import_runtime_from_zip(
    app: &AppHandle,
    runtime_id: &str,
    zip_path: &str,
) -> Result<InstalledRuntimeRecord, String> {
    let manifest_entry = find_manifest_entry(runtime_id)?;
    let source = PathBuf::from(zip_path.trim());

    if !source.is_file() {
        return Err(format!("找不到 zip 文件：{}", source.display()));
    }

    if source
        .extension()
        .and_then(|ext| ext.to_str())
        .is_none_or(|ext| !ext.eq_ignore_ascii_case("zip"))
    {
        return Err("请选择 .zip 格式的 Runtime 压缩包。".to_string());
    }

    let runtimes_root = local_runtimes_root(app)?;
    let install_dir = runtimes_root.join(runtime_id.trim());

    struct ClearGuard;
    impl Drop for ClearGuard {
        fn drop(&mut self) {
            clear_local_inference_activity();
        }
    }
    let _guard = ClearGuard;

    set_local_inference_activity_detailed(
        LocalInferencePhase::Downloading,
        format!("正在从本地 zip 导入 Runtime（{}）…", manifest_entry.label),
        None,
        None,
        None,
        Some("extracting".to_string()),
        None,
    );

    install_runtime_from_zip(app, &manifest_entry, &source, &install_dir)
}

fn install_runtime_from_zip(
    app: &AppHandle,
    manifest_entry: &RuntimeManifestEntry,
    zip_path: &Path,
    install_dir: &Path,
) -> Result<InstalledRuntimeRecord, String> {
    if install_dir.exists() {
        fs::remove_dir_all(install_dir)
            .map_err(|error| format!("清理旧 Runtime 目录失败：{error}"))?;
    }
    fs::create_dir_all(install_dir).map_err(|error| format!("创建 Runtime 目录失败：{error}"))?;

    set_local_inference_activity_detailed(
        LocalInferencePhase::Downloading,
        format!("正在解压 Runtime（{}）…", manifest_entry.label),
        None,
        None,
        None,
        Some("extracting".to_string()),
        None,
    );
    extract_zip(zip_path, install_dir)?;

    let executable_path = find_executable(install_dir, manifest_entry.executable.as_str())?
        .to_string_lossy()
        .to_string();

    let record = InstalledRuntimeRecord {
        runtime_id: manifest_entry.id.clone(),
        package_version: manifest_entry.package_version.clone(),
        executable_path,
        install_directory: install_dir.to_string_lossy().to_string(),
        installed_at: crate::storage::database::current_timestamp() as i64,
    };

    let mut state = load_runtime_state(app)?;
    state
        .records
        .retain(|entry| entry.runtime_id != record.runtime_id);
    state.records.push(record.clone());
    if state.active_runtime_id.trim().is_empty() {
        state.active_runtime_id = record.runtime_id.clone();
    }
    save_runtime_state(app, &state)?;

    Ok(record)
}

pub fn remove_runtime(app: &AppHandle, runtime_id: &str) -> Result<(), String> {
    let normalized = runtime_id.trim();
    let mut state = load_runtime_state(app)?;
    let Some(record) = state
        .records
        .iter()
        .find(|entry| entry.runtime_id == normalized)
        .cloned()
    else {
        return Ok(());
    };

    let install_dir = PathBuf::from(&record.install_directory);
    if install_dir.exists() {
        fs::remove_dir_all(&install_dir)
            .map_err(|error| format!("删除 Runtime 目录失败：{error}"))?;
    }

    state.records.retain(|entry| entry.runtime_id != normalized);
    if state.active_runtime_id == normalized {
        state.active_runtime_id = state
            .records
            .first()
            .map(|entry| entry.runtime_id.clone())
            .unwrap_or_default();
    }
    save_runtime_state(app, &state)
}

pub fn set_active_runtime(app: &AppHandle, runtime_id: &str) -> Result<(), String> {
    let normalized = runtime_id.trim();
    let mut state = load_runtime_state(app)?;
    if !state
        .records
        .iter()
        .any(|entry| entry.runtime_id == normalized)
    {
        return Err(format!("Runtime 尚未安装：{normalized}"));
    }
    state.active_runtime_id = normalized.to_string();
    save_runtime_state(app, &state)
}

pub fn runtime_directory(app: &AppHandle) -> Result<String, String> {
    Ok(local_runtimes_root(app)?.to_string_lossy().to_string())
}

fn load_runtime_state(app: &AppHandle) -> Result<RuntimeInstallState, String> {
    let connection = open_app_database(app)?;
    ensure_app_settings_schema(&connection)?;
    load_runtime_state_from_connection(&connection)
}

fn load_runtime_state_from_connection(connection: &Connection) -> Result<RuntimeInstallState, String> {
    let stored: Option<String> = connection
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![RUNTIME_STATE_KEY],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("读取 Runtime 状态失败：{error}"))?;

    if let Some(json) = stored {
        return serde_json::from_str(&json)
            .map_err(|error| format!("Runtime 状态格式错误：{error}"));
    }

    Ok(RuntimeInstallState::default())
}

fn save_runtime_state(app: &AppHandle, state: &RuntimeInstallState) -> Result<(), String> {
    let connection = open_app_database(app)?;
    ensure_app_settings_schema(&connection)?;
    save_runtime_state_to_connection(&connection, state)
}

fn save_runtime_state_to_connection(
    connection: &Connection,
    state: &RuntimeInstallState,
) -> Result<(), String> {
    let json = serde_json::to_string(state)
        .map_err(|error| format!("序列化 Runtime 状态失败：{error}"))?;
    let timestamp = crate::storage::database::current_timestamp();

    connection
        .execute(
            "INSERT INTO app_settings (key, value, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![RUNTIME_STATE_KEY, json, timestamp],
        )
        .map_err(|error| format!("保存 Runtime 状态失败：{error}"))?;

    Ok(())
}

fn format_download_error(error: reqwest::Error, url: &str) -> String {
    if error.is_connect() || error.is_timeout() || error.is_request() {
        return format!(
            "无法连接 GitHub 下载 Runtime（{error}）。请检查网络或代理，或使用「从本地 zip 导入」。\nURL: {url}"
        );
    }

    format!("下载 Runtime 失败：{error}\nURL: {url}")
}

fn download_file(url: &str, destination: &Path, label: &str, estimated_bytes: u64) -> Result<(), String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|error| format!("创建下载客户端失败：{error}"))?;

    let mut response = client
        .get(url)
        .send()
        .map_err(|error| format_download_error(error, url))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        if status == 404 {
            return Err(format!(
                "Runtime 下载地址不可用（HTTP 404）。该版本可能已从 GitHub Release 移除。请使用「从本地 zip 导入」。\nURL: {url}"
            ));
        }
        return Err(format!(
            "下载 Runtime 失败（HTTP {status}）。请检查网络连接后重试，或使用「从本地 zip 导入」。\nURL: {url}"
        ));
    }

    let bytes_total = response.content_length();
    let mut file =
        File::create(destination).map_err(|error| format!("创建下载文件失败：{error}"))?;
    let mut buffer = [0_u8; 8192];
    let mut bytes_downloaded = 0_u64;
    let mut last_report = Instant::now();
    let mut last_reported_at = 0_u64;

    loop {
        let read = response
            .read(&mut buffer)
            .map_err(|error| format!("读取下载数据失败：{error}"))?;
        if read == 0 {
            break;
        }
        file.write_all(&buffer[..read])
            .map_err(|error| format!("写入下载文件失败：{error}"))?;
        bytes_downloaded += read as u64;

        let should_report = last_report.elapsed().as_millis() >= 200
            || bytes_downloaded.saturating_sub(last_reported_at) >= 256 * 1024;
        if should_report || bytes_total.is_some_and(|total| bytes_downloaded >= total) {
            report_download_progress(
                label,
                bytes_downloaded,
                bytes_total,
                Some(estimated_bytes),
                "downloading",
            );
            last_report = Instant::now();
            last_reported_at = bytes_downloaded;
        }
    }

    report_download_progress(
        label,
        bytes_downloaded,
        bytes_total,
        Some(estimated_bytes),
        "downloading",
    );
    Ok(())
}

fn verify_sha256(path: &Path, expected: &str) -> Result<(), String> {
    let mut file = File::open(path).map_err(|error| format!("打开下载文件失败：{error}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 8192];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("读取下载文件失败：{error}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    let digest = format!("{:x}", hasher.finalize());
    if digest.eq_ignore_ascii_case(expected) {
        Ok(())
    } else {
        Err("Runtime 包校验失败（SHA256 不匹配）。".to_string())
    }
}

fn extract_zip(archive_path: &Path, destination: &Path) -> Result<(), String> {
    let file = File::open(archive_path).map_err(|error| format!("打开 zip 失败：{error}"))?;
    let mut archive =
        ZipArchive::new(file).map_err(|error| format!("解析 zip 失败：{error}"))?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("读取 zip 条目失败：{error}"))?;
        let Some(relative) = entry.enclosed_name() else {
            continue;
        };
        let out_path = destination.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&out_path)
                .map_err(|error| format!("创建解压目录失败：{error}"))?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("创建解压目录失败：{error}"))?;
        }
        let mut outfile =
            File::create(&out_path).map_err(|error| format!("创建解压文件失败：{error}"))?;
        std::io::copy(&mut entry, &mut outfile)
            .map_err(|error| format!("解压文件失败：{error}"))?;
    }

    Ok(())
}

fn find_executable(root: &Path, executable_name: &str) -> Result<PathBuf, String> {
    let direct = root.join(executable_name);
    if direct.is_file() {
        return Ok(direct);
    }

    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = fs::read_dir(&dir).map_err(|error| format!("扫描 Runtime 目录失败：{error}"))?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.eq_ignore_ascii_case(executable_name))
            {
                return Ok(path);
            }
        }
    }

    Err(format!("解压后未找到可执行文件：{executable_name}"))
}