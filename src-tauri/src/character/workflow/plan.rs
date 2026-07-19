use std::collections::BTreeMap;

use serde_json::Value;
use tracing::warn;

use tauri::AppHandle;

use crate::character::model::*;
use crate::character::prompt::*;
use crate::character::store::*;

pub(crate) fn workflow_default_draft(name: &str, description: &str, style: &str) -> CharacterWorkshopDraftInput {
    CharacterWorkshopDraftInput {
        appearance_traits: Vec::new(),
        archetype_template_id: None,
        background_mode: "transparent".to_string(),
        custom_height: 0,
        custom_width: 0,
        description: description.to_string(),
        direction: "single".to_string(),
        element_colors: BTreeMap::new(),
        feature_tags: Vec::new(),
        generation_count: "1".to_string(),
        generation_options: Vec::new(),
        generation_quality: "标准".to_string(),
        identity: CharacterIdentityBlockInput::default(),
        mood_keywords: Vec::new(),
        name: name.to_string(),
        palette: vec!["#334155".to_string(), "#64748b".to_string()],
        reference_images: Vec::new(),
        reference_strength: 0.6,
        selected_resources: Vec::new(),
        size: "64x64".to_string(),
        style: style.to_string(),
        style_preset_id: None,
        style_anchor_variant_key: String::new(),
    }
}

pub(crate) fn workflow_default_master_plan(
    name: &str,
    description: &str,
    pixel_prompt: &str,
) -> CharacterMasterPlanInput {
    CharacterMasterPlanInput {
        action_suggestions: CharacterActionSuggestions {
            attack: "短促挥击，保持武器轮廓稳定。".to_string(),
            idle: "轻微呼吸起伏，保持像素轮廓稳定。".to_string(),
            walk: "小步循环，脚线位置尽量固定。".to_string(),
        },
        candidate_plans: vec![CharacterCandidatePlanInput {
            focus: format!("{name} 默认母版方案"),
            id: "A".to_string(),
            master_image: None,
            name: "方案 A".to_string(),
            recommendation_score: 90,
        }],
        export_notes: vec!["首版导出 PNG + JSON。".to_string()],
        pixel_prompt: if pixel_prompt.trim().is_empty() {
            description.to_string()
        } else {
            pixel_prompt.to_string()
        },
        role_positioning: "工作流创建的可玩角色".to_string(),
        summary: format!("工作流角色：{name}"),
        visual_keywords: vec!["pixel art".to_string(), "game character".to_string()],
    }
}

pub(crate) fn workflow_default_selected_plan() -> CharacterCandidatePlanInput {
    CharacterCandidatePlanInput {
        focus: "默认方案".to_string(),
        id: "A".to_string(),
        master_image: None,
        name: "方案 A".to_string(),
        recommendation_score: 90,
    }
}

fn parse_candidate_image_items(
    candidate_data: &serde_json::Value,
) -> Result<Vec<CharacterMasterCandidateImage>, String> {
    let items = candidate_data
        .get("items")
        .ok_or_else(|| "候选图 asset 缺少 items 字段。".to_string())?;

    serde_json::from_value(items.clone())
        .map_err(|error| format!("解析候选图列表失败：{error}"))
}

fn find_candidate_image_by_plan_id<'a>(
    items: &'a [CharacterMasterCandidateImage],
    plan_id: &str,
) -> Option<&'a CharacterMasterCandidateImage> {
    let plan_id = plan_id.trim();
    if plan_id.is_empty() {
        return None;
    }

    items
        .iter()
        .find(|item| item.plan_id.trim() == plan_id)
}

fn find_candidate_image_by_asset_id<'a>(
    items: &'a [CharacterMasterCandidateImage],
    asset_id: &str,
) -> Option<&'a CharacterMasterCandidateImage> {
    let asset_id = asset_id.trim();
    if asset_id.is_empty() {
        return None;
    }

    items
        .iter()
        .find(|item| item.image.id.trim() == asset_id)
}

fn find_plan_metadata<'a>(
    master_plan: &'a CharacterMasterPlanInput,
    plan_id: &str,
) -> Option<&'a CharacterCandidatePlanInput> {
    let plan_id = plan_id.trim();
    master_plan
        .candidate_plans
        .iter()
        .find(|plan| plan.id.trim() == plan_id)
}

