mod output_sanitize;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::engine::graph::types::{WorkflowNodeRun, WorkflowRun};

pub use output_sanitize::{outputs_empty, sanitize_node_outputs_for_event};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRunEventPayload {
    pub run_id: String,
    pub workflow_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowManualOption {
    pub label: String,
    pub value: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowManualPreviewImage {
    pub plan_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_relative_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub absolute_path: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowNodeInputRequiredPayload {
    pub run_id: String,
    pub workflow_id: String,
    pub node_id: String,
    pub node_kind: String,
    pub prompt: String,
    pub options: Vec<WorkflowManualOption>,
    pub allow_multiple: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub preview_images: Vec<WorkflowManualPreviewImage>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowNodeEventPayload {
    pub run_id: String,
    pub workflow_id: String,
    pub node_id: String,
    pub node_kind: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress: Option<u8>,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub error: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub output_summary: String,
    #[serde(skip_serializing_if = "outputs_empty")]
    pub outputs: Value,
}

pub struct WorkflowEventEmitter<'a> {
    app: Option<&'a AppHandle>,
}

impl<'a> WorkflowEventEmitter<'a> {
    pub fn new(app: Option<&'a AppHandle>) -> Self {
        Self { app }
    }

    pub fn emit_run_started(&self, run: &WorkflowRun) {
        self.emit(
            "workflow://run_started",
            WorkflowRunEventPayload {
                run_id: run.id.clone(),
                workflow_id: run.workflow_id.clone(),
            },
        );
    }

    pub fn emit_node_update(&self, run: &WorkflowRun, node_run: &WorkflowNodeRun) {
        let outputs = if node_run.status == "succeeded" {
            sanitize_node_outputs_for_event(&node_run.outputs)
        } else {
            json!({})
        };

        self.emit(
            "workflow://node_update",
            WorkflowNodeEventPayload {
                run_id: run.id.clone(),
                workflow_id: run.workflow_id.clone(),
                node_id: node_run.node_id.clone(),
                node_kind: node_run.node_kind.clone(),
                status: node_run.status.clone(),
                progress: Some(node_run.progress),
                error: node_run.error.clone(),
                output_summary: node_run.output_summary.clone(),
                outputs,
            },
        );
    }

    pub fn emit_node_input_required(
        &self,
        run: &WorkflowRun,
        node_id: &str,
        node_kind: &str,
        context: crate::engine::manual_gate::ManualGateContext,
    ) {
        self.emit(
            "workflow://node_input_required",
            WorkflowNodeInputRequiredPayload {
                run_id: run.id.clone(),
                workflow_id: run.workflow_id.clone(),
                node_id: node_id.to_string(),
                node_kind: node_kind.to_string(),
                prompt: context.prompt,
                options: context.options,
                allow_multiple: context.allow_multiple,
                preview_images: context.preview_images,
            },
        );
    }

    pub fn emit_run_finished(&self, run: &WorkflowRun) {
        self.emit(
            "workflow://run_finished",
            WorkflowRunEventPayload {
                run_id: run.id.clone(),
                workflow_id: run.workflow_id.clone(),
            },
        );
    }

    fn emit<T: Serialize + Clone>(&self, event: &str, payload: T) {
        if let Some(app) = self.app {
            let _ = app.emit(event, payload);
        }
    }
}
