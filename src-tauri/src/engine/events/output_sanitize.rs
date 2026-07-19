use serde_json::{json, Value};

/// 为 IPC 事件瘦身节点 outputs：去掉 base64，保留画布预览所需字段。
pub fn sanitize_node_outputs_for_event(outputs: &Value) -> Value {
    if outputs.is_null() {
        return json!({});
    }

    let mut sanitized = strip_data_urls(outputs.clone());

    if let Some(object) = sanitized.as_object_mut() {
        if let Some(character) = object.get("character").cloned() {
            object.insert("character".to_string(), slim_character_for_preview(&character));
        }

        if let Some(asset) = object.get("asset").cloned() {
            object.insert("asset".to_string(), slim_asset_for_preview(&asset));
        }
    }

    sanitized
}

pub fn outputs_empty(value: &Value) -> bool {
    value.as_object().map(|object| object.is_empty()).unwrap_or(true)
}

fn strip_data_urls(value: Value) -> Value {
    match value {
        Value::Object(mut object) => {
            object.remove("dataUrl");
            object.remove("data_url");
            let keys = object.keys().cloned().collect::<Vec<_>>();
            for key in keys {
                if let Some(child) = object.remove(&key) {
                    object.insert(key, strip_data_urls(child));
                }
            }
            Value::Object(object)
        }
        Value::Array(items) => Value::Array(items.into_iter().map(strip_data_urls).collect()),
        other => other,
    }
}

fn slim_image_asset(value: &Value) -> Value {
    let Some(object) = value.as_object() else {
        return value.clone();
    };

    json!({
        "absolutePath": object.get("absolutePath").or_else(|| object.get("absolute_path")),
        "height": object.get("height"),
        "id": object.get("id"),
        "kind": object.get("kind"),
        "path": object.get("path").or_else(|| object.get("projectRelativePath")),
        "projectRelativePath": object.get("projectRelativePath").or_else(|| object.get("path")),
        "width": object.get("width"),
    })
}

fn slim_character_for_preview(value: &Value) -> Value {
    let Some(object) = value.as_object() else {
        return value.clone();
    };

    let views = object
        .get("views")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|view| {
                    let record = view.as_object()?;
                    Some(json!({
                        "id": record.get("id"),
                        "kind": record.get("kind"),
                        "normalizedImage": record.get("normalizedImage").map(slim_image_asset).unwrap_or(Value::Null),
                        "rawImage": record.get("rawImage").map(slim_image_asset).unwrap_or(Value::Null),
                        "transparentImage": record.get("transparentImage").map(slim_image_asset).unwrap_or(Value::Null),
                    }))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let actions = object
        .get("actions")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|action| {
                    let record = action.as_object()?;
                    let frames = record
                        .get("frames")
                        .and_then(Value::as_array)
                        .map(|frame_items| {
                            frame_items
                                .iter()
                                .filter_map(|frame| {
                                    let frame_record = frame.as_object()?;
                                    Some(json!({
                                        "index": frame_record.get("index"),
                                        "label": frame_record.get("label"),
                                        "image": frame_record.get("image").map(slim_image_asset).unwrap_or(Value::Null),
                                    }))
                                })
                                .collect::<Vec<_>>()
                        })
                        .unwrap_or_default();
                    Some(json!({
                        "id": record.get("id"),
                        "label": record.get("label"),
                        "previewFps": record.get("previewFps"),
                        "frames": frames,
                    }))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    json!({
        "actions": actions,
        "id": object.get("id"),
        "masterImage": object.get("masterImage").map(slim_image_asset).unwrap_or(Value::Null),
        "views": views,
    })
}

fn slim_asset_for_preview(value: &Value) -> Value {
    let Some(envelope) = value.as_object() else {
        return value.clone();
    };

    let kind = envelope.get("kind").and_then(Value::as_str).unwrap_or_default();
    let data = envelope.get("data").cloned().unwrap_or(Value::Null);

    if kind != "candidateImages" {
        return json!({
            "data": data,
            "kind": kind,
            "version": envelope.get("version"),
        });
    }

    let items = data
        .as_object()
        .and_then(|record| record.get("items"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let record = item.as_object()?;
                    Some(json!({
                        "image": record.get("image").map(slim_image_asset).unwrap_or(Value::Null),
                        "planId": record.get("planId"),
                    }))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    json!({
        "data": {
            "items": items,
            "taskId": data.as_object().and_then(|record| record.get("taskId")).cloned().unwrap_or(Value::Null),
        },
        "kind": kind,
        "version": envelope.get("version"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_data_urls_removes_base64_fields() {
        let input = json!({
            "asset": {
                "data": {
                    "items": [{
                        "image": {
                            "dataUrl": "data:image/png;base64,abc",
                            "path": "assets/test.png"
                        },
                        "planId": "plan-a"
                    }]
                },
                "kind": "candidateImages"
            }
        });

        let sanitized = sanitize_node_outputs_for_event(&input);
        let image = sanitized
            .pointer("/asset/data/items/0/image")
            .expect("image path");

        assert!(image.get("dataUrl").is_none());
        assert_eq!(
            image.get("path").and_then(Value::as_str),
            Some("assets/test.png")
        );
    }

    #[test]
    fn slim_character_keeps_preview_fields_only() {
        let input = json!({
            "character": {
                "id": "hero-1",
                "actions": [{
                    "id": "idle-front",
                    "label": "Idle 待机 · 前",
                    "previewFps": 12,
                    "frames": [{
                        "index": 0,
                        "label": "Idle 01",
                        "image": {
                            "dataUrl": "data:image/png;base64,abc",
                            "projectRelativePath": "assets/characters/hero-1/animations/idle/front/frame_00.png"
                        }
                    }]
                }],
                "masterImage": {
                    "dataUrl": "data:image/png;base64,abc",
                    "projectRelativePath": "assets/characters/hero-1/master.png"
                },
                "views": [{
                    "kind": "single",
                    "rawImage": {
                        "path": "assets/characters/hero-1/views/view_single.png"
                    }
                }]
            }
        });

        let sanitized = sanitize_node_outputs_for_event(&input);
        let character = sanitized.get("character").expect("character");

        assert!(character.pointer("/actions/0/frames/0/image/dataUrl").is_none());
        assert_eq!(
            character
                .pointer("/actions/0/frames/0/image/projectRelativePath")
                .and_then(Value::as_str),
            Some("assets/characters/hero-1/animations/idle/front/frame_00.png")
        );
        assert!(character.pointer("/masterImage/dataUrl").is_none());
        assert_eq!(
            character
                .pointer("/masterImage/projectRelativePath")
                .and_then(Value::as_str),
            Some("assets/characters/hero-1/master.png")
        );
        assert_eq!(
            character
                .pointer("/views/0/rawImage/path")
                .and_then(Value::as_str),
            Some("assets/characters/hero-1/views/view_single.png")
        );
    }
}
