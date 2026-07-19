use std::collections::{BTreeMap, BTreeSet, HashMap, VecDeque};
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::AppHandle;
use tracing::info;

use crate::engine::cache::{compute_cache_key, WorkflowCacheStore};
use crate::engine::events::WorkflowEventEmitter;
use crate::engine::executor::{execute_node, ExecutorContext};
use crate::engine::manual_gate::resolve_manual_gate_context;
use crate::engine::graph::ports::resolve_merged_inputs;
use crate::engine::graph::types::{
    WorkflowDefinition, WorkflowNodeRun, WorkflowRun, WorkflowRunLog,
};
use crate::engine::graph::preflight::{
    find_missing_upstream_ids, find_unfinished_upstream_ids, hydrate_node_from_cache,
};
use crate::engine::graph::validate::validate_workflow_definition;
use crate::engine::run_state::{clear_run_cancel_flag, is_run_canceled, register_run_cancel_flag};
use crate::engine::scheduler::{
    build_topological_order, collect_downstream_node_ids, initialize_node_states,
    mark_failed_and_skip_dependents,
};
use crate::storage::database::current_timestamp;

pub const MANUAL_GATE_NODE_KIND: &str = "control.manualGate";

pub struct RuntimeEngine;

pub struct RuntimeOptions<'a> {
    pub app: Option<&'a AppHandle>,
    pub project_root: &'a Path,
    pub definition: WorkflowDefinition,
    pub dirty_node_ids: Option<Vec<String>>,
}

/// 执行结果：要么整次跑完，要么停在人工节点等待用户输入（携带可持久化断点）。
pub enum RunOutcome {
    Finished(WorkflowRun),
    AwaitingInput {
        run: WorkflowRun,
        checkpoint: RunCheckpoint,
    },
}

/// 人工节点断点：保存恢复执行所需的全部状态，可序列化落库以便关闭应用后继续。
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunCheckpoint {
    pub definition: WorkflowDefinition,
    pub run: WorkflowRun,
    pub node_runs: Vec<WorkflowNodeRun>,
    pub states: BTreeMap<String, String>,
    pub outputs_by_node: HashMap<String, Value>,
    pub queue: Vec<String>,
    #[serde(default)]
    pub effective_dirty_nodes: Option<Vec<String>>,
    #[serde(default)]
    pub is_partial_run: bool,
    pub awaiting_node_id: String,
}

enum LoopStep {
    Completed,
    Paused { node_id: String },
}

/// 执行循环过程中需要在暂停/恢复之间携带的可变状态（owned，避免闭包借用冲突）。
struct LoopCarry {
    queue: VecDeque<String>,
    outputs_by_node: HashMap<String, Value>,
    states: BTreeMap<String, String>,
    node_runs: Vec<WorkflowNodeRun>,
    run: WorkflowRun,
    deferred_passes: usize,
    pending_decisions: HashMap<String, Value>,
}

