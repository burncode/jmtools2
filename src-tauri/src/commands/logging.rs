use serde_json::Value;

fn log_frontend_event(level: &str, message: &str, fields: Option<&Value>) {
    let task_id = read_field(fields, &["taskId", "task_id"]);
    let run_id = read_field(fields, &["runId", "run_id"]);
    let command = read_field(fields, &["command"]);
    let scope = read_field(fields, &["scope"]);
    let workflow_id = read_field(fields, &["workflowId", "workflow_id"]);
    let node_id = read_field(fields, &["nodeId", "node_id"]);
    let profile_id = read_field(fields, &["profileId", "profile_id"]);
    let error_code = read_field(fields, &["errorCode", "error_code"]);

    match level {
        "debug" => tracing::debug!(
            target: "jmtools::frontend",
            task_id = %task_id,
            run_id = %run_id,
            command = %command,
            scope = %scope,
            workflow_id = %workflow_id,
            node_id = %node_id,
            profile_id = %profile_id,
            error_code = %error_code,
            "{message}"
        ),
        "error" => tracing::error!(
            target: "jmtools::frontend",
            task_id = %task_id,
            run_id = %run_id,
            command = %command,
            scope = %scope,
            workflow_id = %workflow_id,
            node_id = %node_id,
            profile_id = %profile_id,
            error_code = %error_code,
            "{message}"
        ),
        "warn" => tracing::warn!(
            target: "jmtools::frontend",
            task_id = %task_id,
            run_id = %run_id,
            command = %command,
            scope = %scope,
            workflow_id = %workflow_id,
            node_id = %node_id,
            profile_id = %profile_id,
            error_code = %error_code,
            "{message}"
        ),
        _ => tracing::info!(
            target: "jmtools::frontend",
            task_id = %task_id,
            run_id = %run_id,
            command = %command,
            scope = %scope,
            workflow_id = %workflow_id,
            node_id = %node_id,
            profile_id = %profile_id,
            error_code = %error_code,
            "{message}"
        ),
    }
}

fn read_field(fields: Option<&Value>, keys: &[&str]) -> String {
    let Some(Value::Object(map)) = fields else {
        return String::new();
    };

    for key in keys {
        if let Some(value) = map.get(*key) {
            if let Some(text) = value.as_str() {
                if !text.trim().is_empty() {
                    return text.trim().to_string();
                }
            }
        }
    }

    String::new()
}

#[tauri::command]
pub fn write_app_log(level: String, message: String, fields: Option<Value>) -> Result<(), String> {
    let level = level.trim().to_lowercase();
    let message = message.trim();

    if message.is_empty() {
        return Ok(());
    }

    let message: String = message.chars().take(4_000).collect();

    match level.as_str() {
        "debug" | "error" | "info" | "warn" => {
            log_frontend_event(level.as_str(), &message, fields.as_ref());
            Ok(())
        }
        _ => Err("日志级别不受支持。".to_string()),
    }
}