fn build_selected_plan_from_candidate(
    master_plan: &CharacterMasterPlanInput,
    candidate: &CharacterMasterCandidateImage,
) -> CharacterCandidatePlanInput {
    let plan_id = candidate.plan_id.trim().to_string();

    if let Some(metadata) = find_plan_metadata(master_plan, &plan_id) {
        return CharacterCandidatePlanInput {
            focus: metadata.focus.clone(),
            id: metadata.id.clone(),
            master_image: Some(candidate.image.clone()),
            name: metadata.name.clone(),
            recommendation_score: metadata.recommendation_score,
        };
    }

    CharacterCandidatePlanInput {
        focus: format!("方案 {plan_id}"),
        id: plan_id.clone(),
        master_image: Some(candidate.image.clone()),
        name: format!("方案 {plan_id}"),
        recommendation_score: 0,
    }
}

pub(crate) fn workflow_resolve_selected_plan(
    master_plan: &CharacterMasterPlanInput,
    candidate_data: Option<&serde_json::Value>,
    selected_plan_id: &str,
) -> Result<CharacterCandidatePlanInput, String> {
    let Some(candidate_data) = candidate_data else {
        return Ok(workflow_default_selected_plan());
    };

    let items = parse_candidate_image_items(candidate_data)?;
    if items.is_empty() {
        return Err("候选图为空，无法创建带母版的角色。".to_string());
    }

    let selected_plan_id = selected_plan_id.trim();

    if !selected_plan_id.is_empty() {
        if let Some(candidate) = find_candidate_image_by_plan_id(&items, selected_plan_id) {
            return Ok(build_selected_plan_from_candidate(master_plan, candidate));
        }

        if let Some(candidate) = find_candidate_image_by_asset_id(&items, selected_plan_id) {
            warn!(
                "selectedPlanId「{selected_plan_id}」已失效，已按 assetId 回退匹配方案「{}」。",
                candidate.plan_id
            );
            return Ok(build_selected_plan_from_candidate(master_plan, candidate));
        }

        warn!(
            "selectedPlanId「{selected_plan_id}」未匹配当前候选图，已回退自动推荐。"
        );
    }

    let mut ranked_plans = master_plan.candidate_plans.clone();
    ranked_plans.sort_by(|left, right| {
        right
            .recommendation_score
            .cmp(&left.recommendation_score)
    });

    for plan in &ranked_plans {
        if let Some(candidate) = find_candidate_image_by_plan_id(&items, &plan.id) {
            return Ok(build_selected_plan_from_candidate(master_plan, candidate));
        }
    }

    Ok(build_selected_plan_from_candidate(master_plan, &items[0]))
}
pub(crate) fn workflow_generate_master_plan(
    app: AppHandle,
    draft: CharacterWorkshopDraftInput,
    provider_id: Option<String>,
    model: Option<String>,
    task_id: String,
    compiled_prompt: Option<String>,
) -> Result<CharacterMasterPlanInput, String> {
    use crate::commands::ai_generation::{generate_ai_text_blocking, AiTextGenerationRequest};

    let prompt = build_workflow_master_plan_prompt(&draft, &task_id, compiled_prompt.as_deref());
    let result = generate_ai_text_blocking(
        app,
        AiTextGenerationRequest {
            max_tokens: Some(1800),
            model,
            prompt,
            provider_id,
            system_prompt: Some(
                "你是 JMTools 的游戏资产生成流水线助手，擅长像素角色设计、动画拆解和独立游戏资源规范。必须输出可解析 JSON，不要输出 Markdown 说明。".to_string(),
            ),
            task_id: Some(task_id),
            temperature: Some(0.45),
        },
    )?;

    parse_workflow_master_plan(&result.content, &draft)
}

pub(crate) fn build_workflow_master_plan_prompt(
    draft: &CharacterWorkshopDraftInput,
    task_id: &str,
    compiled_prompt: Option<&str>,
) -> String {
    let compiled_section = compiled_prompt
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|prompt| format!("\n编译视觉提示（优先采用）：{prompt}\n"))
        .unwrap_or_default();
    let candidate_count = parse_workflow_candidate_count(&draft.generation_count);
    let candidate_plan_examples = (0..candidate_count)
        .map(|index| {
            let id = ["A", "B", "C", "D"].get(index).copied().unwrap_or("X");
            format!(
                "    {{ \"id\": \"{id}\", \"name\": \"方案 {id}\", \"focus\": \"方案特点\", \"recommendationScore\": {} }}",
                90_u16.saturating_sub(index as u16 * 5)
            )
        })
        .collect::<Vec<_>>()
        .join(",\n");

    format!(
        "请为 JMTools 的角色工作流生成一个可执行的角色母版方案。\n\
输出语言必须是简体中文。\n\
只输出 JSON 对象，不要使用 Markdown 代码块，不要添加 JSON 之外的解释文字。\n\
candidatePlans 数组必须恰好包含 {candidate_count} 个互不相同的候选方案。\n\n\
JSON 结构必须严格符合：\n\
{{\n\
  \"summary\": \"一句话说明这个角色母版的创作方向\",\n\
  \"rolePositioning\": \"角色定位与玩法用途\",\n\
  \"visualKeywords\": [\"关键词1\", \"关键词2\", \"关键词3\"],\n\
  \"pixelPrompt\": \"可直接用于后续图像生成的像素角色提示词\",\n\
  \"directionConsistency\": [\"一致性要求1\", \"一致性要求2\"],\n\
  \"actionSuggestions\": {{ \"idle\": \"待机动作建议\", \"walk\": \"行走动作建议\", \"attack\": \"攻击动作建议\" }},\n\
  \"exportNotes\": [\"导出建议1\", \"导出建议2\"],\n\
  \"candidatePlans\": [\n\
{candidate_plan_examples}\n\
  ]\n\
}}\n\n\
任务 ID：{task_id}\n\
角色名称：{name}\n\
角色风格：{style}\n\
画布规格：{size}\n\
方向规格：{direction}\n\
角色描述：{description}{identity_section}{compiled_section}",
        candidate_count = candidate_count,
        candidate_plan_examples = candidate_plan_examples,
        name = draft.name,
        style = draft.style,
        size = draft.size,
        direction = draft.direction,
        description = draft.description,
        identity_section = format_identity_section(draft),
    )
}