impl RuntimeEngine {
    pub fn execute(options: RuntimeOptions<'_>) -> Result<RunOutcome, String> {
        validate_workflow_definition(&options.definition)?;
        let dirty_node_ids = options.dirty_node_ids.as_deref();
        crate::engine::graph::preflight::preflight_workflow_run(
            &options.definition,
            options.project_root,
            dirty_node_ids,
        )?;
        let order = build_topological_order(&options.definition.nodes, &options.definition.edges)?;
        let started_at = current_timestamp();
        let run_id = format!("run-{started_at}");
        let cache_store = WorkflowCacheStore::new(options.project_root, &options.definition.id);
        let emitter = WorkflowEventEmitter::new(options.app);
        let dirty_nodes = options
            .dirty_node_ids
            .filter(|items| !items.is_empty())
            .map(|items| items.into_iter().collect::<BTreeSet<_>>());
        let effective_dirty_nodes = dirty_nodes.as_ref().map(|dirty| {
            let mut expanded = dirty.clone();
            for node_id in dirty.iter() {
                for downstream_id in collect_downstream_node_ids(node_id, &options.definition.edges) {
                    expanded.insert(downstream_id);
                }
            }
            expanded
        });
        let is_partial_run = dirty_nodes.is_some();

        let node_runs = options
            .definition
            .nodes
            .iter()
            .map(|node| WorkflowNodeRun {
                node_id: node.id.clone(),
                node_kind: node.kind.clone(),
                status: "queued".to_string(),
                started_at: None,
                finished_at: None,
                error: String::new(),
                outputs: json!({}),
                logs: Vec::new(),
                duration_ms: None,
                progress: 0,
                cache_hit: false,
                output_summary: String::new(),
            })
            .collect::<Vec<_>>();
        let states = initialize_node_states(&options.definition.nodes);
        let run = WorkflowRun {
            id: run_id.clone(),
            workflow_id: options.definition.id.clone(),
            workflow_name: options.definition.name.clone(),
            status: "running".to_string(),
            node_runs: node_runs.clone(),
            started_at,
            finished_at: None,
            error: String::new(),
        };

        emitter.emit_run_started(&run);

        info!(
            target = "jmtools::workflow",
            workflow_id = %options.definition.id,
            run_id = %run_id,
            dirty_nodes = dirty_nodes.as_ref().map(|items| items.len()).unwrap_or(0),
            is_partial_run,
            "workflow run started"
        );

        let queue: VecDeque<String> = order.into_iter().collect();
        let max_deferred_passes = queue.len().saturating_mul(queue.len()).max(1);

        let carry = LoopCarry {
            queue,
            outputs_by_node: HashMap::new(),
            states,
            node_runs,
            run,
            deferred_passes: 0,
            pending_decisions: HashMap::new(),
        };

        drive_run(
            &options.definition,
            options.project_root,
            options.app,
            &cache_store,
            &emitter,
            &effective_dirty_nodes,
            is_partial_run,
            max_deferred_passes,
            carry,
        )
    }

    /// 从断点恢复：注入用户在人工节点上的决策，继续执行同一个 run。
    pub fn resume(
        app: Option<&AppHandle>,
        project_root: &Path,
        checkpoint: RunCheckpoint,
        decision: Value,
    ) -> Result<RunOutcome, String> {
        let cache_store = WorkflowCacheStore::new(project_root, &checkpoint.definition.id);
        let emitter = WorkflowEventEmitter::new(app);
        let effective_dirty_nodes = checkpoint
            .effective_dirty_nodes
            .as_ref()
            .map(|items| items.iter().cloned().collect::<BTreeSet<_>>());
        let max_deferred_passes = checkpoint
            .queue
            .len()
            .saturating_mul(checkpoint.queue.len())
            .max(1);

        let mut pending_decisions = HashMap::new();
        pending_decisions.insert(checkpoint.awaiting_node_id.clone(), decision);

        let mut run = checkpoint.run.clone();
        run.status = "running".to_string();
        run.finished_at = None;

        let carry = LoopCarry {
            queue: checkpoint.queue.iter().cloned().collect(),
            outputs_by_node: checkpoint.outputs_by_node.clone(),
            states: checkpoint.states.clone(),
            node_runs: checkpoint.node_runs.clone(),
            run,
            deferred_passes: 0,
            pending_decisions,
        };

        drive_run(
            &checkpoint.definition,
            project_root,
            app,
            &cache_store,
            &emitter,
            &effective_dirty_nodes,
            checkpoint.is_partial_run,
            max_deferred_passes,
            carry,
        )
    }
}

