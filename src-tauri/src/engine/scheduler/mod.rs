use std::collections::{BTreeMap, VecDeque};

use crate::engine::graph::types::{WorkflowEdgeInput, WorkflowNodeInput};

pub fn build_topological_order(
    nodes: &[WorkflowNodeInput],
    edges: &[WorkflowEdgeInput],
) -> Result<Vec<String>, String> {
    let mut indegrees = nodes
        .iter()
        .map(|node| (node.id.clone(), 0_usize))
        .collect::<BTreeMap<_, _>>();
    let mut outgoing: BTreeMap<String, Vec<String>> = BTreeMap::new();

    for edge in edges {
        if !indegrees.contains_key(&edge.from_node_id) || !indegrees.contains_key(&edge.to_node_id)
        {
            return Err("工作流连线引用了不存在的节点。".to_string());
        }

        *indegrees.entry(edge.to_node_id.clone()).or_default() += 1;
        outgoing
            .entry(edge.from_node_id.clone())
            .or_default()
            .push(edge.to_node_id.clone());
    }

    let mut queue = nodes
        .iter()
        .filter(|node| indegrees.get(&node.id).copied().unwrap_or_default() == 0)
        .map(|node| node.id.clone())
        .collect::<VecDeque<_>>();
    let mut order = Vec::with_capacity(nodes.len());

    while let Some(node_id) = queue.pop_front() {
        order.push(node_id.clone());

        for next_node_id in outgoing.get(&node_id).cloned().unwrap_or_default() {
            let Some(indegree) = indegrees.get_mut(&next_node_id) else {
                continue;
            };

            *indegree = indegree.saturating_sub(1);
            if *indegree == 0 {
                queue.push_back(next_node_id);
            }
        }
    }

    if order.len() != nodes.len() {
        return Err("工作流不能包含循环依赖。".to_string());
    }

    Ok(order)
}

pub fn initialize_node_states(nodes: &[WorkflowNodeInput]) -> BTreeMap<String, String> {
    nodes
        .iter()
        .map(|node| (node.id.clone(), "queued".to_string()))
        .collect()
}

pub fn mark_failed_and_skip_dependents(
    node_id: &str,
    _error: &str,
    edges: &[WorkflowEdgeInput],
    states: &mut BTreeMap<String, String>,
) {
    states.insert(node_id.to_string(), "failed".to_string());
    let mut queue = VecDeque::from([node_id.to_string()]);

    while let Some(current_node_id) = queue.pop_front() {
        for edge in edges
            .iter()
            .filter(|edge| edge.from_node_id == current_node_id)
        {
            if states.get(&edge.to_node_id).map(String::as_str) == Some("failed") {
                continue;
            }

            states.insert(edge.to_node_id.clone(), "skipped".to_string());
            queue.push_back(edge.to_node_id.clone());
        }
    }
}

pub fn collect_downstream_node_ids(node_id: &str, edges: &[WorkflowEdgeInput]) -> Vec<String> {
    let mut visited = BTreeMap::new();
    let mut queue = VecDeque::from([node_id.to_string()]);

    while let Some(current) = queue.pop_front() {
        for edge in edges.iter().filter(|edge| edge.from_node_id == current) {
            if visited.insert(edge.to_node_id.clone(), true).is_none() {
                queue.push_back(edge.to_node_id.clone());
            }
        }
    }

    visited.keys().cloned().collect()
}
