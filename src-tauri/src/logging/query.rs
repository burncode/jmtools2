use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogFileInfo {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub kind: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub target: String,
    pub message: String,
    pub task_id: String,
    pub run_id: String,
    pub command: String,
    pub scope: String,
    pub fields: Value,
    pub raw: Value,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogQueryInput {
    pub levels: Option<Vec<String>>,
    pub target_prefix: Option<String>,
    pub task_id: Option<String>,
    pub run_id: Option<String>,
    pub keyword: Option<String>,
    pub since: Option<String>,
    pub until: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogQueryResult {
    pub entries: Vec<LogEntry>,
    pub total_matched: usize,
    pub has_more: bool,
}

pub fn list_log_files(log_dir: &Path) -> Result<Vec<LogFileInfo>, String> {
    if !log_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    for entry in fs::read_dir(log_dir).map_err(|error| format!("读取日志目录失败：{error}"))? {
        let entry = entry.map_err(|error| format!("读取日志目录项失败：{error}"))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };

        if !(name.ends_with(".jsonl") || name.ends_with(".log")) {
            continue;
        }

        let metadata = entry
            .metadata()
            .map_err(|error| format!("读取日志文件元数据失败：{error}"))?;
        files.push(LogFileInfo {
            kind: if name.ends_with(".jsonl") {
                "jsonl".to_string()
            } else {
                "text".to_string()
            },
            name: name.to_string(),
            path: path.display().to_string(),
            size_bytes: metadata.len(),
        });
    }

    files.sort_by(|left, right| right.name.cmp(&left.name));
    Ok(files)
}

pub fn query_log_entries(log_dir: &Path, input: &LogQueryInput) -> Result<LogQueryResult, String> {
    let jsonl_files = list_log_files(log_dir)?
        .into_iter()
        .filter(|file| file.kind == "jsonl")
        .map(|file| PathBuf::from(file.path))
        .collect::<Vec<_>>();

    let levels = input
        .levels
        .as_ref()
        .map(|items| {
            items
                .iter()
                .map(|level| level.trim().to_uppercase())
                .filter(|level| !level.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let target_prefix = input
        .target_prefix
        .as_ref()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let task_id = input
        .task_id
        .as_ref()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let run_id = input
        .run_id
        .as_ref()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let keyword = input
        .keyword
        .as_ref()
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty());

    let limit = input.limit.unwrap_or(200).clamp(1, 2_000);
    let offset = input.offset.unwrap_or(0);

    let mut matched = Vec::new();

    'files: for path in jsonl_files {
        let file = fs::File::open(&path)
            .map_err(|error| format!("打开日志文件失败：{} {error}", path.display()))?;
        let reader = BufReader::new(file);

        for line in reader.lines() {
            let line = line.map_err(|error| format!("读取日志行失败：{error}"))?;
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let Ok(raw) = serde_json::from_str::<Value>(trimmed) else {
                continue;
            };

            let entry = parse_log_entry(&raw);
            if !matches_filters(
                &entry,
                &levels,
                target_prefix.as_deref(),
                task_id.as_deref(),
                run_id.as_deref(),
                keyword.as_deref(),
                input.since.as_deref(),
                input.until.as_deref(),
            ) {
                continue;
            }

            matched.push(entry);
        }

        if matched.len() >= offset + limit + 1 {
            break 'files;
        }
    }

    let total_matched = matched.len();
    let entries = matched
        .into_iter()
        .skip(offset)
        .take(limit)
        .collect::<Vec<_>>();
    let has_more = total_matched > offset + entries.len();

    Ok(LogQueryResult {
        entries,
        total_matched,
        has_more,
    })
}

pub fn export_log_entries(log_dir: &Path, input: &LogQueryInput, output_path: &Path) -> Result<usize, String> {
    let mut export_input = input.clone();
    export_input.limit = Some(10_000);
    export_input.offset = Some(0);
    let result = query_log_entries(log_dir, &export_input)?;

    let mut lines = Vec::with_capacity(result.entries.len());
    for entry in &result.entries {
        lines.push(
            serde_json::to_string(entry)
                .map_err(|error| format!("序列化导出日志失败：{error}"))?,
        );
    }

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建导出目录失败：{error}"))?;
    }

    fs::write(output_path, lines.join("\n"))
        .map_err(|error| format!("写入导出文件失败：{error}"))?;

    Ok(result.entries.len())
}

fn parse_log_entry(raw: &Value) -> LogEntry {
    let fields = raw
        .get("fields")
        .cloned()
        .unwrap_or_else(|| Value::Object(Default::default()));

    let message = fields
        .get("message")
        .and_then(Value::as_str)
        .or_else(|| raw.get("message").and_then(Value::as_str))
        .unwrap_or("")
        .to_string();

    LogEntry {
        timestamp: raw
            .get("timestamp")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        level: raw
            .get("level")
            .and_then(Value::as_str)
            .unwrap_or("INFO")
            .to_string(),
        target: raw
            .get("target")
            .or_else(|| raw.get("metadata").and_then(|value| value.get("target")))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        message,
        task_id: field_as_string(&fields, &["task_id", "taskId"]),
        run_id: field_as_string(&fields, &["run_id", "runId"]),
        command: field_as_string(&fields, &["command"]),
        scope: field_as_string(&fields, &["scope"]),
        fields: fields.clone(),
        raw: raw.clone(),
    }
}

fn field_as_string(fields: &Value, keys: &[&str]) -> String {
    for key in keys {
        if let Some(value) = fields.get(*key).and_then(Value::as_str) {
            if !value.trim().is_empty() {
                return value.trim().to_string();
            }
        }
    }
    String::new()
}

fn matches_filters(
    entry: &LogEntry,
    levels: &[String],
    target_prefix: Option<&str>,
    task_id: Option<&str>,
    run_id: Option<&str>,
    keyword: Option<&str>,
    since: Option<&str>,
    until: Option<&str>,
) -> bool {
    if !levels.is_empty() && !levels.iter().any(|level| entry.level.eq_ignore_ascii_case(level)) {
        return false;
    }

    if let Some(prefix) = target_prefix {
        if !entry.target.starts_with(prefix) {
            return false;
        }
    }

    if let Some(expected_task_id) = task_id {
        if entry.task_id != expected_task_id {
            return false;
        }
    }

    if let Some(expected_run_id) = run_id {
        if entry.run_id != expected_run_id {
            return false;
        }
    }

    if let Some(keyword) = keyword {
        let haystack = format!(
            "{} {} {} {} {} {}",
            entry.message, entry.target, entry.task_id, entry.run_id, entry.command, entry.scope
        )
        .to_lowercase();
        if !haystack.contains(keyword) {
            return false;
        }
    }

    if let Some(since) = since {
        if entry.timestamp.as_str() < since {
            return false;
        }
    }

    if let Some(until) = until {
        if entry.timestamp.as_str() > until {
            return false;
        }
    }

    true
}
