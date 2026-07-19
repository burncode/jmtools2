use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::engine::events::WorkflowEventEmitter;
use crate::engine::events::{WorkflowManualOption, WorkflowManualPreviewImage};
use crate::engine::graph::ports::resolve_merged_inputs;
use crate::engine::graph::validate::{validate_identifier, validate_workflow_definition, validate_workflow_import, SUPPORTED_WORKFLOW_SCHEMA_VERSION};
use crate::engine::manual_gate::{find_manual_gate_node, resolve_manual_gate_context, ManualGateContext};
use crate::engine::registry::{list_node_descriptors, WorkflowNodeDescriptor};
use crate::engine::graph::preflight::preflight_workflow_run;
use crate::engine::run_state::cancel_active_run;
use crate::engine::runtime::{RunCheckpoint, RunOutcome, RuntimeEngine, RuntimeOptions};
use crate::engine::scheduler::collect_downstream_node_ids;
use crate::logging::CommandSpanGuard;
use crate::storage::database::{current_timestamp, ensure_project_schema, open_project_database};

pub use crate::engine::graph::types::*;

const PROJECT_MANIFEST_FILE_NAME: &str = "jmproject.json";
const WORKFLOW_DEFINITION_FILE_NAME: &str = "workflow.json";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveWorkflowDefinitionInput {
    project_root: String,
    definition: WorkflowDefinition,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteWorkflowDefinitionInput {
    project_root: String,
    workflow_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunWorkflowInput {
    project_root: String,
    definition: WorkflowDefinition,
    #[serde(default)]
    node_ids: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelWorkflowRunInput {
    project_root: String,
    run_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetryWorkflowNodeInput {
    project_root: String,
    run_id: String,
    node_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumeWorkflowRunInput {
    project_root: String,
    run_id: String,
    node_id: String,
    #[serde(default)]
    decision: serde_json::Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportWorkflowDefinitionInput {
    path: String,
    definition: WorkflowDefinition,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportWorkflowFromFileInput {
    path: String,
}

#[tauri::command]
pub fn export_workflow_definition(input: ExportWorkflowDefinitionInput) -> Result<(), String> {
    let mut definition = input.definition;
    definition.schema_version = SUPPORTED_WORKFLOW_SCHEMA_VERSION;
    validate_workflow_definition(&definition)?;
    let path = PathBuf::from(input.path.trim());

    if path.as_os_str().is_empty() {
        return Err("导出路径不能为空。".to_string());
    }

    write_json_file(&path, &definition)
}

#[tauri::command]
pub fn import_workflow_from_file(input: ImportWorkflowFromFileInput) -> Result<WorkflowDefinition, String> {
    let path = PathBuf::from(input.path.trim());

    if path.as_os_str().is_empty() {
        return Err("导入路径不能为空。".to_string());
    }

    if !path.is_file() {
        return Err("导入文件不存在。".to_string());
    }

    let content = fs::read_to_string(&path).map_err(|error| format!("读取导入文件失败：{error}"))?;
    let mut definition: WorkflowDefinition = serde_json::from_str(&content)
        .map_err(|error| format!("导入文件不是有效的工作流 JSON：{error}"))?;

    validate_workflow_import(&definition)?;

    let slug = slugify_workflow_name(&definition.name);
    definition.id = format!("{slug}-{}", current_timestamp());
    definition.schema_version = SUPPORTED_WORKFLOW_SCHEMA_VERSION;
    definition.created_at.clear();
    definition.updated_at.clear();

    Ok(definition)
}

#[tauri::command]
pub fn preflight_workflow(input: RunWorkflowInput) -> Result<(), String> {
    let project_root = validate_project_root(&input.project_root)?;
    validate_workflow_definition(&input.definition)?;

    let dirty_node_ids = if input.node_ids.is_empty() {
        None
    } else {
        Some(input.node_ids.as_slice())
    };

    preflight_workflow_run(&input.definition, &project_root, dirty_node_ids)
}

#[tauri::command]
pub fn list_workflow_node_descriptors() -> Result<Vec<WorkflowNodeDescriptor>, String> {
    list_node_descriptors()
}

#[tauri::command]
pub fn list_workflow_definitions(project_root: String) -> Result<Vec<WorkflowDefinition>, String> {
    let project_root = validate_project_root(&project_root)?;
    let workflows_directory = workflows_directory(&project_root);

    if !workflows_directory.exists() {
        return Ok(Vec::new());
    }

    let mut definitions = Vec::new();
    for entry in fs::read_dir(&workflows_directory)
        .map_err(|error| format!("读取工作流目录失败：{error}"))?
    {
        let entry = entry.map_err(|error| format!("读取工作流目录项失败：{error}"))?;
        let definition_path = entry.path().join(WORKFLOW_DEFINITION_FILE_NAME);

        if definition_path.is_file() {
            definitions.push(read_workflow_definition_file(&definition_path)?);
        }
    }

    definitions.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(definitions)
}

#[tauri::command]
pub fn get_workflow_definition(
    project_root: String,
    workflow_id: String,
) -> Result<WorkflowDefinition, String> {
    let project_root = validate_project_root(&project_root)?;
    let workflow_id = validate_identifier(&workflow_id, "工作流 ID")?;
    read_workflow_definition_file(&workflow_definition_path(&project_root, &workflow_id))
}

#[tauri::command]
pub fn save_workflow_definition(
    input: SaveWorkflowDefinitionInput,
) -> Result<WorkflowDefinition, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let mut definition = input.definition;
    definition.id = validate_identifier(&definition.id, "工作流 ID")?;
    definition.schema_version = SUPPORTED_WORKFLOW_SCHEMA_VERSION;
    validate_workflow_definition(&definition)?;

    let timestamp = current_timestamp().to_string();
    if definition.created_at.trim().is_empty() {
        definition.created_at = timestamp.clone();
    }
    definition.updated_at = timestamp;

    let definition_directory = workflows_directory(&project_root).join(&definition.id);
    fs::create_dir_all(&definition_directory)
        .map_err(|error| format!("创建工作流目录失败：{error}"))?;
    write_json_file(
        &definition_directory.join(WORKFLOW_DEFINITION_FILE_NAME),
        &definition,
    )?;

    Ok(definition)
}

#[tauri::command]
pub fn delete_workflow_definition(input: DeleteWorkflowDefinitionInput) -> Result<(), String> {
    let project_root = validate_project_root(&input.project_root)?;
    let workflow_id = validate_identifier(&input.workflow_id, "工作流 ID")?;
    let definition_directory = workflows_directory(&project_root).join(workflow_id);

    if definition_directory.exists() {
        fs::remove_dir_all(&definition_directory)
            .map_err(|error| format!("删除工作流失败：{error}"))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn run_workflow(app: AppHandle, input: RunWorkflowInput) -> Result<WorkflowRun, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let workflow_id = input.definition.id.clone();
    let dirty_count = input.node_ids.len();
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut span = CommandSpanGuard::enter("run_workflow", "jmtools::commands");
        tracing::info!(
            target = "jmtools::workflow",
            workflow_id = %workflow_id,
            dirty_nodes = dirty_count,
            "run_workflow command started"
        );
        let dirty_node_ids = if input.node_ids.is_empty() {
            None
        } else {
            Some(input.node_ids)
        };
        let result = run_workflow_internal(Some(&app_handle), &project_root, input.definition, dirty_node_ids);
        if result.is_err() {
            span.mark_failed();
        }
        result
    })
    .await
    .map_err(|error| format!("工作流运行任务失败：{error}"))?
}

#[tauri::command]
pub fn cancel_workflow_run(app: AppHandle, input: CancelWorkflowRunInput) -> Result<(), String> {
    let project_root = validate_project_root(&input.project_root)?;
    let run_id = validate_identifier(&input.run_id, "运行 ID")?;
    if cancel_active_run(&run_id) {
        return Ok(());
    }

    // 没有正在运行的协作式任务时，可能是停在人工节点等待输入的断点：取消并清理断点。
    let connection = open_project_database(&project_root)?;
    ensure_project_schema(&connection)?;
    if let Some(mut run) = read_workflow_run_from_database(&connection, &run_id)? {
        if run.status == "awaiting_input" {
            for node_run in run.node_runs.iter_mut() {
                if node_run.status == "awaiting_input"
                    || node_run.status == "running"
                    || node_run.status == "queued"
                {
                    node_run.status = "canceled".to_string();
                    node_run.error = "用户取消了运行。".to_string();
                    node_run.finished_at = Some(current_timestamp());
                    node_run.progress = 100;
                }
            }
            run.status = "canceled".to_string();
            run.error = "用户取消了运行。".to_string();
            run.finished_at = Some(current_timestamp());
            write_workflow_run_to_database(&connection, &run)?;
            delete_workflow_run_checkpoint(&connection, &run_id)?;
            let emitter = WorkflowEventEmitter::new(Some(&app));
            emitter.emit_run_finished(&run);
            return Ok(());
        }
    }

    Err("当前没有正在运行的任务，或运行已结束。".to_string())
}

#[tauri::command]
pub async fn resume_workflow_run(
    app: AppHandle,
    input: ResumeWorkflowRunInput,
) -> Result<WorkflowRun, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let run_id = validate_identifier(&input.run_id, "运行 ID")?;
    let node_id = validate_identifier(&input.node_id, "节点 ID")?;
    let decision = input.decision;

    let connection = open_project_database(&project_root)?;
    ensure_project_schema(&connection)?;
    let checkpoint = read_workflow_run_checkpoint(&connection, &run_id)?
        .ok_or_else(|| "未找到可恢复的人工节点断点，可能已被取消或已继续。".to_string())?;

    if checkpoint.awaiting_node_id != node_id {
        return Err("恢复的人工节点与断点不一致。".to_string());
    }

    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut span = CommandSpanGuard::enter("resume_workflow_run", "jmtools::commands")
            .with_run_id(run_id.clone());
        tracing::info!(
            target = "jmtools::workflow",
            run_id = %run_id,
            node_id = %node_id,
            "resume_workflow_run command started"
        );
        let outcome = RuntimeEngine::resume(Some(&app_handle), &project_root, checkpoint, decision);
        let result = outcome.and_then(|value| persist_run_outcome(&project_root, value));
        if result.is_err() {
            span.mark_failed();
        }
        result
    })
    .await
    .map_err(|error| format!("工作流恢复任务失败：{error}"))?
}

#[tauri::command]
pub async fn retry_workflow_node(
    app: AppHandle,
    input: RetryWorkflowNodeInput,
) -> Result<WorkflowRun, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let run_id = validate_identifier(&input.run_id, "运行 ID")?;
    let node_id = validate_identifier(&input.node_id, "节点 ID")?;
    let connection = open_project_database(&project_root)?;
    ensure_project_schema(&connection)?;
    let run = read_workflow_run_from_database(&connection, &run_id)?
        .ok_or_else(|| "未找到要重试的工作流运行记录。".to_string())?;
    let definition =
        read_workflow_definition_file(&workflow_definition_path(&project_root, &run.workflow_id))?;

    if !definition.nodes.iter().any(|node| node.id == node_id) {
        return Err("要重试的节点不属于该工作流。".to_string());
    }

    let mut dirty_nodes = collect_downstream_node_ids(&node_id, &definition.edges);
    dirty_nodes.push(node_id);
    let app_handle = app.clone();

    tauri::async_runtime::spawn_blocking(move || {
        run_workflow_internal(
            Some(&app_handle),
            &project_root,
            definition,
            Some(dirty_nodes),
        )
    })
    .await
    .map_err(|error| format!("工作流重试任务失败：{error}"))?
}

#[tauri::command]
pub fn get_workflow_run(project_root: String, run_id: String) -> Result<WorkflowRun, String> {
    let project_root = validate_project_root(&project_root)?;
    let run_id = validate_identifier(&run_id, "运行 ID")?;
    let connection = open_project_database(&project_root)?;
    ensure_project_schema(&connection)?;
    read_workflow_run_from_database(&connection, &run_id)?
        .ok_or_else(|| "未找到工作流运行记录。".to_string())
}

#[tauri::command]
pub fn list_workflow_runs(
    project_root: String,
    workflow_id: Option<String>,
) -> Result<Vec<WorkflowRun>, String> {
    let project_root = validate_project_root(&project_root)?;
    let connection = open_project_database(&project_root)?;
    ensure_project_schema(&connection)?;
    let workflow_filter = workflow_id
        .as_deref()
        .map(|value| validate_identifier(value, "工作流 ID"))
        .transpose()?;

    let mut runs = if let Some(workflow_id) = workflow_filter {
        let mut statement = connection
            .prepare(
                "SELECT run_json FROM workflow_runs
                 WHERE workflow_id = ?1
                 ORDER BY started_at DESC
                 LIMIT 20",
            )
            .map_err(|error| format!("读取工作流运行历史失败：{error}"))?;
        let rows = statement
            .query_map(params![workflow_id], |row| row.get::<_, String>(0))
            .map_err(|error| format!("读取工作流运行历史失败：{error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取工作流运行历史失败：{error}"))?;
        rows
    } else {
        let mut statement = connection
            .prepare(
                "SELECT run_json FROM workflow_runs
                 ORDER BY started_at DESC
                 LIMIT 20",
            )
            .map_err(|error| format!("读取工作流运行历史失败：{error}"))?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| format!("读取工作流运行历史失败：{error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取工作流运行历史失败：{error}"))?;
        rows
    };

    runs.iter_mut()
        .map(|content| {
            serde_json::from_str::<WorkflowRun>(content)
                .map_err(|error| format!("工作流运行历史格式错误：{error}"))
        })
        .collect()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetWorkflowAwaitingInputInput {
    project_root: String,
    #[serde(default)]
    workflow_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowAwaitingInputContext {
    pub run_id: String,
    pub workflow_id: String,
    pub node_id: String,
    pub node_kind: String,
    pub prompt: String,
    pub options: Vec<WorkflowManualOption>,
    pub allow_multiple: bool,
    pub preview_images: Vec<WorkflowManualPreviewImage>,
}

#[tauri::command]
pub fn get_workflow_awaiting_input(
    input: GetWorkflowAwaitingInputInput,
) -> Result<Option<WorkflowAwaitingInputContext>, String> {
    let project_root = validate_project_root(&input.project_root)?;
    let connection = open_project_database(&project_root)?;
    ensure_project_schema(&connection)?;

    let workflow_filter = input
        .workflow_id
        .as_deref()
        .map(|value| validate_identifier(value, "工作流 ID"))
        .transpose()?;

    let runs = list_workflow_runs(input.project_root.clone(), input.workflow_id.clone())?;
    let awaiting_run = select_awaiting_workflow_run(&runs, workflow_filter.as_deref());

    let Some(run) = awaiting_run else {
        return Ok(None);
    };

    let checkpoint = read_workflow_run_checkpoint(&connection, &run.id)?
        .ok_or_else(|| "运行处于等待输入状态，但未找到断点记录。".to_string())?;

    let gate_node = find_manual_gate_node(&checkpoint.definition, &checkpoint.awaiting_node_id)
        .ok_or_else(|| "断点节点不是有效的人工节点。".to_string())?;

    let merged_inputs = resolve_merged_inputs(
        &checkpoint.awaiting_node_id,
        &checkpoint.definition.edges,
        &checkpoint.outputs_by_node,
    );
    let ManualGateContext {
        prompt,
        options,
        allow_multiple,
        preview_images,
    } = resolve_manual_gate_context(gate_node, &merged_inputs)?;

    Ok(Some(WorkflowAwaitingInputContext {
        run_id: run.id.clone(),
        workflow_id: run.workflow_id.clone(),
        node_id: checkpoint.awaiting_node_id,
        node_kind: gate_node.kind.clone(),
        prompt,
        options,
        allow_multiple,
        preview_images,
    }))
}

fn select_awaiting_workflow_run<'a>(
    runs: &'a [WorkflowRun],
    workflow_id: Option<&str>,
) -> Option<&'a WorkflowRun> {
    if let Some(workflow_id) = workflow_id {
        return runs
            .iter()
            .find(|run| run.workflow_id == workflow_id && run.status == "awaiting_input");
    }

    runs.iter()
        .find(|run| run.status == "awaiting_input")
}

