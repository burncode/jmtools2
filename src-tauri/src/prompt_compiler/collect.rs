use serde_json::Value;

use crate::engine::workflow_assets::{
    asset_data, asset_kind, extract_negative_prompt_text, string_field, KIND_CHARACTER_SEED,
    KIND_CONTROL_PROFILE, KIND_OUTFIT_PROFILE, KIND_PROMPT_TEXT, KIND_STYLE_PROFILE,
};

use super::types::PromptAstNode;

pub fn collect_ast_nodes(inputs: &Value) -> Vec<PromptAstNode> {
    let mut nodes = Vec::new();
    let Some(object) = inputs.as_object() else {
        return nodes;
    };

    if let Some(seed) = object.get("characterSeed") {
        append_seed_nodes(seed, &mut nodes);
    }
    if let Some(style) = object.get("styleProfile") {
        append_style_nodes(style, &mut nodes);
    }
    if let Some(outfit) = object.get("outfitProfile") {
        append_outfit_nodes(outfit, &mut nodes);
    }
    if let Some(prompt) = object.get("prompt") {
        append_prompt_nodes(prompt, &mut nodes);
    }

    nodes
}

pub fn collect_negative_segments(inputs: &Value) -> Vec<String> {
    let mut segments = Vec::new();
    let Some(object) = inputs.as_object() else {
        return segments;
    };

    if let Some(negative) = object.get("negativePrompt") {
        let text = extract_negative_prompt_text(negative);
        if !text.is_empty() {
            segments.push(text);
        }
    }

    if let Some(style) = object.get("styleProfile") {
        append_style_negative_hints(style, &mut segments);
    }

    segments
}

pub fn collect_control_signals(inputs: &Value) -> super::types::ControlSignals {
    let mut signals = super::types::ControlSignals::default();
    let Some(object) = inputs.as_object() else {
        return signals;
    };

    if let Some(style) = object.get("styleProfile") {
        merge_style_constraints(style, &mut signals);
    }

    if let Some(control) = object.get("controlProfile") {
        if let Some(data) = asset_data(control) {
            if asset_kind(control) == Some(KIND_CONTROL_PROFILE) {
                merge_control_profile(data, &mut signals);
            }
        }
    }

    signals
}

fn merge_control_profile(data: &Value, signals: &mut super::types::ControlSignals) {
    if let Some(hash) = data.get("consistencyHash").and_then(Value::as_str) {
        if !hash.trim().is_empty() {
            signals.consistency_hash = hash.trim().to_string();
        }
    }
    if let Some(strength) = data.get("referenceStrength").and_then(Value::as_f64) {
        signals.reference_strength = strength.clamp(0.0, 1.0);
    }
    if let Some(seed) = data.get("seed").and_then(Value::as_u64) {
        signals.seed = Some(seed);
        signals.seed_lock = data
            .get("seedLock")
            .and_then(Value::as_bool)
            .unwrap_or(true);
    }
    if data.get("styleLock").and_then(Value::as_bool) == Some(true) {
        signals.style_lock = true;
    }
}

fn merge_style_constraints(value: &Value, signals: &mut super::types::ControlSignals) {
    let Some(data) = asset_data(value) else {
        return;
    };

    if asset_kind(value) != Some(KIND_STYLE_PROFILE) {
        return;
    }

    if let Some(palette) = data.get("palette") {
        if let Some(colors) = palette.get("colors").and_then(Value::as_array) {
            let parsed = colors
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|color| !color.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>();
            if !parsed.is_empty() {
                signals.palette = parsed;
            }
        }
    }

    let Some(constraints) = data.get("constraints").and_then(Value::as_object) else {
        return;
    };

    let palette_lock = constraints
        .get("paletteLock")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let line_style_lock = constraints
        .get("lineStyleLock")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let identity_lock = constraints
        .get("identityLock")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    if palette_lock || line_style_lock || identity_lock {
        signals.style_lock = true;
    }
}

fn append_style_negative_hints(value: &Value, segments: &mut Vec<String>) {
    let Some(data) = asset_data(value) else {
        return;
    };

    if asset_kind(value) != Some(KIND_STYLE_PROFILE) {
        return;
    }

    let Some(hints) = data.get("negativeHints").and_then(Value::as_array) else {
        return;
    };

    for hint in hints {
        if let Some(text) = hint.as_str() {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                segments.push(trimmed.to_string());
            }
        }
    }
}

fn append_seed_nodes(value: &Value, nodes: &mut Vec<PromptAstNode>) {
    let Some(data) = asset_data(value) else {
        return;
    };

    if asset_kind(value) != Some(KIND_CHARACTER_SEED) {
        return;
    }

    let name = string_field(data, "name");
    let race = string_field(data, "race");
    let class_name = string_field(data, "class");
    let mut subject = Vec::new();
    if !name.is_empty() {
        subject.push(name);
    }
    if !race.is_empty() {
        subject.push(format!("{race} race"));
    }
    if !class_name.is_empty() {
        subject.push(format!("{class_name} class"));
    }
    if !subject.is_empty() {
        nodes.push(PromptAstNode {
            slot: "subject".to_string(),
            value: subject.join(", "),
            weight: 1.2,
            mode: "merge".to_string(),
        });
    }
}

fn append_style_nodes(value: &Value, nodes: &mut Vec<PromptAstNode>) {
    let Some(data) = asset_data(value) else {
        return;
    };

    if asset_kind(value) != Some(KIND_STYLE_PROFILE) {
        return;
    }

    if let Some(style_prompt) = data.get("stylePrompt").and_then(Value::as_str) {
        if !style_prompt.trim().is_empty() {
            nodes.push(PromptAstNode {
                slot: "style".to_string(),
                value: style_prompt.trim().to_string(),
                weight: 1.0,
                mode: "merge".to_string(),
            });
        }
    }
}

fn append_outfit_nodes(value: &Value, nodes: &mut Vec<PromptAstNode>) {
    let Some(data) = asset_data(value) else {
        return;
    };

    if asset_kind(value) != Some(KIND_OUTFIT_PROFILE) {
        return;
    }

    let layers = data
        .get("layers")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let kind = item.get("kind")?.as_str()?;
                    let layer_value = item.get("value")?.as_str()?;
                    if layer_value.trim().is_empty() {
                        return None;
                    }
                    Some(format!("{kind}: {layer_value}"))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if !layers.is_empty() {
        nodes.push(PromptAstNode {
            slot: "outfit".to_string(),
            value: layers.join(", "),
            weight: 1.0,
            mode: "merge".to_string(),
        });
    }
}

fn append_prompt_nodes(value: &Value, nodes: &mut Vec<PromptAstNode>) {
    if let Some(data) = asset_data(value) {
        if asset_kind(value) == Some(KIND_PROMPT_TEXT) {
            let text = string_field(data, "text");
            if !text.is_empty() {
                nodes.push(PromptAstNode {
                    slot: "quality".to_string(),
                    value: text,
                    weight: 1.0,
                    mode: "merge".to_string(),
                });
            }
            return;
        }
    }

    if let Some(data) = asset_data(value) {
        if asset_kind(value) == Some("promptBundle") {
            if let Some(ast) = data.get("ast").and_then(Value::as_array) {
                for item in ast {
                    if let Ok(node) = serde_json::from_value::<PromptAstNode>(item.clone()) {
                        nodes.push(node);
                    }
                }
            }
        }
    }
}