/// 注册取消标志、运行循环，并根据结果整理为完成或等待输入两种结局。
#[allow(clippy::too_many_arguments)]
fn drive_run(
    definition: &WorkflowDefinition,
    project_root: &Path,
    app: Option<&AppHandle>,
    cache_store: &WorkflowCacheStore,
    emitter: &WorkflowEventEmitter<'_>,
    effective_dirty_nodes: &Option<BTreeSet<String>>,
    is_partial_run: bool,
    max_deferred_passes: usize,
    carry: LoopCarry,
) -> Result<RunOutcome, String> {
    let run_id = carry.run.id.clone();
    let cancel_flag = register_run_cancel_flag(&run_id);

    let (step, mut carry) = run_loop(
        definition,
        project_root,
        app,
        &cancel_flag,
        emitter,
        cache_store,
        effective_dirty_nodes,
        max_deferred_passes,
        carry,
    )?;

    match step {
        LoopStep::Paused { node_id } => {
            // 暂停时不结束运行：保留 running 之外的 awaiting_input 状态，落库断点供恢复。
            clear_run_cancel_flag(&run_id);
            carry.run.status = "awaiting_input".to_string();
            carry.run.node_runs = carry.node_runs.clone();

            let checkpoint = RunCheckpoint {
                definition: definition.clone(),
                run: carry.run.clone(),
                node_runs: carry.node_runs.clone(),
                states: carry.states.clone(),
                outputs_by_node: carry.outputs_by_node.clone(),
                queue: carry.queue.iter().cloned().collect(),
                effective_dirty_nodes: effective_dirty_nodes
                    .as_ref()
                    .map(|items| items.iter().cloned().collect()),
                is_partial_run,
                awaiting_node_id: node_id,
            };

            info!(
                target = "jmtools::workflow",
                workflow_id = %definition.id,
                run_id = %run_id,
                node_id = %checkpoint.awaiting_node_id,
                "workflow run paused, awaiting manual input"
            );

            Ok(RunOutcome::AwaitingInput {
                run: carry.run,
                checkpoint,
            })
        }
        LoopStep::Completed => {
            let LoopCarry {
                mut node_runs,
                mut run,
                states,
                ..
            } = carry;

            if run.status != "canceled" {
                apply_skipped_node_runs(&mut node_runs, &states);
                if is_partial_run {
                    apply_partial_run_queued_cleanup(&mut node_runs);
                }
                run.node_runs = node_runs.clone();
                run.status = summarize_run_status(&node_runs);
                run.error = node_runs
                    .iter()
                    .find(|node| node.status == "failed")
                    .map(|node| node.error.clone())
                    .unwrap_or_default();
            }

            run.finished_at = Some(current_timestamp());
            clear_run_cancel_flag(&run_id);
            emitter.emit_run_finished(&run);

            info!(
                target = "jmtools::workflow",
                workflow_id = %definition.id,
                run_id = %run.id,
                status = %run.status,
                "workflow run finished"
            );

            Ok(RunOutcome::Finished(run))
        }
    }
}

