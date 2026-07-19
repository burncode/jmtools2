use std::collections::{BTreeSet, HashMap};
use std::path::Path;

use serde_json::Value;

use super::types::{WorkflowDefinition, WorkflowEdgeInput, WorkflowNodeInput, WorkflowNodeRun};
use crate::engine::cache::{compute_cache_key, WorkflowCacheStore};
use crate::engine::graph::ports::resolve_merged_inputs;
use crate::engine::scheduler::build_topological_order;

pub fn preflight_workflow_run(
    definition: &WorkflowDefinition,
    project_root: &Path,
    dirty_node_ids: Option<&[String]>,
) -> Result<(), String> {
    let order = build_topological_order(&definition.nodes, &definition.edges)?;
    let dirty_nodes = dirty_node_ids
        .filter(|items| !items.is_empty())
        .map(|items| items.iter().cloned().collect::<BTreeSet<_>>());

    if dirty_nodes.is_none() {
        return Ok(());
    }

    let dirty_nodes = dirty_nodes.expect("dirty nodes checked");
    let cache_store = WorkflowCacheStore::new(project_root, &definition.id);
    let mut outputs_by_node: HashMap<String, Value> = HashMap::new();

    for node_id in order {
        let Some(node) = definition.nodes.iter().find(|item| item.id == node_id) else {
            continue;
        };

        if !dirty_nodes.contains(&node_id) {
            match hydrate_node_from_cache(node, &definition.edges, &outputs_by_node, &cache_store) {
                Ok(outputs) => {
                    outputs_by_node.insert(node_id, outputs);
                }
                Err(error) => {
                    if is_upstream_of_dirty_node(&node_id, &definition.edges, &dirty_nodes) {
                        return Err(error);
                    }
                }
            }
            continue;
        }

        if let Some(missing) = find_missing_upstream_ids(&node_id, &definition.edges, &outputs_by_node) {
            let upstream_id = missing[0].clone();
            return Err(format!(
                "缺少上游节点「{upstream_id}」的输出，请先全量运行或确保缓存存在。"
            ));
        }
    }

    Ok(())
}

fn is_upstream_of_dirty_node(
    node_id: &str,
    edges: &[WorkflowEdgeInput],
    dirty_nodes: &BTreeSet<String>,
) -> bool {
    let mut visited = BTreeSet::new();
    let mut queue = vec![node_id.to_string()];

    while let Some(current) = queue.pop() {
        for edge in edges.iter().filter(|item| item.from_node_id == current) {
            if dirty_nodes.contains(&edge.to_node_id) {
                return true;
            }

            if visited.insert(edge.to_node_id.clone()) {
                queue.push(edge.to_node_id.clone());
            }
        }
    }

    false
}

pub fn hydrate_node_from_cache(
    node: &WorkflowNodeInput,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
    cache_store: &WorkflowCacheStore,
) -> Result<Value, String> {
    if let Some(missing) = find_missing_upstream_ids(&node.id, edges, outputs_by_node) {
        let upstream_id = missing[0].clone();
        return Err(format!(
            "缺少上游节点「{upstream_id}」的输出，请先全量运行或确保缓存存在。"
        ));
    }

    let merged_inputs = resolve_merged_inputs(&node.id, edges, outputs_by_node);
    let cache_key = compute_cache_key(&node.kind, &node.params, &merged_inputs);

    cache_store.get(&cache_key).ok_or_else(|| {
        format!(
            "节点「{}」缺少缓存输出，请先全量运行该节点。",
            node.id
        )
    })
}

pub fn find_unfinished_upstream_ids(
    node_id: &str,
    edges: &[WorkflowEdgeInput],
    node_runs: &[WorkflowNodeRun],
) -> Option<Vec<String>> {
    let unfinished = edges
        .iter()
        .filter(|edge| edge.to_node_id == node_id)
        .filter_map(|edge| {
            let upstream = node_runs
                .iter()
                .find(|run| run.node_id == edge.from_node_id)?;
            match upstream.status.as_str() {
                "succeeded" => None,
                "failed" | "skipped" | "canceled" => None,
                _ => Some(edge.from_node_id.clone()),
            }
        })
        .collect::<Vec<_>>();

    if unfinished.is_empty() {
        None
    } else {
        Some(unfinished)
    }
}

