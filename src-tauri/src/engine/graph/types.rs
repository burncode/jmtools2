use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowDefinition {
    pub id: String,
    pub name: String,
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub nodes: Vec<WorkflowNodeInput>,
    #[serde(default)]
    pub edges: Vec<WorkflowEdgeInput>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub viewport: Value,
    #[serde(default)]
    pub selected_template: String,
    #[serde(default)]
    pub ui_state: Value,
    #[serde(default)]
    pub groups: Vec<WorkflowGroupInput>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowGroupInput {
    pub id: String,
    pub label: String,
    #[serde(default = "default_node_position")]
    pub position: WorkflowNodePosition,
    #[serde(default = "default_group_size")]
    pub size: WorkflowGroupSize,
    #[serde(default)]
    pub collapsed: bool,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub color: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowGroupSize {
    #[serde(default = "default_group_width")]
    pub width: f64,
    #[serde(default = "default_group_height")]
    pub height: f64,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowNodeInput {
    pub id: String,
    pub kind: String,
    #[serde(default)]
    pub params: Value,
    #[serde(default = "default_node_position")]
    pub position: WorkflowNodePosition,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_group_id: Option<String>,
    #[serde(default)]
    pub collapsed: bool,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub accent_color: String,
}

impl Default for WorkflowNodeInput {
    fn default() -> Self {
        Self {
            id: String::new(),
            kind: String::new(),
            params: Value::Null,
            position: default_node_position(),
            parent_group_id: None,
            collapsed: false,
            accent_color: String::new(),
        }
    }
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowNodePosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowEdgeInput {
    pub id: String,
    pub from_node_id: String,
    pub to_node_id: String,
    #[serde(default = "default_from_port")]
    pub from_port: String,
    #[serde(default = "default_to_port")]
    pub to_port: String,
    #[serde(default = "default_edge_data_type")]
    pub data_type: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRun {
    pub id: String,
    pub workflow_id: String,
    pub workflow_name: String,
    pub status: String,
    #[serde(default)]
    pub node_runs: Vec<WorkflowNodeRun>,
    pub started_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<i64>,
    #[serde(default)]
    pub error: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowNodeRun {
    pub node_id: String,
    pub node_kind: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<i64>,
    #[serde(default)]
    pub error: String,
    #[serde(default)]
    pub outputs: Value,
    #[serde(default)]
    pub logs: Vec<WorkflowRunLog>,
    #[serde(default)]
    pub duration_ms: Option<i64>,
    #[serde(default)]
    pub progress: u8,
    #[serde(default)]
    pub cache_hit: bool,
    #[serde(default)]
    pub output_summary: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRunLog {
    pub timestamp: i64,
    pub level: String,
    pub event: String,
    #[serde(default)]
    pub node_id: String,
    pub message: String,
}

pub fn default_schema_version() -> u32 {
    1
}

pub fn default_node_position() -> WorkflowNodePosition {
    WorkflowNodePosition { x: 0.0, y: 0.0 }
}

pub fn default_from_port() -> String {
    "output".to_string()
}

pub fn default_to_port() -> String {
    "input".to_string()
}

pub fn default_edge_data_type() -> String {
    "asset".to_string()
}

pub fn default_group_width() -> f64 {
    320.0
}

pub fn default_group_height() -> f64 {
    240.0
}

pub fn default_group_size() -> WorkflowGroupSize {
    WorkflowGroupSize {
        width: default_group_width(),
        height: default_group_height(),
    }
}
