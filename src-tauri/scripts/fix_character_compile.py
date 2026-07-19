#!/usr/bin/env python3
"""Batch fix compile issues after character split."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"


def main() -> None:
    # Fix workflow.rs broken derive + add fit helpers from filmstrip
    workflow = ROOT / "character" / "workflow.rs"
    wtext = workflow.read_text(encoding="utf-8")
    wtext = wtext.replace(
        "#[derive(Deserialize)]\n\n\n#[cfg(test)]\n#[cfg(test)]",
        "#[cfg(test)]",
    )
    filmstrip = ROOT / "character" / "actions" / "filmstrip.rs"
    ftext = filmstrip.read_text(encoding="utf-8")
    marker = "const NORMALIZE_ALPHA_THRESHOLD"
    if marker in ftext and "pub(crate) fn workflow_fit_rgba_image_pixel_friendly" not in wtext:
        start = ftext.index(marker)
        end = ftext.index("pub(crate) fn character_record_target_canvas")
        fit_block = ftext[start:end]
        fit_block = fit_block.replace("fn workflow_fit_rgba_image_pixel_friendly", "pub(crate) fn workflow_fit_rgba_image_pixel_friendly")
        insert_at = wtext.index("pub(crate) fn character_record_target_canvas")
        wtext = wtext[:insert_at] + fit_block + wtext[insert_at:]
    workflow.write_text(wtext, encoding="utf-8")

    # Trim filmstrip duplicates
    lines = ftext.splitlines(keepends=True)
    out = []
    skip = False
    for line in lines:
        if line.startswith("fn pick_view_source_image"):
            skip = True
        if skip and line.startswith("const NORMALIZE_ALPHA_THRESHOLD"):
            skip = False
        if skip:
            continue
        if line.startswith("pub(crate) fn character_record_target_canvas"):
            skip = True
        if skip and line.startswith("pub(crate) fn workflow_post_process_action_frames"):
            skip = False
            out.append(line)
            continue
        if skip:
            continue
        out.append(line)
    filmstrip.write_text("".join(out), encoding="utf-8")

    # Fix filmstrip imports - use tracks for helpers
    ftext = filmstrip.read_text(encoding="utf-8")
    ftext = ftext.replace(
        "use crate::character::workflow::{workflow_fit_rgba_image_pixel_friendly, character_record_target_canvas};",
        "use crate::character::actions::tracks::{build_action_frame_image_asset, default_action_track_label, upsert_action_track_frames};\nuse crate::character::workflow::character_record_target_canvas;",
    )
    filmstrip.write_text(ftext, encoding="utf-8")

    # character/mod.rs - pub(crate) re-exports only
    (ROOT / "character" / "mod.rs").write_text(
        """pub mod actions;
pub mod generation;
pub mod model;
pub mod preview;
pub mod prompt;
pub mod store;
pub mod workflow;

pub use model::*;

pub(crate) use generation::master::generate_workflow_image_blocking;
pub(crate) use store::{get_character_asset, validate_character_id, validate_project_root};
pub(crate) use workflow::{
    character_image_to_workflow_output, character_processing_summary,
    character_record_preview_image_output, character_record_target_canvas,
    workflow_analyze_character, workflow_build_draft, workflow_build_draft_with_generation_count,
    workflow_create_character_asset, workflow_default_draft, workflow_default_master_plan,
    workflow_default_selected_plan, workflow_generate_action_frames, workflow_generate_candidates,
    workflow_generate_master_plan, workflow_generate_views, workflow_normalize_character_view,
    workflow_post_process_action_frames, workflow_remove_background, workflow_resolve_selected_plan,
    ActionFrameGenerationOptions,
};
""",
        encoding="utf-8",
    )

    # Add build_default_export_profiles to prompt if missing
    prompt = ROOT / "character" / "prompt.rs"
    ptext = prompt.read_text(encoding="utf-8")
    if "fn build_default_export_profiles" not in ptext:
        block = '''
pub(crate) fn build_default_export_profiles(
    draft: &CharacterWorkshopDraftInput,
) -> Vec<CharacterExportProfile> {
    let (frame_width, frame_height) = crate::character::generation::provider::resolve_canvas_size(draft);

    vec![
        CharacterExportProfile {
            fps: 12,
            frame_height,
            frame_width,
            id: "png-sequence-default".to_string(),
            padding: 0,
            spacing: 0,
            target: "png-sequence".to_string(),
            trim: false,
        },
        CharacterExportProfile {
            fps: 12,
            frame_height,
            frame_width,
            id: "spritesheet-default".to_string(),
            padding: 0,
            spacing: 0,
            target: "spritesheet".to_string(),
            trim: false,
        },
    ]
}

'''
        ptext += block
        prompt.write_text(ptext, encoding="utf-8")

    # provider pub(crate) for key exports
    provider = ROOT / "character" / "generation" / "provider.rs"
    ptext = provider.read_text(encoding="utf-8")
    for name in [
        "load_image_provider",
        "resolve_image_model",
        "resolve_canvas_size",
        "resolve_canvas_size_label",
        "record_target_canvas",
        "resolve_api_generation_size",
        "request_character_view_image_url",
        "request_character_image_url",
        "model_name_is_image_edit",
        "download_generated_image",
        "build_image_data_url",
        "build_image_data_url_with_mime",
        "infer_image_mime",
        "resolve_project_image_path",
        "select_character_view_index",
        "remove_background_from_image_bytes",
        "build_background_removal_output_from_png",
        "build_rembg_warnings",
    ]:
        ptext = ptext.replace(f"fn {name}(", f"pub(crate) fn {name}(")
    provider.write_text(ptext, encoding="utf-8")

    # Add input structs to model if missing
    model = ROOT / "character" / "model.rs"
    mtext = model.read_text(encoding="utf-8")
    if "PostProcessActionFramesInput" not in mtext:
        mtext += '''
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostProcessActionFramesInput {
    pub project_root: String,
    pub character_id: String,
    #[serde(default)]
    pub action_ids: Vec<String>,
    #[serde(default)]
    pub matting_color_space: Option<String>,
    #[serde(default)]
    pub use_magenta_key: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManageCharacterActionTrackInput {
    pub project_root: String,
    pub character_id: String,
    pub action_id: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReextractFilmstripFramesInput {
    pub project_root: String,
    pub character_id: String,
    pub action_id: String,
    #[serde(default)]
    pub cut_positions: Vec<u32>,
}
'''
        model.write_text(mtext, encoding="utf-8")

    print("Batch fixes applied.")


if __name__ == "__main__":
    main()