/// 核心拓扑执行循环。owned 局部变量与原实现一致，返回执行步骤与携带状态。
#[allow(clippy::too_many_arguments)]
fn run_loop(
    definition: &WorkflowDefinition,
    project_root: &Path,
    app: Option<&AppHandle>,
    cancel_flag: &Arc<AtomicBool>,
    emitter: &WorkflowEventEmitter<'_>,
    cache_store: &WorkflowCacheStore,
    effective_dirty_nodes: &Option<BTreeSet<String>>,
    max_deferred_passes: usize,
    carry: LoopCarry,
) -> Result<(LoopStep, LoopCarry), String> {
    let LoopCarry {
        mut queue,
        mut outputs_by_node,
        mut states,
        mut node_runs,
        mut run,
        mut deferred_passes,
        mut pending_decisions,
    } = carry;

    let repack = |queue, outputs_by_node, states, node_runs, run, deferred_passes, pending_decisions| LoopCarry {
        queue,
        outputs_by_node,
        states,
        node_runs,
        run,
        deferred_passes,
        pending_decisions,
    };

    while let Some(node_id) = queue.pop_front() {
        if is_run_canceled(cancel_flag) {
            finalize_canceled_run(&mut run, &mut node_runs, &mut states, &node_id);
            return Ok((
                LoopStep::Completed,
                repack(queue, outputs_by_node, states, node_runs, run, deferred_passes, pending_decisions),
            ));
        }

        if states.get(&node_id).map(String::as_str) == Some("skipped") {
            update_node_run_status(&mut node_runs, &node_id, "skipped", "", json!({}));
            sync_run_node(&mut run, &node_runs, &node_id);
            emitter.emit_node_update(&run, find_node_run(&node_runs, &node_id));
            continue;
        }

        let Some(node) = definition.nodes.iter().find(|item| item.id == node_id) else {
            clear_run_cancel_flag(&run.id);
            return Err("工作流节点不存在。".to_string());
        };

        let is_dirty = effective_dirty_nodes
            .as_ref()
            .map(|items| items.contains(&node_id))
            .unwrap_or(true);

        if find_unfinished_upstream_ids(&node_id, &definition.edges, &node_runs).is_some() {
            queue.push_back(node_id);
            deferred_passes += 1;
            if deferred_passes <= max_deferred_passes {
                continue;
            }
        }
        deferred_passes = 0;

        if !is_dirty {
            match hydrate_node_from_cache(node, &definition.edges, &outputs_by_node, cache_store) {
                Ok(cached_outputs) => {
                    outputs_by_node.insert(node.id.clone(), cached_outputs.clone());
                    states.insert(node.id.clone(), "succeeded".to_string());
                    update_node_run_status(&mut node_runs, &node.id, "succeeded", "", cached_outputs);
                    if let Some(node_run) = node_runs.iter_mut().find(|item| item.node_id == node.id) {
                        node_run.cache_hit = true;
                    }
                    sync_run_node(&mut run, &node_runs, &node.id);
                    emitter.emit_node_update(&run, find_node_run(&node_runs, &node.id));
                }
                Err(error) => {
                    states.insert(node.id.clone(), "skipped".to_string());
                    update_node_run_status(&mut node_runs, &node.id, "skipped", &error, json!({}));
                    sync_run_node(&mut run, &node_runs, &node.id);
                    emitter.emit_node_update(&run, find_node_run(&node_runs, &node.id));
                }
            }
            continue;
        }

        if let Some(missing) =
            find_missing_upstream_ids(&node.id, &definition.edges, &outputs_by_node)
        {
            let upstream_id = missing[0].clone();
            let error =
                format!("缺少上游节点「{upstream_id}」的输出，请先全量运行或确保缓存存在。");
            mark_failed_and_skip_dependents(&node.id, &error, &definition.edges, &mut states);
            update_node_run_status(&mut node_runs, &node.id, "failed", &error, json!({}));
            sync_run_node(&mut run, &node_runs, &node.id);
            emitter.emit_node_update(&run, find_node_run(&node_runs, &node.id));
            continue;
        }

        // 人工节点：执行到此优先消费已注入的决策；否则暂停并请求前端输入。
        if node.kind == MANUAL_GATE_NODE_KIND {
            let merged_inputs = resolve_merged_inputs(&node.id, &definition.edges, &outputs_by_node);
            if let Some(decision) = pending_decisions.remove(&node.id) {
                let outputs = build_manual_gate_outputs(&merged_inputs, &decision);
                let cache_key = compute_cache_key(&node.kind, &node.params, &merged_inputs);
                let _ = cache_store.set(&cache_key, &outputs);
                outputs_by_node.insert(node.id.clone(), outputs.clone());
                states.insert(node.id.clone(), "succeeded".to_string());
                set_node_running(&mut node_runs, &node.id);
                update_node_run_status(&mut node_runs, &node.id, "succeeded", "", outputs);
                sync_run_node(&mut run, &node_runs, &node.id);
                emitter.emit_node_update(&run, find_node_run(&node_runs, &node.id));
                continue;
            }

            // 暂停：标记 awaiting_input，请求前端输入，并把该节点放回队首供恢复时再处理。
            set_node_running(&mut node_runs, &node.id);
            set_node_awaiting_input(&mut node_runs, &node.id);
            states.insert(node.id.clone(), "awaiting_input".to_string());
            sync_run_node(&mut run, &node_runs, &node.id);
            emitter.emit_node_update(&run, find_node_run(&node_runs, &node.id));

            let gate_context = match resolve_manual_gate_context(node, &merged_inputs) {
                Ok(context) => context,
                Err(error) => {
                    mark_failed_and_skip_dependents(&node.id, &error, &definition.edges, &mut states);
                    update_node_run_status(&mut node_runs, &node.id, "failed", &error, json!({}));
                    sync_run_node(&mut run, &node_runs, &node.id);
                    emitter.emit_node_update(&run, find_node_run(&node_runs, &node.id));
                    continue;
                }
            };
            emitter.emit_node_input_required(
                &run,
                &node.id,
                &node.kind,
                gate_context,
            );

            let awaiting_node_id = node.id.clone();
            queue.push_front(awaiting_node_id.clone());
            return Ok((
                LoopStep::Paused {
                    node_id: awaiting_node_id,
                },
                repack(queue, outputs_by_node, states, node_runs, run, deferred_passes, pending_decisions),
            ));
        }

        set_node_running(&mut node_runs, &node.id);
        sync_run_node(&mut run, &node_runs, &node.id);
        emitter.emit_node_update(&run, find_node_run(&node_runs, &node.id));

        let merged_inputs = resolve_merged_inputs(&node.id, &definition.edges, &outputs_by_node);
        let cache_key = compute_cache_key(&node.kind, &node.params, &merged_inputs);

        let cached_outputs = cache_store.get(&cache_key);
        let node_id_for_progress = node.id.clone();
        let mut report_progress = |progress: u8| {
            report_node_progress(&node_id_for_progress, &mut node_runs, &mut run, emitter, progress);
        };
        let mut executor_context = ExecutorContext {
            app,
            project_root,
            report_progress: Some(&mut report_progress),
            cancel_flag: Some(cancel_flag.clone()),
        };
        let result = if let Some(outputs) = cached_outputs {
            Ok((outputs, true))
        } else {
            execute_node(&mut executor_context, node, &definition.edges, &outputs_by_node).map(
                |outputs| {
                    let _ = cache_store.set(&cache_key, &outputs);
                    (outputs, false)
                },
            )
        };

        match result {
            Ok((outputs, cache_hit)) => {
                outputs_by_node.insert(node.id.clone(), outputs.clone());
                states.insert(node.id.clone(), "succeeded".to_string());
                update_node_run_status(&mut node_runs, &node.id, "succeeded", "", outputs);
                if let Some(node_run) = node_runs.iter_mut().find(|item| item.node_id == node.id) {
                    node_run.cache_hit = cache_hit;
                }
                sync_run_node(&mut run, &node_runs, &node.id);
                emitter.emit_node_update(&run, find_node_run(&node_runs, &node.id));
            }
            Err(error) => {
                if is_run_canceled(cancel_flag) {
                    finalize_canceled_run(&mut run, &mut node_runs, &mut states, &node.id);
                    sync_run_node(&mut run, &node_runs, &node.id);
                    emitter.emit_node_update(&run, find_node_run(&node_runs, &node.id));
                    return Ok((
                        LoopStep::Completed,
                        repack(queue, outputs_by_node, states, node_runs, run, deferred_passes, pending_decisions),
                    ));
                }
                mark_failed_and_skip_dependents(&node.id, &error, &definition.edges, &mut states);
                update_node_run_status(&mut node_runs, &node.id, "failed", &error, json!({}));
                sync_run_node(&mut run, &node_runs, &node.id);
                emitter.emit_node_update(&run, find_node_run(&node_runs, &node.id));
            }
        }
    }

    Ok((
        LoopStep::Completed,
        repack(queue, outputs_by_node, states, node_runs, run, deferred_passes, pending_decisions),
    ))
}