fn run_workflow_internal(
    app: Option<&AppHandle>,
    project_root: &Path,
    definition: WorkflowDefinition,
    dirty_node_ids: Option<Vec<String>>,
) -> Result<WorkflowRun, String> {
    let outcome = RuntimeEngine::execute(RuntimeOptions {
        app,
        project_root,
        definition,
        dirty_node_ids,
    })?;
    persist_run_outcome(project_root, outcome)
}

/// 落库运行结果：完成则写运行记录并清理断点；暂停则写运行记录并保存断点。
fn persist_run_outcome(project_root: &Path, outcome: RunOutcome) -> Result<WorkflowRun, String> {
    let connection = open_project_database(project_root)?;
    ensure_project_schema(&connection)?;
    match outcome {
        RunOutcome::Finished(run) => {
            write_workflow_run_to_database(&connection, &run)?;
            delete_workflow_run_checkpoint(&connection, &run.id)?;
            Ok(run)
        }
        RunOutcome::AwaitingInput { run, checkpoint } => {
            write_workflow_run_to_database(&connection, &run)?;
            write_workflow_run_checkpoint(&connection, &checkpoint)?;
            Ok(run)
        }
    }
}

fn write_workflow_run_checkpoint(
    connection: &rusqlite::Connection,
    checkpoint: &RunCheckpoint,
) -> Result<(), String> {
    let checkpoint_json = serde_json::to_string(checkpoint)
        .map_err(|error| format!("序列化人工节点断点失败：{error}"))?;
    connection
        .execute(
            "INSERT OR REPLACE INTO workflow_run_checkpoints
             (run_id, workflow_id, awaiting_node_id, checkpoint_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                checkpoint.run.id,
                checkpoint.run.workflow_id,
                checkpoint.awaiting_node_id,
                checkpoint_json,
                current_timestamp()
            ],
        )
        .map_err(|error| format!("写入人工节点断点失败：{error}"))?;
    Ok(())
}

