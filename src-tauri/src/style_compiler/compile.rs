use serde_json::{json, Map, Value};
use tauri::AppHandle;

use crate::engine::graph::types::WorkflowNodeInput;
use crate::storage::database::open_app_database;
use crate::storage::style_presets::resolve_style_preset_params;

pub fn compile_style_profile_from_node(
    node: &WorkflowNodeInput,
    app: Option<&AppHandle>,
) -> Value {
    if is_legacy_inline_style_node(node) {
        return compile_style_profile_from_params(node);
    }

    let preset_id = resolve_preset_id(node);
    let connection = app.and_then(|handle| open_app_database(handle).ok());
    let base = resolve_style_preset_params(connection.as_ref(), &preset_id)
        .or_else(|| resolve_style_preset_params(None, &preset_id))
        .unwrap_or_else(|| json!({}));

    let mut merged = match base {
        Value::Object(map) => map,
        _ => Map::new(),
    };

    merged.insert("preset".to_string(), json!(preset_id));
    merged.insert("presetId".to_string(), json!(preset_id));

    if let Some(node_obj) = node.params.as_object() {
        if param_bool_from_map(node_obj, "enableLocalOverride", false) {
            apply_local_overrides(&mut merged, node_obj);
        }
    }

    let resolved = WorkflowNodeInput {
        params: Value::Object(merged),
        ..node.clone()
    };

    compile_style_profile_from_params(&resolved)
}

pub fn compile_style_profile_from_params(node: &WorkflowNodeInput) -> Value {
    let style_type = string_param(node, "styleType", "pixel");
    let art_reference = string_param(node, "artReference", "");
    let color_theme = string_param(node, "colorTheme", "fantasy");
    let preset = string_param(node, "preset", "pixel_retro_16");

    let render_type = string_param(node, "renderType", &style_type);
    let pixel_density = string_param(node, "pixelDensity", "");
    let edge_style = string_param(node, "edgeStyle", "hard");
    let detail = param_f64(node, "detail", 0.6);
    let contrast = param_f64(node, "contrast", 0.7);
    let saturation = param_f64(node, "saturation", 0.6);
    let sharpness = param_f64(node, "sharpness", 0.4);

    let palette_mode = string_param(node, "paletteMode", "preset");
    let max_colors = param_i64(node, "maxColors", 16).clamp(2, 64) as u32;
    let palette_strength = param_f64(node, "paletteStrength", 0.85);
    let dithering = param_bool(node, "dithering", true);
    let colors = parse_palette_colors(string_param(node, "paletteColors", "[]").as_str());

    let lighting_type = string_param(node, "lightingType", "flat");
    let shadow_strength = param_f64(node, "shadowStrength", 0.5);
    let highlight_strength = param_f64(node, "highlightStrength", 0.3);
    let ambient = param_f64(node, "ambient", 0.4);

    let palette_lock = param_bool(node, "paletteLock", false);
    let line_style_lock = param_bool(node, "lineStyleLock", false);
    let identity_lock = param_bool(node, "identityLock", false);
    let consistency_strength = param_f64(node, "consistencyStrength", 0.85);
    let negative_constraint_strength = param_f64(node, "negativeConstraintStrength", 0.0);

    let style_prompt = build_style_prompt(
        &render_type,
        &pixel_density,
        &edge_style,
        detail,
        contrast,
        saturation,
        sharpness,
        &lighting_type,
        shadow_strength,
        highlight_strength,
        ambient,
        &color_theme,
        &art_reference,
        palette_strength,
        dithering,
        max_colors,
    );

    let mut negative_hints = build_negative_hints(&render_type, &lighting_type, palette_lock, line_style_lock);
    if negative_constraint_strength >= 0.55 {
        negative_hints.push("inconsistent style".to_string());
        negative_hints.push("style drift".to_string());
    }
    if negative_constraint_strength >= 0.75 {
        negative_hints.push("mixed art styles".to_string());
        negative_hints.push("off-model rendering".to_string());
    }

    json!({
        "artReference": art_reference,
        "colorTheme": color_theme,
        "constraints": {
            "consistencyStrength": consistency_strength,
            "identityLock": identity_lock,
            "lineStyleLock": line_style_lock,
            "paletteLock": palette_lock,
        },
        "lighting": {
            "ambient": ambient,
            "highlightStrength": highlight_strength,
            "shadowStrength": shadow_strength,
            "type": lighting_type,
        },
        "negativeHints": negative_hints,
        "palette": {
            "colors": colors,
            "dithering": dithering,
            "maxColors": max_colors,
            "mode": palette_mode,
            "paletteStrength": palette_strength,
        },
        "preset": preset,
        "stylePrompt": style_prompt,
        "styleType": style_type,
        "visualDna": {
            "contrast": contrast,
            "detail": detail,
            "edgeStyle": edge_style,
            "pixelDensity": pixel_density,
            "renderType": render_type,
            "saturation": saturation,
            "sharpness": sharpness,
        },
    })
}

