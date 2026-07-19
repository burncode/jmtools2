use serde::{Deserialize, Serialize};
use serde_json::Value;

const NODE_DESCRIPTORS_JSON: &str =
    include_str!("../../../../shared/workflow-nodes/nodes.json");

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowNodeDescriptor {
    pub id: String,
    pub label: String,
    pub category: String,
    pub color: String,
    pub description: String,
    pub help_text: String,
    pub status: String,
    #[serde(default)]
    pub layer: String,
    #[serde(default)]
    pub param_groups: Vec<WorkflowParamGroupDescriptor>,
    #[serde(default)]
    pub inputs: Vec<WorkflowPortDescriptor>,
    #[serde(default)]
    pub outputs: Vec<WorkflowPortDescriptor>,
    #[serde(default)]
    pub params: Vec<WorkflowParamDescriptor>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowParamGroupDescriptor {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowPortDescriptor {
    pub id: String,
    pub kind: String,
    pub label: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowParamDescriptor {
    pub id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub param_type: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub group: String,
    #[serde(default)]
    pub default_value: Value,
    #[serde(default)]
    pub options: Vec<WorkflowParamOption>,
    #[serde(default)]
    pub min: Option<f64>,
    #[serde(default)]
    pub max: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub widget: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub binding: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display: Option<String>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub advanced: bool,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub required: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowParamOption {
    pub label: String,
    pub value: String,
}

pub fn list_node_descriptors() -> Result<Vec<WorkflowNodeDescriptor>, String> {
    serde_json::from_str(NODE_DESCRIPTORS_JSON)
        .map_err(|error| format!("解析工作流节点描述符失败：{error}"))
}

pub fn get_node_descriptor(node_id: &str) -> Result<Option<WorkflowNodeDescriptor>, String> {
    Ok(list_node_descriptors()?
        .into_iter()
        .find(|descriptor| descriptor.id == node_id))
}