/// 人工节点输出：透传输入，并附带用户选择与摘要，供下游节点读取。
fn build_manual_gate_outputs(merged_inputs: &Value, decision: &Value) -> Value {
    let mut output = if merged_inputs.is_object() {
        merged_inputs.clone()
    } else {
        json!({})
    };
    if let Some(object) = output.as_object_mut() {
        object.insert("manualSelection".to_string(), decision.clone());
        object.insert(
            "summary".to_string(),
            json!(format!("人工选择：{}", decision_summary(decision))),
        );
    }
    output
}

fn decision_summary(decision: &Value) -> String {
    match decision {
        Value::String(value) => value.clone(),
        Value::Array(items) => items
            .iter()
            .filter_map(|item| item.as_str().map(str::to_string))
            .collect::<Vec<_>>()
            .join("、"),
        other => other.to_string(),
    }
}

fn set_node_awaiting_input(node_runs: &mut [WorkflowNodeRun], node_id: &str) {
    if let Some(node_run) = node_runs.iter_mut().find(|item| item.node_id == node_id) {
        node_run.status = "awaiting_input".to_string();
        node_run.progress = 50;
        node_run.finished_at = None;
        push_node_log(node_run, "info", "node:awaiting", "等待人工选择。");
    }
}

fn finalize_canceled_run(
    run: &mut WorkflowRun,
    node_runs: &mut [WorkflowNodeRun],
    states: &mut std::collections::BTreeMap<String, String>,
    from_node_id: &str,
) {
    run.status = "canceled".to_string();
    run.error = "用户取消了运行。".to_string();

    for node_run in node_runs.iter_mut() {
        if node_run.status == "queued" || node_run.status == "running" {
            node_run.status = "canceled".to_string();
            node_run.error = "用户取消了运行。".to_string();
            node_run.finished_at = Some(current_timestamp());
            node_run.progress = 100;
            push_node_log(node_run, "warn", "node:cancel", "节点已取消。");
            states.insert(node_run.node_id.clone(), "canceled".to_string());
        }
    }

    if let Some(node_run) = node_runs.iter_mut().find(|item| item.node_id == from_node_id) {
        if node_run.status == "running" {
            node_run.status = "canceled".to_string();
            node_run.error = "用户取消了运行。".to_string();
            node_run.finished_at = Some(current_timestamp());
            node_run.progress = 100;
            push_node_log(node_run, "warn", "node:cancel", "节点已取消。");
        }
    }

    run.node_runs = node_runs.to_vec();
}