fn read_workflow_run_checkpoint(
    connection: &rusqlite::Connection,
    run_id: &str,
) -> Result<Option<RunCheckpoint>, String> {
    let checkpoint_json = connection
        .query_row(
            "SELECT checkpoint_json FROM workflow_run_checkpoints WHERE run_id = ?1",
            params![run_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("读取人工节点断点失败：{error}"))?;

    checkpoint_json
        .map(|content| {
            serde_json::from_str::<RunCheckpoint>(&content)
                .map_err(|error| format!("人工节点断点格式错误：{error}"))
        })
        .transpose()
}

fn delete_workflow_run_checkpoint(
    connection: &rusqlite::Connection,
    run_id: &str,
) -> Result<(), String> {
    connection
        .execute(
            "DELETE FROM workflow_run_checkpoints WHERE run_id = ?1",
            params![run_id],
        )
        .map_err(|error| format!("清理人工节点断点失败：{error}"))?;
    Ok(())
}

fn validate_project_root(project_root: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(project_root.trim());

    if root.as_os_str().is_empty() {
        return Err("项目目录不能为空。".to_string());
    }

    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("解析项目目录失败：{error}"))?;

    if !canonical_root.join(PROJECT_MANIFEST_FILE_NAME).is_file() {
        return Err("当前目录不是有效的 JMTools 项目。".to_string());
    }

    Ok(canonical_root)
}