fn format_identity_section(draft: &CharacterWorkshopDraftInput) -> String {
    let identity = &draft.identity;
    let mut lines = vec![
        format!("\n实体类型：{}", identity.entity_type.trim()),
        format!("游戏职能：{}", identity.role.trim()),
    ];

    if !identity.race_or_species.trim().is_empty() {
        lines.push(format!("种族/物种：{}", identity.race_or_species.trim()));
    }

    if !identity.class_or_occupation.trim().is_empty() {
        lines.push(format!("职业/定位：{}", identity.class_or_occupation.trim()));
    }

    if !identity.narrative_tags.is_empty() {
        lines.push(format!(
            "叙事标签：{}",
            normalize_strings(identity.narrative_tags.clone()).join("，")
        ));
    }

    if !draft.mood_keywords.is_empty() {
        lines.push(format!(
            "情绪关键词：{}",
            normalize_strings(draft.mood_keywords.clone()).join("，")
        ));
    }

    if draft.reference_strength > 0.0 {
        lines.push(format!(
            "参考图权重：{}%",
            (draft.reference_strength * 100.0).round() as i64
        ));
    }

    lines.join("\n")
}

pub(crate) fn parse_workflow_master_plan(content: &str, draft: &CharacterWorkshopDraftInput) -> Result<CharacterMasterPlanInput, String> {
    let trimmed = content.trim();
    let without_fence = trimmed
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();
    let json_start = without_fence.find('{').ok_or_else(|| "AI 方案输出不是有效 JSON。".to_string())?;
    let json_end = without_fence
        .rfind('}')
        .ok_or_else(|| "AI 方案输出不是有效 JSON。".to_string())?;
    let parsed: Value = serde_json::from_str(&without_fence[json_start..=json_end])
        .map_err(|error| format!("解析 AI 母版方案失败：{error}"))?;

    let action = parsed.get("actionSuggestions");
    let candidate_count = parse_workflow_candidate_count(&draft.generation_count);
    let mut plan = CharacterMasterPlanInput {
        action_suggestions: CharacterActionSuggestions {
            attack: action
                .and_then(|value| value.get("attack"))
                .and_then(Value::as_str)
                .unwrap_or("攻击动作建议")
                .to_string(),
            idle: action
                .and_then(|value| value.get("idle"))
                .and_then(Value::as_str)
                .unwrap_or("待机动作建议")
                .to_string(),
            walk: action
                .and_then(|value| value.get("walk"))
                .and_then(Value::as_str)
                .unwrap_or("行走动作建议")
                .to_string(),
        },
        candidate_plans: parsed
            .get("candidatePlans")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| {
                        Some(CharacterCandidatePlanInput {
                            focus: item.get("focus")?.as_str()?.to_string(),
                            id: item.get("id")?.as_str()?.to_string(),
                            master_image: None,
                            name: item.get("name")?.as_str()?.to_string(),
                            recommendation_score: item
                                .get("recommendationScore")
                                .and_then(Value::as_u64)
                                .unwrap_or(90) as u16,
                        })
                    })
                    .collect::<Vec<_>>()
            })
            .filter(|items| !items.is_empty())
            .unwrap_or_else(|| {
                vec![CharacterCandidatePlanInput {
                    focus: format!("{} 默认方案", draft.name),
                    id: "A".to_string(),
                    master_image: None,
                    name: "方案 A".to_string(),
                    recommendation_score: 90,
                }]
            }),
        export_notes: parsed
            .get("exportNotes")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_else(|| vec!["导出 PNG + JSON。".to_string()]),
        pixel_prompt: parsed
            .get("pixelPrompt")
            .and_then(Value::as_str)
            .unwrap_or(draft.description.as_str())
            .to_string(),
        role_positioning: parsed
            .get("rolePositioning")
            .and_then(Value::as_str)
            .unwrap_or("工作流角色")
            .to_string(),
        summary: parsed
            .get("summary")
            .and_then(Value::as_str)
            .unwrap_or("工作流母版方案")
            .to_string(),
        visual_keywords: parsed
            .get("visualKeywords")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_else(|| vec!["pixel art".to_string()]),
    };
    plan.candidate_plans = ensure_candidate_plans(plan.candidate_plans, candidate_count);
    Ok(plan)
}
#[cfg(test)]
mod workflow_selected_plan_tests {
    use super::*;
    use serde_json::json;