fn apply_partial_run_queued_cleanup(node_runs: &mut [WorkflowNodeRun]) {
    for node_run in node_runs.iter_mut() {
        if node_run.status == "queued" {
            node_run.status = "skipped".to_string();
            node_run.error = "未纳入本次运行。".to_string();
            node_run.finished_at = Some(current_timestamp());
            node_run.progress = 100;
            push_node_log(node_run, "info", "node:omit", "未纳入本次运行。");
        }
    }
}

fn apply_skipped_node_runs(
    node_runs: &mut [WorkflowNodeRun],
    states: &std::collections::BTreeMap<String, String>,
) {
    for node_run in node_runs.iter_mut() {
        if states.get(&node_run.node_id).map(String::as_str) == Some("skipped")
            && node_run.status == "queued"
        {
            node_run.status = "skipped".to_string();
            node_run.error = "上游节点失败，已跳过。".to_string();
            node_run.finished_at = Some(current_timestamp());
            node_run.progress = 100;
            push_node_log(node_run, "warn", "node:skip", "上游节点失败，已跳过。");
        }
    }
}

fn summarize_run_status(node_runs: &[WorkflowNodeRun]) -> String {
    let has_failed = node_runs.iter().any(|node| node.status == "failed");
    let has_skipped = node_runs.iter().any(|node| node.status == "skipped");

    if has_failed {
        "failed".to_string()
    } else if has_skipped {
        "partial".to_string()
    } else {
        "succeeded".to_string()
    }
}

fn sync_run_node(run: &mut WorkflowRun, node_runs: &[WorkflowNodeRun], node_id: &str) {
    run.node_runs = node_runs.to_vec();
    if let Some(index) = run.node_runs.iter().position(|item| item.node_id == node_id) {
        if let Some(node_run) = node_runs.iter().find(|item| item.node_id == node_id) {
            run.node_runs[index] = node_run.clone();
        }
    }
}

fn find_node_run<'a>(node_runs: &'a [WorkflowNodeRun], node_id: &str) -> &'a WorkflowNodeRun {
    node_runs
        .iter()
        .find(|item| item.node_id == node_id)
        .expect("node run must exist")
}