fn workflows_directory(project_root: &Path) -> PathBuf {
    project_root.join("assets").join("workflows")
}

fn workflow_definition_path(project_root: &Path, workflow_id: &str) -> PathBuf {
    workflows_directory(project_root)
        .join(workflow_id)
        .join(WORKFLOW_DEFINITION_FILE_NAME)
}

fn read_workflow_definition_file(path: &Path) -> Result<WorkflowDefinition, String> {
    let content = fs::read_to_string(path).map_err(|error| format!("读取工作流失败：{error}"))?;
    serde_json::from_str(&content).map_err(|error| format!("工作流文件格式错误：{error}"))
}

fn slugify_workflow_name(name: &str) -> String {
    let normalized = name
        .trim()
        .to_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if normalized.is_empty() {
        "workflow".to_string()
    } else {
        normalized
    }
}

fn write_json_file<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let content = serde_json::to_string_pretty(value)
        .map_err(|error| format!("序列化工作流数据失败：{error}"))?;
    let temp_path = path.with_extension("json.tmp");

    fs::write(&temp_path, content).map_err(|error| format!("写入工作流临时文件失败：{error}"))?;
    fs::rename(&temp_path, path).map_err(|error| format!("写入工作流文件失败：{error}"))
}

fn write_workflow_run_to_database(
    connection: &rusqlite::Connection,
    run: &WorkflowRun,
) -> Result<(), String> {
    let run_json =
        serde_json::to_string(run).map_err(|error| format!("序列化工作流运行记录失败：{error}"))?;
    connection
        .execute(
            "INSERT OR REPLACE INTO workflow_runs
             (id, workflow_id, status, started_at, finished_at, error, run_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                run.id,
                run.workflow_id,
                run.status,
                run.started_at,
                run.finished_at,
                run.error,
                run_json
            ],
        )
        .map_err(|error| format!("写入工作流运行记录失败：{error}"))?;

    for node_run in &run.node_runs {
        let output_json = serde_json::to_string(&node_run.outputs)
            .map_err(|error| format!("序列化节点输出失败：{error}"))?;
        connection
            .execute(
                "INSERT OR REPLACE INTO workflow_node_runs
                 (run_id, node_id, node_kind, status, started_at, finished_at, error, output_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    run.id,
                    node_run.node_id,
                    node_run.node_kind,
                    node_run.status,
                    node_run.started_at,
                    node_run.finished_at,
                    node_run.error,
                    output_json
                ],
            )
            .map_err(|error| format!("写入节点运行记录失败：{error}"))?;
    }

    Ok(())
}

