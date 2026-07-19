use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PromptAstNode {
    pub slot: String,
    pub value: String,
    #[serde(default = "default_weight")]
    pub weight: f64,
    #[serde(default = "default_mode")]
    pub mode: String,
}

fn default_weight() -> f64 {
    1.0
}

fn default_mode() -> String {
    "merge".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ControlSignals {
    #[serde(default)]
    pub consistency_hash: String,
    #[serde(default)]
    pub reference_strength: f64,
    #[serde(default)]
    pub seed: Option<u64>,
    #[serde(default)]
    pub seed_lock: bool,
    #[serde(default)]
    pub style_lock: bool,
    #[serde(default)]
    pub palette: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PromptBundle {
    pub ast: Vec<PromptAstNode>,
    #[serde(default)]
    pub control_signals: ControlSignals,
    pub negative_prompt: String,
    pub prompt: String,
}

#[derive(Debug, Clone, Default)]
pub struct CompileOptions {
    pub extra_negative: String,
    pub override_slots_json: String,
    pub prefix: String,
    pub suffix: String,
    pub weights_json: String,
}

pub fn parse_weights_json(raw: &str) -> Result<std::collections::HashMap<String, f64>, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(std::collections::HashMap::new());
    }

    let value: Value =
        serde_json::from_str(trimmed).map_err(|error| format!("解析权重 JSON 失败：{error}"))?;
    let Some(object) = value.as_object() else {
        return Err("权重 JSON 必须是对象。".to_string());
    };

    let mut weights = std::collections::HashMap::new();
    for (key, weight_value) in object {
        let Some(number) = weight_value.as_f64() else {
            return Err(format!("权重字段「{key}」必须是数字。"));
        };
        weights.insert(key.trim().to_string(), number);
    }

    Ok(weights)
}

pub fn parse_override_slots_json(
    raw: &str,
) -> Result<std::collections::HashMap<String, String>, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(std::collections::HashMap::new());
    }

    let value: Value =
        serde_json::from_str(trimmed).map_err(|error| format!("解析覆盖 JSON 失败：{error}"))?;
    let Some(object) = value.as_object() else {
        return Err("覆盖 JSON 必须是对象。".to_string());
    };

    let mut overrides = std::collections::HashMap::new();
    for (key, override_value) in object {
        let Some(text) = override_value.as_str() else {
            return Err(format!("覆盖字段「{key}」必须是字符串。"));
        };
        if !text.trim().is_empty() {
            overrides.insert(key.trim().to_string(), text.trim().to_string());
        }
    }

    Ok(overrides)
}
