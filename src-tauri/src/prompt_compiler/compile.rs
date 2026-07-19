use std::collections::HashMap;

use serde_json::Value;

use super::collect::{collect_ast_nodes, collect_control_signals, collect_negative_segments};
use super::types::{
    parse_override_slots_json, parse_weights_json, CompileOptions, PromptAstNode,
    PromptBundle,
};

const SLOT_ORDER: &[&str] = &["subject", "style", "outfit", "action", "environment", "quality", "constraints"];

pub fn compile_prompt_from_inputs(
    inputs: &Value,
    options: &CompileOptions,
) -> Result<PromptBundle, String> {
    let mut ast = collect_ast_nodes(inputs);
    if ast.is_empty() {
        return Err("Prompt 编译缺少语义输入。".to_string());
    }

    let weights = parse_weights_json(&options.weights_json)?;
    let overrides = parse_override_slots_json(&options.override_slots_json)?;
    apply_overrides(&mut ast, &overrides);
    apply_weights(&mut ast, &weights);
    resolve_conflicts(&mut ast);

    let control_signals = collect_control_signals(inputs);
    if control_signals.style_lock {
        for node in &mut ast {
            if node.slot == "style" {
                node.weight = node.weight.max(1.4);
            }
        }
    }

    let prompt = render_prompt(&ast, &options.prefix, &options.suffix);
    let mut negative_segments = collect_negative_segments(inputs);
    if !options.extra_negative.trim().is_empty() {
        negative_segments.push(options.extra_negative.trim().to_string());
    }
    if negative_segments.is_empty() {
        negative_segments.push(
            "blurry, low quality, deformed, watermark, extra limbs, text".to_string(),
        );
    }

    Ok(PromptBundle {
        ast,
        control_signals,
        negative_prompt: negative_segments.join(", "),
        prompt,
    })
}

fn apply_overrides(ast: &mut Vec<PromptAstNode>, overrides: &HashMap<String, String>) {
    for (slot, value) in overrides {
        ast.retain(|node| node.slot != *slot);
        ast.push(PromptAstNode {
            slot: slot.clone(),
            value: value.clone(),
            weight: 2.0,
            mode: "override".to_string(),
        });
    }
}

fn apply_weights(ast: &mut Vec<PromptAstNode>, weights: &HashMap<String, f64>) {
    for node in ast.iter_mut() {
        if let Some(weight) = weights.get(&node.slot) {
            node.weight = *weight;
        }
    }
}

fn resolve_conflicts(ast: &mut Vec<PromptAstNode>) {
    let mut resolved: HashMap<String, PromptAstNode> = HashMap::new();

    for node in ast.drain(..) {
        match resolved.get(&node.slot) {
            Some(existing) if existing.weight >= node.weight => {}
            _ => {
                resolved.insert(node.slot.clone(), node);
            }
        }
    }

    *ast = resolved.into_values().collect();
}

fn render_prompt(ast: &[PromptAstNode], prefix: &str, suffix: &str) -> String {
    let mut ordered = ast.to_vec();
    ordered.sort_by(|left, right| {
        slot_index(&left.slot)
            .cmp(&slot_index(&right.slot))
            .then_with(|| left.slot.cmp(&right.slot))
    });

    let mut segments = Vec::new();
    if !prefix.trim().is_empty() {
        segments.push(prefix.trim().to_string());
    }
    segments.extend(ordered.iter().map(|node| node.value.clone()).filter(|value| !value.is_empty()));
    if !suffix.trim().is_empty() {
        segments.push(suffix.trim().to_string());
    }

    segments.join(", ")
}

fn slot_index(slot: &str) -> usize {
    SLOT_ORDER
        .iter()
        .position(|candidate| *candidate == slot)
        .unwrap_or(SLOT_ORDER.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::workflow_assets::wrap_asset;
    use serde_json::json;

    #[test]
    fn compiles_seed_and_style() {
        let inputs = json!({
            "characterSeed": wrap_asset("characterSeed", json!({ "name": "剑士", "race": "human", "class": "warrior" })),
            "styleProfile": wrap_asset("styleProfile", json!({ "stylePrompt": "pixel art fantasy" })),
        });

        let bundle = compile_prompt_from_inputs(
            &inputs,
            &CompileOptions {
                prefix: "game character".to_string(),
                suffix: String::new(),
                extra_negative: String::new(),
                weights_json: String::new(),
                override_slots_json: String::new(),
            },
        )
        .expect("compile");

        assert!(bundle.prompt.contains("剑士"));
        assert!(bundle.prompt.contains("pixel art fantasy"));
    }

    #[test]
    fn override_replaces_subject() {
        let inputs = json!({
            "characterSeed": wrap_asset("characterSeed", json!({ "name": "旧名", "race": "", "class": "" })),
        });

        let bundle = compile_prompt_from_inputs(
            &inputs,
            &CompileOptions {
                prefix: String::new(),
                suffix: String::new(),
                extra_negative: String::new(),
                weights_json: String::new(),
                override_slots_json: r#"{"subject":"mage hero"}"#.to_string(),
            },
        )
        .expect("compile");

        assert!(bundle.prompt.contains("mage hero"));
        assert!(!bundle.prompt.contains("旧名"));
    }
}
