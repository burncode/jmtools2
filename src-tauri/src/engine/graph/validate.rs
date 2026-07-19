use std::collections::HashMap;

use crate::engine::registry::get_node_descriptor;

use super::types::WorkflowDefinition;

pub const SUPPORTED_WORKFLOW_SCHEMA_VERSION: u32 = 1;

pub fn validate_workflow_definition(definition: &WorkflowDefinition) -> Result<(), String> {
    validate_identifier(&definition.id, "工作流 ID")?;

    if definition.name.trim().is_empty() {
        return Err("工作流名称不能为空。".to_string());
    }

    if definition.nodes.is_empty() {
        return Err("工作流至少需要一个节点。".to_string());
    }

    for node in &definition.nodes {
        validate_identifier(&node.id, "节点 ID")?;
        if node.kind.trim().is_empty() {
            return Err("节点类型不能为空。".to_string());
        }
    }

    for edge in &definition.edges {
        validate_identifier(&edge.id, "连线 ID")?;
        validate_identifier(&edge.from_node_id, "起点节点 ID")?;
        validate_identifier(&edge.to_node_id, "终点节点 ID")?;
        validate_identifier(&edge.from_port, "起点端口 ID")?;
        validate_identifier(&edge.to_port, "终点端口 ID")?;
        if edge.data_type.trim().is_empty() {
            return Err("连线数据类型不能为空。".to_string());
        }
    }

    validate_node_kinds_and_ports(definition)?;

    Ok(())
}

/// 校验节点 kind 是否在 registry 中且已启用，并校验每条连线引用的端口存在且类型兼容。
/// save / run / import 共用，确保保存或运行时不会写入非法 kind 或悬空端口。
fn validate_node_kinds_and_ports(definition: &WorkflowDefinition) -> Result<(), String> {
    let node_kinds: HashMap<String, String> = definition
        .nodes
        .iter()
        .map(|node| (node.id.clone(), node.kind.clone()))
        .collect();

    for node in &definition.nodes {
        let descriptor = get_node_descriptor(&node.kind)?
            .ok_or_else(|| format!("未知或未启用的节点类型「{}」。", node.kind))?;

        if descriptor.status != "available" {
            return Err(format!("节点类型「{}」尚未启用。", node.kind));
        }
    }

    for edge in &definition.edges {
        let from_kind = node_kinds.get(&edge.from_node_id).ok_or_else(|| {
            format!(
                "连线「{}」引用了不存在的起点节点「{}」。",
                edge.id, edge.from_node_id
            )
        })?;
        let to_kind = node_kinds.get(&edge.to_node_id).ok_or_else(|| {
            format!(
                "连线「{}」引用了不存在的终点节点「{}」。",
                edge.id, edge.to_node_id
            )
        })?;

        let from_descriptor = get_node_descriptor(from_kind)?
            .ok_or_else(|| format!("未知节点类型「{}」。", from_kind))?;
        let to_descriptor = get_node_descriptor(to_kind)?
            .ok_or_else(|| format!("未知节点类型「{}」。", to_kind))?;

        let from_port = from_descriptor
            .outputs
            .iter()
            .find(|port| port.id == edge.from_port)
            .ok_or_else(|| {
                format!(
                    "节点「{}」不存在输出端口「{}」。",
                    edge.from_node_id, edge.from_port
                )
            })?;
        let to_port = to_descriptor
            .inputs
            .iter()
            .find(|port| port.id == edge.to_port)
            .ok_or_else(|| {
                format!(
                    "节点「{}」不存在输入端口「{}」。",
                    edge.to_node_id, edge.to_port
                )
            })?;

        if !are_port_kinds_compatible(&from_port.kind, &to_port.kind) {
            return Err(format!(
                "连线「{}」端口类型不兼容（{} → {}）。",
                edge.id, from_port.kind, to_port.kind
            ));
        }
    }

    Ok(())
}

pub fn validate_workflow_import(definition: &WorkflowDefinition) -> Result<(), String> {
    if definition.schema_version > SUPPORTED_WORKFLOW_SCHEMA_VERSION {
        return Err(format!(
            "导入失败：不支持的工作流 schema 版本 {}（当前最高支持 {}）。",
            definition.schema_version, SUPPORTED_WORKFLOW_SCHEMA_VERSION
        ));
    }

    validate_workflow_definition(definition)?;

    for group in &definition.groups {
        validate_identifier(&group.id, "编组 ID")?;
    }

    Ok(())
}

fn are_port_kinds_compatible(source_kind: &str, target_kind: &str) -> bool {
    if source_kind == target_kind {
        return true;
    }

    matches!(
        (source_kind, target_kind),
        ("asset", "character")
            | ("asset", "image")
            | ("asset", "toolResult")
            | ("character", "asset")
            | ("image", "toolResult")
            | ("image", "asset")
            | ("toolResult", "image")
            | ("toolResult", "asset")
    )
}

pub fn validate_identifier(value: &str, label: &str) -> Result<String, String> {
    let normalized = value.trim();

    if normalized.is_empty() {
        return Err(format!("{label}不能为空。"));
    }

    if !normalized
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
    {
        return Err(format!("{label}只能包含字母、数字、短横线和下划线。"));
    }

    Ok(normalized.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::graph::types::{WorkflowEdgeInput, WorkflowNodeInput};

    #[test]
    fn import_rejects_unknown_node_kind() {
        let definition = WorkflowDefinition {
            id: "demo-flow".to_string(),
            name: "Demo".to_string(),
            schema_version: 1,
            description: String::new(),
            nodes: vec![WorkflowNodeInput {
                id: "node-a".to_string(),
                kind: "unknown.node".to_string(),
                ..WorkflowNodeInput::default()
            }],
            edges: vec![],
            created_at: String::new(),
            updated_at: String::new(),
            viewport: serde_json::Value::Null,
            selected_template: String::new(),
            ui_state: serde_json::Value::Null,
            groups: vec![],
        };

        let error = validate_workflow_import(&definition).expect_err("unknown kind should fail");
        assert!(error.contains("unknown.node"));
    }

    #[test]
    fn import_rejects_missing_edge_node() {
        let definition = WorkflowDefinition {
            id: "demo-flow".to_string(),
            name: "Demo".to_string(),
            schema_version: 1,
            description: String::new(),
            nodes: vec![WorkflowNodeInput {
                id: "seed-node".to_string(),
                kind: "character.inputSeed".to_string(),
                ..WorkflowNodeInput::default()
            }],
            edges: vec![WorkflowEdgeInput {
                id: "edge-1".to_string(),
                from_node_id: "seed-node".to_string(),
                to_node_id: "missing-node".to_string(),
                from_port: "asset".to_string(),
                to_port: "characterSeed".to_string(),
                data_type: "asset".to_string(),
            }],
            created_at: String::new(),
            updated_at: String::new(),
            viewport: serde_json::Value::Null,
            selected_template: String::new(),
            ui_state: serde_json::Value::Null,
            groups: vec![],
        };

        let error = validate_workflow_import(&definition).expect_err("missing node should fail");
        assert!(error.contains("missing-node"));
    }
}
