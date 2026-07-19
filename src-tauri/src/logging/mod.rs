use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{fmt, EnvFilter, Layer};

pub mod context;
pub mod query;
pub mod redact;
pub mod settings;

pub use context::CommandSpanGuard;
pub use query::{
    export_log_entries, list_log_files, query_log_entries, LogFileInfo, LogQueryInput,
    LogQueryResult,
};
pub use settings::{load_log_settings, save_log_settings, LogSettings, LogSettingsState};

pub struct LogWorkerGuard {
    _text_guard: tracing_appender::non_blocking::WorkerGuard,
    _json_guard: tracing_appender::non_blocking::WorkerGuard,
}

pub struct LogRuntimeState {
    pub log_dir: PathBuf,
    pub settings_state: LogSettingsState,
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    let log_dir = resolve_log_dir(app)?;
    fs::create_dir_all(&log_dir).map_err(|error| format!("创建日志目录失败：{error}"))?;

    let log_settings = load_log_settings(app).unwrap_or_default();
    let settings_state = LogSettingsState::from_settings(&log_settings);
    let max_level = settings_state.max_level_handle();

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(settings::env_filter_from_settings(&log_settings)));

    let text_appender = tracing_appender::rolling::daily(&log_dir, "jmtools.log");
    let (text_writer, text_guard) = tracing_appender::non_blocking(text_appender);

    let json_appender = tracing_appender::rolling::daily(&log_dir, "jmtools.jsonl");
    let (json_writer, json_guard) = tracing_appender::non_blocking(json_appender);

    let level_filter = tracing_subscriber::filter::FilterFn::new(move |meta| {
        settings::level_enabled(max_level.load(std::sync::atomic::Ordering::Relaxed), meta.level())
    });

    let stdout_layer = fmt::layer()
        .compact()
        .with_ansi(cfg!(debug_assertions))
        .with_writer(std::io::stdout)
        .with_filter(level_filter.clone());

    let text_layer = fmt::layer()
        .compact()
        .with_ansi(false)
        .with_writer(text_writer)
        .with_filter(level_filter.clone());

    let json_layer = fmt::layer()
        .json()
        .with_ansi(false)
        .with_writer(json_writer)
        .with_filter(level_filter);

    if let Err(error) = tracing_log::LogTracer::init() {
        eprintln!("JMTools 日志兼容层已被其他组件初始化，跳过 LogTracer：{error}");
    }

    if let Err(error) = tracing_subscriber::registry()
        .with(env_filter)
        .with(stdout_layer)
        .with(text_layer)
        .with(json_layer)
        .try_init()
    {
        eprintln!("JMTools 日志订阅器已被其他组件初始化，跳过 tracing subscriber：{error}");
    } else {
        app.manage(LogWorkerGuard {
            _text_guard: text_guard,
            _json_guard: json_guard,
        });
    }

    app.manage(LogRuntimeState {
        log_dir: log_dir.clone(),
        settings_state,
    });

    tracing::info!(log_dir = %log_dir.display(), "JMTools 日志系统已初始化");
    Ok(())
}

pub fn log_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(state) = app.try_state::<LogRuntimeState>() {
        return Ok(state.log_dir.clone());
    }

    resolve_log_dir(app)
}

pub fn apply_log_settings(app: &AppHandle, settings: &LogSettings) -> Result<LogSettings, String> {
    let saved = save_log_settings(app, settings)?;

    if let Some(state) = app.try_state::<LogRuntimeState>() {
        state
            .settings_state
            .set_max_level(saved.log_level.as_str());
        state
            .settings_state
            .set_redact_prompts(saved.log_redact_prompts);
    }

    Ok(saved)
}

pub fn should_redact_prompts(app: &AppHandle) -> bool {
    app.try_state::<LogRuntimeState>()
        .map(|state| state.settings_state.should_redact_prompts())
        .unwrap_or(true)
}

fn resolve_log_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_log_dir()
        .or_else(|_| app.path().app_data_dir().map(|path| path.join("logs")))
        .map_err(|error| format!("获取日志目录失败：{error}"))
}
