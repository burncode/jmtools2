use std::collections::HashMap;

use serde_json::{json, Value};

use super::types::WorkflowEdgeInput;

pub fn resolve_merged_inputs(
    node_id: &str,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Value {
    let mut merged = json!({});

    for edge in edges.iter().filter(|edge| edge.to_node_id == node_id) {
        let Some(upstream) = outputs_by_node.get(&edge.from_node_id) else {
            continue;
        };

        if let Some(port_value) = upstream.get(&edge.from_port) {
            merged[&edge.to_port] = port_value.clone();
            if edge.to_port == "input" {
                merged[&edge.from_port] = port_value.clone();
            }
            continue;
        }

        if edge.from_port == "output" {
            merged[&edge.to_port] = upstream.clone();
        }
    }

    merged
}

pub fn resolve_pass_through_output(
    node_id: &str,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Option<Value> {
    let incoming = edges
        .iter()
        .filter(|edge| edge.to_node_id == node_id)
        .collect::<Vec<_>>();

    if incoming.is_empty() {
        return None;
    }

    let mut result = outputs_by_node.get(&incoming[0].from_node_id)?.clone();

    for edge in incoming.iter().skip(1) {
        let Some(upstream) = outputs_by_node.get(&edge.from_node_id) else {
            continue;
        };

        if let (Value::Object(result_map), Value::Object(upstream_map)) =
            (&mut result, upstream)
        {
            for (key, value) in upstream_map {
                result_map.insert(key.clone(), value.clone());
            }
        }
    }

    Some(result)
}
