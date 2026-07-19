use serde_json::{json, Value};

pub const KIND_CHARACTER_SEED: &str = "characterSeed";
pub const KIND_STYLE_PROFILE: &str = "styleProfile";
pub const KIND_OUTFIT_PROFILE: &str = "outfitProfile";
pub const KIND_PROMPT_TEXT: &str = "promptText";
pub const KIND_PROMPT_BUNDLE: &str = "promptBundle";
pub const KIND_CONTROL_PROFILE: &str = "controlProfile";
pub const KIND_MASTER_PLAN: &str = "masterPlan";
pub const KIND_CANDIDATE_IMAGES: &str = "candidateImages";

pub fn wrap_asset(kind: &str, data: Value) -> Value {
    json!({
        "asset": {
            "data": data,
            "kind": kind,
            "version": 1
        }
    })
}

pub fn asset_envelope<'a>(value: &'a Value) -> Option<&'a Value> {
    value.get("asset").or(Some(value))
}

pub fn asset_kind(value: &Value) -> Option<&str> {
    asset_envelope(value)?.get("kind")?.as_str()
}

pub fn asset_data(value: &Value) -> Option<&Value> {
    asset_envelope(value)?.get("data")
}

pub fn string_field(value: &Value, field: &str) -> String {
    value
        .get(field)
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string()
}

pub fn extract_negative_prompt_text(value: &Value) -> String {
    if let Some(data) = asset_data(value) {
        if asset_kind(value) == Some(KIND_PROMPT_BUNDLE) {
            if let Some(text) = data.get("negativePrompt").and_then(Value::as_str) {
                if !text.trim().is_empty() {
                    return text.trim().to_string();
                }
            }
        }
    }

    asset_data(value)
        .and_then(|data| data.get("negativeText"))
        .and_then(Value::as_str)
        .or_else(|| value.pointer("/prompt/negativePrompt").and_then(Value::as_str))
        .unwrap_or("")
        .trim()
        .to_string()
}

pub fn extract_prompt_text(value: &Value) -> Option<String> {
    if let Some(data) = asset_data(value) {
        if asset_kind(value) == Some(KIND_PROMPT_BUNDLE) {
            if let Some(text) = data.get("prompt").and_then(Value::as_str) {
                if !text.trim().is_empty() {
                    return Some(text.trim().to_string());
                }
            }
        }
        if let Some(text) = data.get("text").and_then(Value::as_str) {
            if !text.trim().is_empty() {
                return Some(text.trim().to_string());
            }
        }
    }

    if let Some(text) = value.pointer("/prompt/text").and_then(Value::as_str) {
        if !text.trim().is_empty() {
            return Some(text.trim().to_string());
        }
    }

    value
        .get("text")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
}