pub fn find_missing_upstream_ids(
    node_id: &str,
    edges: &[WorkflowEdgeInput],
    outputs_by_node: &HashMap<String, Value>,
) -> Option<Vec<String>> {
    let missing = edges
        .iter()
        .filter(|edge| edge.to_node_id == node_id)
        .filter(|edge| !outputs_by_node.contains_key(&edge.from_node_id))
        .map(|edge| edge.from_node_id.clone())
        .collect::<Vec<_>>();

    if missing.is_empty() {
        None
    } else {
        Some(missing)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::graph::types::default_node_position;
    use serde_json::json;

    fn edge(from: &str, to: &str) -> WorkflowEdgeInput {
        WorkflowEdgeInput {
            id: format!("{from}-{to}"),
            from_node_id: from.to_string(),
            to_node_id: to.to_string(),
            from_port: "output".to_string(),
            to_port: "input".to_string(),
            data_type: "asset".to_string(),
        }
    }

    fn node(id: &str, kind: &str) -> WorkflowNodeInput {
        WorkflowNodeInput {
            id: id.to_string(),
            kind: kind.to_string(),
            params: json!({}),
            position: default_node_position(),
            ..Default::default()
        }
    }

    #[test]
    fn find_unfinished_upstream_ids_blocks_running_upstream() {
        use crate::engine::graph::types::WorkflowNodeRun;

        let edges = vec![edge("a", "b")];
        let node_runs = vec![
            WorkflowNodeRun {
                node_id: "a".to_string(),
                node_kind: "test".to_string(),
                status: "running".to_string(),
                started_at: None,
                finished_at: None,
                error: String::new(),
                outputs: json!({}),
                logs: Vec::new(),
                duration_ms: None,
                progress: 5,
                cache_hit: false,
                output_summary: String::new(),
            },
            WorkflowNodeRun {
                node_id: "b".to_string(),
                node_kind: "test".to_string(),
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
            },
        ];

        let unfinished =
            find_unfinished_upstream_ids("b", &edges, &node_runs).expect("unfinished upstream");

        assert_eq!(unfinished, vec!["a".to_string()]);
    }

    #[test]
    fn find_missing_upstream_ids_reports_first_missing_edge() {
        let edges = vec![edge("a", "b")];
        let outputs = HashMap::new();

        let missing = find_missing_upstream_ids("b", &edges, &outputs).expect("missing upstream");

        assert_eq!(missing, vec!["a".to_string()]);
    }

    #[test]
    fn preflight_partial_run_fails_when_upstream_cache_missing() {
        let definition = WorkflowDefinition {
            id: "wf-test".to_string(),
            name: "测试".to_string(),
            schema_version: 1,
            description: String::new(),
            nodes: vec![
                node("a", "image.input"),
                node("b", "preview.image"),
            ],
            edges: vec![edge("a", "b")],
            groups: Vec::new(),
            created_at: String::new(),
            updated_at: String::new(),
            viewport: json!({}),
            selected_template: String::new(),
            ui_state: json!({}),
        };

        let temp = std::env::temp_dir().join(format!("jmtools-preflight-{}", std::process::id()));
        std::fs::create_dir_all(&temp).expect("tempdir");
        let project_root = temp.join("project");
        std::fs::create_dir_all(&project_root).expect("project dir");
        std::fs::write(project_root.join("jmproject.json"), "{}").expect("manifest");

        let error = preflight_workflow_run(&definition, &project_root, Some(&["b".to_string()]))
            .expect_err("preflight should fail without upstream cache");

        assert!(error.contains("缺少缓存") || error.contains("缺少上游节点"));
        let _ = std::fs::remove_dir_all(temp);
    }

    #[test]
    fn preflight_partial_run_passes_when_upstream_cache_exists() {
        let definition = WorkflowDefinition {
            id: "wf-test".to_string(),
            name: "测试".to_string(),
            schema_version: 1,
            description: String::new(),
            nodes: vec![
                node("a", "image.input"),
                node("b", "preview.image"),
            ],
            edges: vec![edge("a", "b")],
            groups: Vec::new(),
            created_at: String::new(),
            updated_at: String::new(),
            viewport: json!({}),
            selected_template: String::new(),
            ui_state: json!({}),
        };

        let temp = std::env::temp_dir().join(format!("jmtools-preflight-ok-{}", std::process::id()));
        let project_root = temp.join("project");
        std::fs::create_dir_all(&project_root).expect("project dir");
        std::fs::write(project_root.join("jmproject.json"), "{}").expect("manifest");

        let cache_store = WorkflowCacheStore::new(&project_root, "wf-test");
        let merged_inputs = resolve_merged_inputs("a", &definition.edges, &HashMap::new());
        let cache_key = compute_cache_key("image.input", &json!({}), &merged_inputs);
        cache_store
            .set(&cache_key, &json!({ "image": { "path": "assets/test.png" } }))
            .expect("seed cache");

        preflight_workflow_run(&definition, &project_root, Some(&["b".to_string()]))
            .expect("preflight should pass with upstream cache");

        let _ = std::fs::remove_dir_all(temp);
    }
}
