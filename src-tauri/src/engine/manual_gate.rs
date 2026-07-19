use serde_json::Value;

use crate::character::CharacterMasterCandidateImage;
use crate::engine::events::{WorkflowManualOption, WorkflowManualPreviewImage};
use crate::engine::graph::types::WorkflowNodeInput;
use crate::engine::workflow_assets::{asset_data, asset_kind, KIND_CANDIDATE_IMAGES};

pub const OPTIONS_SOURCE_STATIC: &str = "static";
pub const OPTIONS_SOURCE_CANDIDATE_IMAGES: &str = "candidateImages";

#[derive(Clone)]
pub struct ManualGateContext {
    pub allow_multiple: bool,
    pub options: Vec<WorkflowManualOption>,
    pub preview_images: Vec<WorkflowManualPreviewImage>,
    pub prompt: String,
}

pub fn manual_gate_options_source(node: &WorkflowNodeInput) -> &str {
    node.params
        .get("optionsSource")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(OPTIONS_SOURCE_STATIC)
}

pub fn resolve_manual_gate_context(
    node: &WorkflowNodeInput,
    merged_inputs: &Value,
) -> Result<ManualGateContext, String> {
    let prompt = node
        .params
        .get("prompt")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("请选择后继续执行")
        .to_string();
    let allow_multiple = node
        .params
        .get("allowMultiple")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    let (options, preview_images) = match manual_gate_options_source(node) {
        OPTIONS_SOURCE_CANDIDATE_IMAGES => {
            let candidate_asset = merged_inputs
                .get("candidateImages")
                .ok_or_else(|| "人工节点缺少上游候选图输入。".to_string())?;
            build_candidate_image_gate_options(candidate_asset)?
        }
        _ => (parse_static_gate_options(node), Vec::new()),
    };

    if options.is_empty() {
        return Err("人工节点未配置候选项，请补充后重试。".to_string());
    }

    Ok(ManualGateContext {
        allow_multiple,
        options,
        preview_images,
        prompt,
    })
}

fn parse_static_gate_options(node: &WorkflowNodeInput) -> Vec<WorkflowManualOption> {
    node.params
        .get("options")
        .and_then(Value::as_str)
        .unwrap_or("")
        .split(',')
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .map(|value| WorkflowManualOption {
            label: value.clone(),
            value,
        })
        .collect()
}

fn build_candidate_image_gate_options(
    candidate_asset: &Value,
) -> Result<(Vec<WorkflowManualOption>, Vec<WorkflowManualPreviewImage>), String> {
    if asset_kind(candidate_asset) != Some(KIND_CANDIDATE_IMAGES) {
        return Err("上游候选图类型不匹配。".to_string());
    }

    let candidate_data = asset_data(candidate_asset)
        .ok_or_else(|| "候选图 asset 缺少 data 字段。".to_string())?;
    let items = parse_candidate_image_items(candidate_data)?;

    if items.is_empty() {
        return Err("候选图为空，无法暂停供用户选择。".to_string());
    }

    let mut options = Vec::with_capacity(items.len());
    let mut preview_images = Vec::with_capacity(items.len());

    for (index, item) in items.iter().enumerate() {
        let plan_id = item.plan_id.trim();
        if plan_id.is_empty() {
            continue;
        }

        let label = format!("方案 {plan_id}");
        let project_relative_path = item.image.project_relative_path.trim().to_string();
        let absolute_path = item.image.absolute_path.trim().to_string();

        options.push(WorkflowManualOption {
            label: label.clone(),
            value: plan_id.to_string(),
        });
        preview_images.push(WorkflowManualPreviewImage {
            absolute_path: if absolute_path.is_empty() {
                None
            } else {
                Some(absolute_path)
            },
            label: Some(label),
            plan_id: plan_id.to_string(),
            project_relative_path: if project_relative_path.is_empty() {
                None
            } else {
                Some(project_relative_path)
            },
        });

        let _ = index;
    }

    if options.is_empty() {
        return Err("候选图缺少有效 planId，无法生成候选项。".to_string());
    }

    Ok((options, preview_images))
}

fn parse_candidate_image_items(
    candidate_data: &Value,
) -> Result<Vec<CharacterMasterCandidateImage>, String> {
    let items = candidate_data
        .get("items")
        .ok_or_else(|| "候选图 asset 缺少 items 字段。".to_string())?;

    serde_json::from_value(items.clone()).map_err(|error| format!("解析候选图列表失败：{error}"))
}

pub fn find_manual_gate_node<'a>(
    definition: &'a crate::engine::graph::types::WorkflowDefinition,
    node_id: &str,
) -> Option<&'a WorkflowNodeInput> {
    definition
        .nodes
        .iter()
        .find(|node| node.id == node_id && node.kind == super::runtime::MANUAL_GATE_NODE_KIND)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample_node(options_source: &str) -> WorkflowNodeInput {
        WorkflowNodeInput {
            id: "gate".to_string(),
            kind: "control.manualGate".to_string(),
            params: json!({
                "optionsSource": options_source,
                "prompt": "请选择方案",
                "allowMultiple": false
            }),
            ..WorkflowNodeInput::default()
        }
    }

    #[test]
    fn builds_candidate_image_options_with_preview_paths() {
        let merged = json!({
            "candidateImages": {
                "asset": {
                    "kind": "candidateImages",
                    "data": {
                        "items": [
                            {
                                "planId": "A",
                                "image": {
                                    "id": "img-a",
                                    "projectRelativePath": "assets/.cache/a.png",
                                    "absolutePath": "",
                                    "role": "master",
                                    "source": "generated",
                                    "width": 64,
                                    "height": 64
                                }
                            }
                        ],
                        "taskId": "task-1"
                    }
                }
            }
        });

        let context = resolve_manual_gate_context(&sample_node(OPTIONS_SOURCE_CANDIDATE_IMAGES), &merged)
            .expect("candidate gate context");

        assert_eq!(context.options.len(), 1);
        assert_eq!(context.options[0].value, "A");
        assert_eq!(context.preview_images[0].plan_id, "A");
        assert_eq!(
            context.preview_images[0].project_relative_path.as_deref(),
            Some("assets/.cache/a.png")
        );
    }

    #[test]
    fn static_gate_keeps_comma_separated_options() {
        let mut node = sample_node(OPTIONS_SOURCE_STATIC);
        node.params = json!({
            "optionsSource": "static",
            "options": "方案A,方案B",
            "prompt": "选择"
        });

        let context =
            resolve_manual_gate_context(&node, &json!({})).expect("static gate context");

        assert_eq!(context.options.len(), 2);
        assert!(context.preview_images.is_empty());
    }
}