fn report_node_progress(
    node_id: &str,
    node_runs: &mut [WorkflowNodeRun],
    run: &mut WorkflowRun,
    emitter: &WorkflowEventEmitter<'_>,
    progress: u8,
) {
    if let Some(node_run) = node_runs.iter_mut().find(|item| item.node_id == node_id) {
        if node_run.status == "running" {
            node_run.progress = progress.min(99);
        }
    }
    sync_run_node(run, node_runs, node_id);
    emitter.emit_node_update(run, find_node_run(node_runs, node_id));
}

fn set_node_running(node_runs: &mut [WorkflowNodeRun], node_id: &str) {
    if let Some(node_run) = node_runs.iter_mut().find(|item| item.node_id == node_id) {
        node_run.status = "running".to_string();
        node_run.started_at = Some(current_timestamp());
        node_run.progress = 5;
        push_node_log(node_run, "info", "node:start", "节点开始执行。");
    }
}

fn update_node_run_status(
    node_runs: &mut [WorkflowNodeRun],
    node_id: &str,
    status: &str,
    error: &str,
    outputs: Value,
) {
    if let Some(node_run) = node_runs.iter_mut().find(|item| item.node_id == node_id) {
        node_run.status = status.to_string();
        node_run.error = error.to_string();
        node_run.output_summary = summarize_outputs(&outputs);
        node_run.outputs = outputs;
        let finished_at = current_timestamp();
        node_run.finished_at = Some(finished_at);
        node_run.duration_ms = node_run
            .started_at
            .map(|started_at| (finished_at - started_at).max(0) * 1000);
        node_run.progress = if status == "running" { 50 } else { 100 };
        match status {
            "succeeded" => push_node_log(node_run, "info", "node:success", "节点执行完成。"),
            "failed" => push_node_log(
                node_run,
                "error",
                "node:error",
                if error.is_empty() { "节点执行失败。" } else { error },
            ),
            "skipped" => push_node_log(
                node_run,
                "warn",
                "node:skip",
                if error.is_empty() { "节点已跳过。" } else { error },
            ),
            "canceled" => push_node_log(node_run, "warn", "node:cancel", "节点已取消。"),
            _ => {}
        }
    }
}

fn push_node_log(node_run: &mut WorkflowNodeRun, level: &str, event: &str, message: &str) {
    node_run.logs.push(WorkflowRunLog {
        timestamp: current_timestamp(),
        level: level.to_string(),
        event: event.to_string(),
        node_id: node_run.node_id.clone(),
        message: message.to_string(),
    });
}

fn summarize_outputs(outputs: &Value) -> String {
    if let Some(summary) = outputs.pointer("/summary").and_then(Value::as_str) {
        if !summary.trim().is_empty() {
            return summary.trim().to_string();
        }
    }

    if outputs.get("character").is_some() {
        return "角色记录已更新。".to_string();
    }

    if let Some(path) = outputs.pointer("/image/path").and_then(Value::as_str) {
        return format!("图片：{path}");
    }

    if let Some(path) = outputs
        .pointer("/toolResult/outputImage/projectRelativePath")
        .and_then(Value::as_str)
    {
        return format!("工具输出：{path}");
    }

    if let Some(path) = outputs.pointer("/asset/path").and_then(Value::as_str) {
        return format!("导出：{path}");
    }

    if let Some(kind) = outputs.pointer("/asset/kind").and_then(Value::as_str) {
        return format!("Asset：{kind}");
    }

    if let Some(prompt) = outputs.pointer("/prompt/text").and_then(Value::as_str) {
        return format!("提示词：{}", truncate_summary(prompt));
    }

    if let Some(object) = outputs.as_object() {
        if object.is_empty() {
            return String::new();
        }

        return object.keys().cloned().collect::<Vec<_>>().join("、");
    }

    String::new()
}

fn truncate_summary(value: &str) -> String {
    if value.chars().count() <= 48 {
        return value.to_string();
    }

    format!("{}…", value.chars().take(48).collect::<String>())
}