fn build_style_prompt(
    render_type: &str,
    pixel_density: &str,
    edge_style: &str,
    detail: f64,
    contrast: f64,
    saturation: f64,
    sharpness: f64,
    lighting_type: &str,
    shadow_strength: f64,
    highlight_strength: f64,
    ambient: f64,
    color_theme: &str,
    art_reference: &str,
    palette_strength: f64,
    dithering: bool,
    max_colors: u32,
) -> String {
    let mut segments = Vec::new();

    segments.push(render_type_label(render_type).to_string());
    if render_type == "pixel" && !pixel_density.is_empty() && pixel_density != "none" {
        segments.push(format!("{pixel_density} sprite"));
    }
    if edge_style == "hard" {
        segments.push("clean outline".to_string());
    } else if edge_style == "soft" {
        segments.push("soft edges".to_string());
    }

    segments.push(format!("{color_theme} color theme"));
    segments.push(lighting_label(lighting_type).to_string());

    if shadow_strength >= 0.55 {
        segments.push("defined shadows".to_string());
    }
    if highlight_strength >= 0.5 {
        segments.push("strong highlights".to_string());
    }
    if ambient >= 0.55 {
        segments.push("ambient fill light".to_string());
    }

    if detail >= 0.7 {
        segments.push("high detail".to_string());
    } else if detail <= 0.35 {
        segments.push("minimal detail".to_string());
    }

    if contrast >= 0.65 {
        segments.push("high contrast".to_string());
    }
    if saturation >= 0.65 {
        segments.push("vivid colors".to_string());
    } else if saturation <= 0.35 {
        segments.push("muted colors".to_string());
    }
    if sharpness >= 0.55 {
        segments.push("crisp edges".to_string());
    }

    if palette_strength >= 0.7 {
        segments.push(format!("limited {max_colors} color palette"));
    }
    if dithering {
        segments.push("ordered dithering".to_string());
    }

    if !art_reference.is_empty() {
        segments.push(format!("reference: {art_reference}"));
    }

    segments.join(", ")
}

fn build_negative_hints(
    render_type: &str,
    lighting_type: &str,
    palette_lock: bool,
    line_style_lock: bool,
) -> Vec<String> {
    let mut hints = vec![
        "blurry".to_string(),
        "low quality".to_string(),
        "watermark".to_string(),
        "text".to_string(),
    ];

    match render_type {
        "pixel" => {
            hints.push("realistic".to_string());
            hints.push("3d render".to_string());
            hints.push("smooth gradient".to_string());
        }
        "anime" => {
            hints.push("photorealistic".to_string());
            hints.push("western comic".to_string());
        }
        "realistic" => {
            hints.push("cartoon".to_string());
            hints.push("pixel art".to_string());
        }
        "hand_drawn" => {
            hints.push("3d".to_string());
            hints.push("vector flat".to_string());
        }
        "low_poly" => {
            hints.push("high poly".to_string());
            hints.push("realistic texture".to_string());
        }
        _ => {}
    }

    if lighting_type == "flat" {
        hints.push("harsh shadows".to_string());
    }

    if palette_lock {
        hints.push("color drift".to_string());
        hints.push("off-palette colors".to_string());
    }
    if line_style_lock {
        hints.push("inconsistent line weight".to_string());
    }

    hints
}

fn render_type_label(render_type: &str) -> &'static str {
    match render_type {
        "pixel" => "pixel art",
        "anime" => "anime cel shading",
        "realistic" => "realistic illustration",
        "hand_drawn" => "hand drawn",
        "low_poly" => "low poly 3d style",
        "realism" => "realistic",
        "stylized" => "stylized",
        _ => "stylized",
    }
}

fn lighting_label(lighting_type: &str) -> &'static str {
    match lighting_type {
        "flat" => "flat lighting",
        "soft" => "soft diffused lighting",
        "cinematic" => "cinematic lighting",
        "volumetric" => "volumetric lighting",
        "game" => "game style lighting",
        _ => "flat lighting",
    }
}

const INLINE_STYLE_KEYS: &[&str] = &[
    "renderType",
    "pixelDensity",
    "edgeStyle",
    "detail",
    "contrast",
    "saturation",
    "sharpness",
    "paletteMode",
    "maxColors",
    "paletteStrength",
    "dithering",
    "paletteColors",
    "lightingType",
    "shadowStrength",
    "highlightStrength",
    "ambient",
    "paletteLock",
    "lineStyleLock",
    "identityLock",
    "styleType",
    "colorTheme",
    "artReference",
];

fn is_legacy_inline_style_node(node: &WorkflowNodeInput) -> bool {
    node.params
        .as_object()
        .map(|obj| INLINE_STYLE_KEYS.iter().any(|key| obj.contains_key(*key)))
        .unwrap_or(false)
}

fn resolve_preset_id(node: &WorkflowNodeInput) -> String {
    node.params
        .as_object()
        .and_then(|obj| obj.get("presetId").or_else(|| obj.get("preset")))
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .unwrap_or("pixel_retro_16")
        .to_string()
}

