use std::path::Path;

use crate::character::model::*;
use crate::character::prompt::{
    build_character_candidate_image_prompt, build_character_candidate_turnaround_prompt,
};
use crate::character::store::validate_project_root;

pub(crate) fn preview_character_generation_prompts_blocking(
    input: PreviewCharacterGenerationPromptsInput,
) -> Result<PreviewCharacterGenerationPromptsResult, String> {
    let project_root = validate_project_root(&input.project_root)?;
    preview_character_generation_prompts_for_root(&project_root, &input)
}

fn preview_character_generation_prompts_for_root(
    project_root: &Path,
    input: &PreviewCharacterGenerationPromptsInput,
) -> Result<PreviewCharacterGenerationPromptsResult, String> {
    let uses_turnaround_sheet = matches!(input.draft.direction.as_str(), "four" | "eight");
    let compiled_prompt = input.compiled_prompt.as_deref();

    let prompts = input
        .master_plan
        .candidate_plans
        .iter()
        .map(|candidate_plan| {
            let prompt = if uses_turnaround_sheet {
                build_character_candidate_turnaround_prompt(
                    project_root,
                    &input.draft,
                    &input.master_plan,
                    candidate_plan,
                    compiled_prompt,
                )
            } else {
                build_character_candidate_image_prompt(
                    project_root,
                    &input.draft,
                    &input.master_plan,
                    candidate_plan,
                    compiled_prompt,
                    None,
                )
            };

            PreviewCharacterGenerationPromptItem {
                plan_id: candidate_plan.id.clone(),
                plan_name: candidate_plan.name.clone(),
                prompt,
            }
        })
        .collect();

    Ok(PreviewCharacterGenerationPromptsResult { prompts })
}