fn read_workflow_run_from_database(
    connection: &rusqlite::Connection,
    run_id: &str,
) -> Result<Option<WorkflowRun>, String> {
    let run_json = connection
        .query_row(
            "SELECT run_json FROM workflow_runs WHERE id = ?1",
            params![run_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("读取工作流运行记录失败：{error}"))?;

    run_json
        .map(|content| {
            serde_json::from_str::<WorkflowRun>(&content)
                .map_err(|error| format!("工作流运行记录格式错误：{error}"))
        })
        .transpose()
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::engine::graph::ports::resolve_merged_inputs;
    use crate::engine::graph::types::{
        default_edge_data_type, default_from_port, default_node_position, default_to_port,
        WorkflowDefinition, WorkflowEdgeInput, WorkflowNodeInput, WorkflowNodePosition,
    };
    use crate::engine::scheduler::{
        build_topological_order, initialize_node_states, mark_failed_and_skip_dependents,
    };
    use serde_json::json;

    fn edge(from: &str, to: &str) -> WorkflowEdgeInput {
        WorkflowEdgeInput {
            data_type: default_edge_data_type(),
            from_node_id: from.to_string(),
            from_port: default_from_port(),
            id: format!("{from}-{to}"),
            to_node_id: to.to_string(),
            to_port: default_to_port(),
        }
    }

    #[test]
    fn resolve_merged_inputs_routes_by_port() {
        let edges = vec![WorkflowEdgeInput {
            data_type: "toolResult".to_string(),
            from_node_id: "remove-bg".to_string(),
            from_port: "toolResult".to_string(),
            id: "edge-bind".to_string(),
            to_node_id: "bind".to_string(),
            to_port: "toolResult".to_string(),
        }];
        let mut outputs_by_node = HashMap::new();
        outputs_by_node.insert(
            "remove-bg".to_string(),
            json!({
                "image": { "path": "assets/out.png" },
                "toolResult": { "outputImage": { "path": "assets/out.png" } }
            }),
        );

        let merged = resolve_merged_inputs("bind", &edges, &outputs_by_node);

        assert!(merged.get("toolResult").is_some());
        assert!(merged.pointer("/toolResult/outputImage").is_some());
    }

    #[test]
    fn topological_order_runs_upstream_nodes_first() {
        let nodes = vec![
            WorkflowNodeInput {
                id: "output".to_string(),
                kind: "output.asset".to_string(),
                params: json!({}),
                position: default_node_position(),
                ..Default::default()
            },
            WorkflowNodeInput {
                id: "source".to_string(),
                kind: "image.input".to_string(),
                params: json!({}),
                position: default_node_position(),
                ..Default::default()
            },
            WorkflowNodeInput {
                id: "remove-bg".to_string(),
                kind: "tool.backgroundRemoval".to_string(),
                params: json!({}),
                position: default_node_position(),
                ..Default::default()
            },
        ];
        let edges = vec![edge("source", "remove-bg"), edge("remove-bg", "output")];

        let order = build_topological_order(&nodes, &edges).expect("valid graph should order");

        assert_eq!(order, vec!["source", "remove-bg", "output"]);
    }

    #[test]
    fn topological_order_rejects_cycles() {
        let nodes = vec![
            WorkflowNodeInput {
                id: "a".to_string(),
                kind: "image.input".to_string(),
                params: json!({}),
                position: default_node_position(),
                ..Default::default()
            },
            WorkflowNodeInput {
                id: "b".to_string(),
                kind: "preview.image".to_string(),
                params: json!({}),
                position: default_node_position(),
                ..Default::default()
            },
        ];
        let edges = vec![edge("a", "b"), edge("b", "a")];

        let error = build_topological_order(&nodes, &edges).expect_err("cycle should fail");

        assert!(error.contains("不能包含循环依赖"));
    }

    #[test]
    fn failed_node_skips_downstream_dependents() {
        let nodes = vec![
            WorkflowNodeInput {
                id: "source".to_string(),
                kind: "image.input".to_string(),
                params: json!({ "path": "" }),
                position: default_node_position(),
                ..Default::default()
            },
            WorkflowNodeInput {
                id: "remove-bg".to_string(),
                kind: "tool.backgroundRemoval".to_string(),
                params: json!({}),
                position: default_node_position(),
                ..Default::default()
            },
            WorkflowNodeInput {
                id: "output".to_string(),
                kind: "output.asset".to_string(),
                params: json!({}),
                position: default_node_position(),
                ..Default::default()
            },
        ];
        let edges = vec![edge("source", "remove-bg"), edge("remove-bg", "output")];
        let mut states = initialize_node_states(&nodes);

        mark_failed_and_skip_dependents("source", "缺少图片路径", &edges, &mut states);

        assert_eq!(states.get("source").map(String::as_str), Some("failed"));
        assert_eq!(states.get("remove-bg").map(String::as_str), Some("skipped"));
        assert_eq!(states.get("output").map(String::as_str), Some("skipped"));
    }

    #[test]
    fn workflow_node_position_survives_serialization() {
        let definition = WorkflowDefinition {
            created_at: String::new(),
            description: String::new(),
            edges: Vec::new(),
            groups: Vec::new(),
            id: "workflow-a".to_string(),
            name: "测试工作流".to_string(),
            schema_version: 1,
            nodes: vec![WorkflowNodeInput {
                id: "node-a".to_string(),
                kind: "image.input".to_string(),
                params: json!({}),
                position: WorkflowNodePosition { x: 120.0, y: 240.0 },
                ..Default::default()
            }],
            selected_template: String::new(),
            ui_state: json!({}),
            updated_at: String::new(),
            viewport: json!({}),
        };

        let content = serde_json::to_string(&definition).expect("definition should serialize");
        let restored: WorkflowDefinition =
            serde_json::from_str(&content).expect("definition should deserialize");

        assert_eq!(restored.nodes[0].position.x, 120.0);
        assert_eq!(restored.nodes[0].position.y, 240.0);
    }

    #[test]
    fn legacy_edge_defaults_to_auto_ports() {
        let content = r#"{
            "id": "edge-a-b",
            "fromNodeId": "a",
            "toNodeId": "b"
        }"#;

        let restored: WorkflowEdgeInput =
            serde_json::from_str(content).expect("legacy edge should deserialize");

        assert_eq!(restored.from_port, "output");
        assert_eq!(restored.to_port, "input");
        assert_eq!(restored.data_type, "asset");
    }
}