fn param_bool_from_map(params: &Map<String, Value>, key: &str, fallback: bool) -> bool {
    match params.get(key) {
        Some(Value::Bool(value)) => *value,
        Some(value) if value.as_str() == Some("true") => true,
        Some(value) if value.as_str() == Some("false") => false,
        _ => fallback,
    }
}

fn apply_local_overrides(merged: &mut Map<String, Value>, node_obj: &Map<String, Value>) {
    if let Some(value) = node_obj.get("consistencyStrength") {
        merged.insert("consistencyStrength".to_string(), value.clone());
    }

    if let Some(weight) = node_obj.get("styleWeight").and_then(Value::as_f64) {
        let detail = merged
            .get("detail")
            .and_then(Value::as_f64)
            .unwrap_or(0.6);
        let palette_strength = merged
            .get("paletteStrength")
            .and_then(Value::as_f64)
            .unwrap_or(0.85);
        merged.insert("detail".to_string(), json!(detail * weight));
        merged.insert("paletteStrength".to_string(), json!(palette_strength * weight));
    }

    if let Some(value) = node_obj.get("referenceStrength") {
        merged.insert("referenceStrength".to_string(), value.clone());
    }

    if let Some(value) = node_obj.get("negativeConstraintStrength") {
        merged.insert("negativeConstraintStrength".to_string(), value.clone());
    }
}

fn parse_palette_colors(raw: &str) -> Vec<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }

    serde_json::from_str::<Vec<String>>(trimmed).unwrap_or_default()
}

fn string_param(node: &WorkflowNodeInput, key: &str, fallback: &str) -> String {
    node.params
        .get(key)
        .and_then(|value| {
            if let Some(text) = value.as_str() {
                Some(text.trim().to_string())
            } else {
                None
            }
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn param_f64(node: &WorkflowNodeInput, key: &str, fallback: f64) -> f64 {
    node.params
        .get(key)
        .and_then(|value| value.as_f64().or_else(|| value.as_i64().map(|n| n as f64)))
        .map(|value| value.clamp(0.0, 1.0))
        .unwrap_or(fallback)
}

fn param_i64(node: &WorkflowNodeInput, key: &str, fallback: i64) -> i64 {
    node.params
        .get(key)
        .and_then(|value| value.as_i64().or_else(|| value.as_f64().map(|n| n as i64)))
        .unwrap_or(fallback)
}

fn param_bool(node: &WorkflowNodeInput, key: &str, fallback: bool) -> bool {
    match node.params.get(key) {
        Some(Value::Bool(value)) => *value,
        Some(value) if value.as_str() == Some("true") => true,
        Some(value) if value.as_str() == Some("false") => false,
        _ => fallback,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node_with_params(params: Value) -> WorkflowNodeInput {
        WorkflowNodeInput {
            id: "style".to_string(),
            kind: "character.styleProfile".to_string(),
            params,
            ..WorkflowNodeInput::default()
        }
    }

    #[test]
    fn compiles_pixel_preset_prompt() {
        let node = node_with_params(json!({
            "styleType": "pixel",
            "renderType": "pixel",
            "pixelDensity": "32x32",
            "colorTheme": "fantasy",
            "lightingType": "flat",
            "detail": 0.6,
            "contrast": 0.7,
            "paletteStrength": 0.85,
            "maxColors": 16,
            "dithering": true,
        }));

        let data = compile_style_profile_from_params(&node);
        let prompt = data
            .get("stylePrompt")
            .and_then(Value::as_str)
            .unwrap_or_default();

        assert!(prompt.contains("pixel art"));
        assert!(prompt.contains("32x32"));
        assert!(prompt.contains("flat lighting"));
        assert!(prompt.contains("limited 16 color palette"));
    }

    #[test]
    fn legacy_minimal_params_still_compile() {
        let node = node_with_params(json!({
            "styleType": "pixel",
            "colorTheme": "fantasy",
            "artReference": "retro RPG",
        }));

        let data = compile_style_profile_from_params(&node);
        let prompt = data
            .get("stylePrompt")
            .and_then(Value::as_str)
            .unwrap_or_default();

        assert!(prompt.contains("pixel art"));
        assert!(prompt.contains("fantasy color theme"));
        assert!(prompt.contains("reference: retro RPG"));
        assert!(data.get("visualDna").is_some());
        assert!(data.get("palette").is_some());
    }

    #[test]
    fn negative_hints_for_pixel_locks() {
        let node = node_with_params(json!({
            "renderType": "pixel",
            "lightingType": "flat",
            "paletteLock": true,
            "lineStyleLock": true,
        }));

        let data = compile_style_profile_from_params(&node);
        let hints = data
            .get("negativeHints")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        let joined = hints
            .iter()
            .filter_map(Value::as_str)
            .collect::<Vec<_>>()
            .join(", ");

        assert!(joined.contains("realistic"));
        assert!(joined.contains("color drift"));
        assert!(joined.contains("inconsistent line weight"));
    }
}
