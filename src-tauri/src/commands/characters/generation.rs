use tauri::AppHandle;

use crate::character::generation::master::{
    generate_character_master_candidates_blocking, generate_character_master_image_blocking,
};
use crate::character::generation::candidate_preview::preview_candidate_post_process_blocking;
use crate::character::generation::prompt_preview::preview_character_generation_prompts_blocking;
use crate::character::generation::views::generate_character_view_images_blocking;
use crate::character::model::*;

#[tauri::command]
pub async fn preview_character_generation_prompts(
    input: PreviewCharacterGenerationPromptsInput,
) -> Result<PreviewCharacterGenerationPromptsResult, String> {
    tauri::async_runtime::spawn_blocking(move || preview_character_generation_prompts_blocking(input))
        .await
        .map_err(|error| format!("图像 Prompt 预览任务执行失败：{error}"))?
}

#[tauri::command]
pub async fn preview_candidate_post_process(
    input: PreviewCandidatePostProcessInput,
) -> Result<PreviewCandidatePostProcessResult, String> {
    tauri::async_runtime::spawn_blocking(move || preview_candidate_post_process_blocking(input))
        .await
        .map_err(|error| format!("候选后处理预览任务执行失败：{error}"))?
}

#[tauri::command]
pub async fn generate_character_master_image(
    app: AppHandle,
    input: GenerateCharacterMasterImageInput,
) -> Result<CharacterAssetRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        generate_character_master_image_blocking(app, input)
    })
    .await
    .map_err(|error| format!("角色母版图生成任务执行失败：{error}"))?
}

#[tauri::command]
pub async fn generate_character_master_candidates(
    app: AppHandle,
    input: GenerateCharacterMasterCandidatesInput,
) -> Result<Vec<CharacterMasterCandidateImage>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        generate_character_master_candidates_blocking(app, input)
    })
    .await
    .map_err(|error| format!("角色候选图生成任务执行失败：{error}"))?
}

#[tauri::command]
pub async fn generate_character_view_images(
    app: AppHandle,
    input: GenerateCharacterViewImagesInput,
) -> Result<CharacterAssetRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        generate_character_view_images_blocking(app, input)
    })
    .await
    .map_err(|error| format!("角色视图生成任务执行失败：{error}"))?
}
