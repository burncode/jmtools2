use std::collections::HashMap;

use serde_json::{json, Value};

use crate::engine::graph::ports::resolve_merged_inputs;
use crate::engine::graph::types::{WorkflowEdgeInput, WorkflowNodeInput};
use crate::engine::workflow_assets::{asset_data, wrap_asset, KIND_CONTROL_PROFILE};

pub fn execute_control_domain_node(
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    match node.kind.as_str() {
        "control.consistencyLock" => execute_consistency_lock_node(node, edges, outputs_by_node),
        "control.referenceStrength" => execute_reference_strength_node(node),
        "control.seedLock" => execute_seed_lock_node(node),
        _ => Err("未知控制域节点。".to_string()),
    }
}

fn execute_consistency_lock_node(
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Result<Value, String> {
    let inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let style_lock = string_param(node, "styleLock", "true") != "false";
    let mut hash_source = String::new();

    for key in ["characterSeed", "styleProfile"] {
        if let Some(value) = inputs.get(key).and_then(asset_data) {
            hash_source.push_str(&value.to_string());
        }
    }

    if hash_source.is_empty() {
        hash_source = string_param(node, "fallbackKey", "workflow");
    }

    let consistency_hash = format!("{:016x}", stable_hash(&hash_source));

    Ok(wrap_asset(
        KIND_CONTROL_PROFILE,
        json!({
            "consistencyHash": consistency_hash,
            "styleLock": style_lock,
        }),
    ))
}

fn execute_reference_strength_node(node: &WorkflowNodeInput) -> Result<Value, String> {
    let strength = node
        .params
        .get("strength")
        .and_then(Value::as_f64)
        .unwrap_or(0.8)
        .clamp(0.0, 1.0);

    Ok(wrap_asset(
        KIND_CONTROL_PROFILE,
        json!({
            "referenceStrength": strength,
        }),
    ))
}

fn execute_seed_lock_node(node: &WorkflowNodeInput) -> Result<Value, String> {
    let seed = node
        .params
        .get("seed")
        .and_then(Value::as_u64)
        .unwrap_or(42);

    Ok(wrap_asset(
        KIND_CONTROL_PROFILE,
        json!({
            "seed": seed,
            "seedLock": true,
        }),
    ))
}

fn stable_hash(input: &str) -> u64 {
    input.bytes().fold(0_u64, |hash, byte| {
        hash.wrapping_mul(16777619).wrapping_add(u64::from(byte))
    })
}

fn string_param(node: &WorkflowNodeInput, key: &str, default: &str) -> String {
    node.params
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(default)
        .to_string()
}