    fn sample_master_plan() -> CharacterMasterPlanInput {
        CharacterMasterPlanInput {
            action_suggestions: CharacterActionSuggestions {
                attack: String::new(),
                idle: String::new(),
                walk: String::new(),
            },
            candidate_plans: vec![
                CharacterCandidatePlanInput {
                    focus: "方案 A".to_string(),
                    id: "A".to_string(),
                    master_image: None,
                    name: "方案 A".to_string(),
                    recommendation_score: 70,
                },
                CharacterCandidatePlanInput {
                    focus: "方案 B".to_string(),
                    id: "B".to_string(),
                    master_image: None,
                    name: "方案 B".to_string(),
                    recommendation_score: 95,
                },
            ],
            export_notes: Vec::new(),
            pixel_prompt: "pixel hero".to_string(),
            role_positioning: String::new(),
            summary: String::new(),
            visual_keywords: Vec::new(),
        }
    }

    fn sample_candidate_data() -> serde_json::Value {
        json!({
            "items": [
                {
                    "planId": "A",
                    "image": {
                        "height": 64,
                        "id": "img-a",
                        "projectRelativePath": "assets/.cache/character-candidates/task/a.png",
                        "role": "master",
                        "source": "ai-generated",
                        "width": 64
                    }
                },
                {
                    "planId": "B",
                    "image": {
                        "height": 64,
                        "id": "img-b",
                        "projectRelativePath": "assets/.cache/character-candidates/task/b.png",
                        "role": "master",
                        "source": "ai-generated",
                        "width": 64
                    }
                }
            ],
            "taskId": "task-1"
        })
    }

    #[test]
    fn resolves_default_plan_without_candidate_input() {
        let plan = workflow_resolve_selected_plan(&sample_master_plan(), None, "")
            .expect("default plan");
        assert_eq!(plan.id, "A");
        assert!(plan.master_image.is_none());
    }

    #[test]
    fn resolves_explicit_plan_id() {
        let plan = workflow_resolve_selected_plan(
            &sample_master_plan(),
            Some(&sample_candidate_data()),
            "A",
        )
        .expect("explicit plan");

        assert_eq!(plan.id, "A");
        let serialized = serde_json::to_value(&plan).expect("serialize plan");
        assert_eq!(
            serialized
                .pointer("/masterImage/projectRelativePath")
                .and_then(|value| value.as_str()),
            Some("assets/.cache/character-candidates/task/a.png")
        );
    }

    #[test]
    fn resolves_highest_recommendation_score_when_plan_id_empty() {
        let plan = workflow_resolve_selected_plan(
            &sample_master_plan(),
            Some(&sample_candidate_data()),
            "",
        )
        .expect("ranked plan");

        assert_eq!(plan.id, "B");
        assert_eq!(plan.recommendation_score, 95);
    }

    #[test]
    fn errors_when_candidate_items_empty() {
        let candidate_data = json!({ "items": [], "taskId": "task-1" });
        let result = workflow_resolve_selected_plan(&sample_master_plan(), Some(&candidate_data), "");

        match result {
            Err(error) => assert!(error.contains("候选图为空")),
            Ok(_) => panic!("expected empty candidate error"),
        }
    }

    #[test]
    fn falls_back_to_auto_recommendation_when_explicit_plan_id_missing() {
        let plan = workflow_resolve_selected_plan(
            &sample_master_plan(),
            Some(&sample_candidate_data()),
            "Z",
        )
        .expect("fallback plan");

        assert_eq!(plan.id, "B");
        assert_eq!(plan.recommendation_score, 95);
    }

    #[test]
    fn resolves_stale_asset_id_as_fallback() {
        let plan = workflow_resolve_selected_plan(
            &sample_master_plan(),
            Some(&sample_candidate_data()),
            "img-a",
        )
        .expect("asset id fallback");

        assert_eq!(plan.id, "A");
    }
}
