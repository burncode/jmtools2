#!/usr/bin/env python3
"""Split commands/characters.rs into character/ domain modules and commands/characters/ wrappers."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
ORIG = SRC / "commands" / "characters.rs"

# (start_line, end_line) inclusive, 1-based
SECTIONS: dict[str, tuple[int, int]] = {
    "character/model.rs": (26, 667),
    "character/store.rs": (2036, 2669),
    "character/preview.rs": (421, 426),  # CharacterPreviewScope only - rest merged below
    "character/preview_paths.rs": (2188, 2331),
    "character/preview_hydrate.rs": (4734, 4740),
    "character/prompt.rs": (2670, 3634),
    "character/generation/settings.rs": (2670, 2730),
    "character/generation/provider.rs": (2731, 4727),
    "character/generation/master.rs": (1322, 2035),
    "character/generation/views.rs": (1500, 1910),
    "character/generation/views_slots.rs": (3271, 3470),
    "character/actions/tracks.rs": (4741, 4843),
    "character/actions/tracks_upsert.rs": (6439, 6607),
    "character/actions/filmstrip.rs": (5660, 6920),
    "character/workflow.rs": (4844, 5659),
    "character/workflow_canvas.rs": (6767, 6781),
    "character/workflow_plan.rs": (5043, 5117),
    "character/workflow_plan_prompt.rs": (5197, 5397),
    "character/validate_input.rs": (2081, 2120),
    "character/attach_master.rs": (2120, 2187),
    "character/store_ids.rs": (2332, 2397),
    "commands/characters/crud.rs": (668, 1284),
    "commands/characters/generation.rs": (1286, 1320),
    "commands/characters/processing.rs": (893, 1168),
    "commands/characters/processing_bg.rs": (1017, 1080),
    "commands/characters/actions.rs": (6783, 7126),
    "character/workflow_tests.rs": (7128, 7269),
}


def read_lines() -> list[str]:
    return ORIG.read_text(encoding="utf-8").splitlines(keepends=True)


def extract(lines: list[str], start: int, end: int) -> str:
    return "".join(lines[start - 1 : end])


def make_pub(crate_fields: str) -> str:
    """Convert private struct fields to pub(crate) for cross-module access."""
    return re.sub(
        r"^(\s+)([a-z_][a-z0-9_]*)(\s*:)",
        r"\1pub(crate) \2\3",
        crate_fields,
        flags=re.MULTILINE,
    )


def main() -> None:
    lines = read_lines()
    out_dir = SRC

    # model.rs with pub(crate) fields on structs
    model_body = extract(lines, 26, 667)
    model_body = re.sub(
        r"(#\[derive\([^\]]+\)\]\s*\n(?:#\[serde[^\]]*\]\s*\n)*pub struct \w+\s*\{)",
        lambda m: m.group(0),
        model_body,
    )
    # Add pub(crate) to non-pub fields in pub structs (skip already pub/pub(crate)/fn default)
    def fix_struct_fields(content: str) -> str:
        result = []
        in_struct = False
        struct_has_pub = False
        for line in content.splitlines(keepends=True):
            if re.match(r"^pub struct ", line):
                in_struct = True
                struct_has_pub = True
                result.append(line)
                continue
            if in_struct:
                if line.strip() == "}":
                    in_struct = False
                    result.append(line)
                    continue
                if struct_has_pub and re.match(r"^\s+[a-z_]", line) and "pub(" not in line and "pub " not in line:
                    line = re.sub(r"^(\s+)", r"\1pub(crate) ", line, count=1)
                result.append(line)
                continue
            if re.match(r"^struct ", line):
                in_struct = True
                struct_has_pub = False
                result.append(line)
                continue
            result.append(line)
        return "".join(result)

    model_body = fix_struct_fields(model_body)
    # StoredImageProvider/Model need pub(crate) on struct itself
    model_body = model_body.replace("struct CharacterGenerationSettings {", "pub(crate) struct CharacterGenerationSettings {")
    model_body = model_body.replace("struct StoredImageProvider {", "pub(crate) struct StoredImageProvider {")
    model_body = model_body.replace("struct StoredImageModel {", "pub(crate) struct StoredImageModel {")

    headers = {
        "character/model.rs": """use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

""",
        "character/store.rs": """use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::Value;

use crate::character::model::*;
use crate::storage::database::{
    current_timestamp, ensure_project_schema, open_project_database,
};

pub(crate) const PROJECT_MANIFEST_FILE_NAME: &str = "jmproject.json";
pub(crate) const CHARACTER_INDEX_FILE_NAME: &str = "index.json";

""",
        "character/preview.rs": """use std::path::Path;

use crate::character::model::*;
use crate::character::store::{normalize_cache_segment, read_character_index, CHARACTER_INDEX_FILE_NAME};
use crate::storage::database::open_project_database;

""",
        "character/prompt.rs": """use std::collections::BTreeMap;
use std::path::Path;

use rusqlite::Connection;
use serde_json::Value;

use crate::character::generation::settings::{
    load_character_generation_settings, resolve_character_edit_binding,
    validate_character_generation_settings,
};
use crate::character::model::*;
use crate::character::store::{load_character_display_name, validate_project_root};
use crate::commands::project_character_generation::{
    augment_character_prompt, read_project_character_generation, ProjectCharacterGenerationSettings,
};
use crate::storage::database::{ensure_ai_schema, ensure_app_settings_schema, open_app_database};
use tauri::AppHandle;

""",
        "character/generation/settings.rs": """use rusqlite::Connection;

use crate::character::model::CharacterGenerationSettings;
use crate::character::generation::provider::{load_image_provider, resolve_image_model, StoredImageModel, StoredImageProvider};
use crate::storage::database::{ensure_ai_schema, ensure_app_settings_schema, APP_SETTINGS_KEY};

""",
        "character/generation/provider.rs": """use std::collections::VecDeque;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{imageops, DynamicImage, ImageFormat, Rgba, RgbaImage};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use tracing::warn;

use crate::character::model::*;
use crate::commands::background_tools::{run_rembg_remove, RembgRemovalOptions};
use crate::commands::project_character_generation::ProjectCharacterGenerationSettings;
use crate::storage::database::open_app_database;
use tauri::AppHandle;

pub(crate) use crate::character::model::{StoredImageModel, StoredImageProvider};

""",
        "character/generation/master.rs": """use std::fs;
use std::path::{Path, PathBuf};
use std::thread;

use image::{DynamicImage, ImageFormat, RgbaImage};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tracing::info;

use crate::character::generation::provider::*;
use crate::character::generation::settings::*;
use crate::character::model::*;
use crate::character::preview::{attach_character_image_previews, CharacterPreviewScope};
use crate::character::prompt::*;
use crate::character::store::*;
use crate::storage::database::{
    current_timestamp, ensure_ai_schema, ensure_app_settings_schema, open_app_database,
};

""",
        "character/generation/views.rs": """use std::fs;
use std::path::Path;

use image::{imageops, DynamicImage, ImageFormat, RgbaImage};
use tauri::AppHandle;
use tracing::info;

use crate::character::generation::master::emit_character_generation_progress;
use crate::character::generation::provider::*;
use crate::character::generation::settings::*;
use crate::character::model::*;
use crate::character::preview::{attach_character_image_previews, CharacterPreviewScope};
use crate::character::prompt::*;
use crate::character::store::*;
use crate::storage::database::{current_timestamp, open_app_database, ensure_ai_schema, ensure_app_settings_schema};
use tauri::AppHandle as _;

""",
        "character/actions/tracks.rs": """use crate::character::model::*;

""",
        "character/actions/filmstrip.rs": """use std::fs;
use std::path::Path;

use image::{imageops, ImageFormat, RgbaImage};
use rusqlite::Connection;
use tauri::AppHandle;
use tracing::info;

use crate::character::actions::tracks::*;
use crate::character::generation::provider::*;
use crate::character::generation::settings::*;
use crate::character::model::*;
use crate::character::preview::{attach_character_image_previews, populate_character_image_paths, CharacterPreviewScope};
use crate::character::prompt::*;
use crate::character::store::*;
use crate::character::workflow::{workflow_fit_rgba_image_pixel_friendly, character_record_target_canvas};
use crate::storage::database::{
    current_timestamp, ensure_ai_schema, ensure_app_settings_schema, open_app_database,
};

""",
        "character/workflow.rs": """use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use image::{imageops, GenericImageView, ImageFormat, RgbaImage};
use rusqlite::Connection;
use serde_json::{json, Value};
use tauri::AppHandle;

use crate::character::actions::filmstrip::workflow_generate_action_frames;
use crate::character::generation::master::{generate_character_master_candidates_blocking, generate_workflow_image_blocking};
use crate::character::generation::provider::*;
use crate::character::generation::settings::*;
use crate::character::generation::views::generate_character_view_images_blocking;
use crate::character::model::*;
use crate::character::preview::{attach_character_image_previews, CharacterPreviewScope};
use crate::character::prompt::*;
use crate::character::store::*;
use crate::commands::project_character_generation::read_project_character_generation;
use crate::storage::database::{current_timestamp, ensure_ai_schema, ensure_app_settings_schema, open_app_database};

""",
    }

    # Write merged preview.rs
    preview_content = headers["character/preview.rs"]
    preview_content += extract(lines, 421, 426).replace("enum CharacterPreviewScope", "pub(crate) enum CharacterPreviewScope")
    preview_content += "\n"
    preview_content += extract(lines, 2188, 2331)
    preview_content += extract(lines, 4734, 4740)
    (out_dir / "character" / "preview.rs").parent.mkdir(parents=True, exist_ok=True)
    (out_dir / "character" / "preview.rs").write_text(preview_content, encoding="utf-8")

    # Write model
    (out_dir / "character" / "model.rs").write_text(headers["character/model.rs"] + model_body, encoding="utf-8")

    # Merge store
    store_content = headers["character/store.rs"]
    store_content += extract(lines, 2036, 2080)
    store_content += extract(lines, 2081, 2120)
    store_content += extract(lines, 2332, 2397)
    store_content += extract(lines, 2398, 2669)
    (out_dir / "character" / "store.rs").write_text(store_content, encoding="utf-8")

    # attach_master in store or preview - put in preview as extra
    attach = extract(lines, 2120, 2187)
    (out_dir / "character" / "preview.rs").write_text(
        (out_dir / "character" / "preview.rs").read_text(encoding="utf-8") + "\n" + attach,
        encoding="utf-8",
    )

    # prompt - lines 2865-3634 but skip settings duplicate 2670-2730
    prompt_content = """use std::collections::BTreeMap;
use std::path::Path;

use rusqlite::Connection;

use crate::character::model::*;
use crate::character::store::{normalize_strings, validate_project_root};
use crate::commands::project_character_generation::{
    augment_character_prompt, read_project_character_generation, ProjectCharacterGenerationSettings,
};
use crate::storage::database::open_app_database;
use tauri::AppHandle;

"""
    prompt_content += extract(lines, 2865, 3634)
    (out_dir / "character" / "prompt.rs").write_text(prompt_content, encoding="utf-8")

    # generation modules
    (out_dir / "character" / "generation").mkdir(parents=True, exist_ok=True)
    settings_body = extract(lines, 2670, 2730)
    settings_body = settings_body.replace("struct CharacterGenerationSettings", "pub(crate) struct CharacterGenerationSettings")
    (out_dir / "character" / "generation" / "settings.rs").write_text(
        """use rusqlite::Connection;

use crate::character::generation::provider::{load_image_provider, resolve_image_model, StoredImageModel, StoredImageProvider};
use crate::storage::database::APP_SETTINGS_KEY;

pub(crate) const APP_SETTINGS_KEY_LOCAL: &str = "app.settings";

"""
        + settings_body.replace("APP_SETTINGS_KEY", "APP_SETTINGS_KEY_LOCAL"),
        encoding="utf-8",
    )

    provider_content = headers["character/generation/provider.rs"] + extract(lines, 2731, 4727)
    (out_dir / "character" / "generation" / "provider.rs").write_text(provider_content, encoding="utf-8")

    master_content = headers["character/generation/master.rs"] + extract(lines, 1322, 2035)
    (out_dir / "character" / "generation" / "master.rs").write_text(master_content, encoding="utf-8")

    views_content = headers["character/generation/views.rs"]
    views_content += extract(lines, 1500, 1910)
    views_content += "\n"
    views_content += extract(lines, 3271, 3470)
    (out_dir / "character" / "generation" / "views.rs").write_text(views_content, encoding="utf-8")

    # actions
    (out_dir / "character" / "actions").mkdir(parents=True, exist_ok=True)
    tracks_content = headers["character/actions/tracks.rs"]
    tracks_content += extract(lines, 4741, 4843)
    tracks_content += "\n"
    tracks_content += extract(lines, 6439, 6607)
    (out_dir / "character" / "actions" / "tracks.rs").write_text(tracks_content, encoding="utf-8")

    filmstrip_content = headers["character/actions/filmstrip.rs"]
    filmstrip_content += extract(lines, 5660, 6920)
    (out_dir / "character" / "actions" / "filmstrip.rs").write_text(filmstrip_content, encoding="utf-8")

    # workflow
    workflow_content = headers["character/workflow.rs"]
    workflow_content += extract(lines, 4844, 5042)
    workflow_content += extract(lines, 5043, 5117)
    workflow_content += extract(lines, 5118, 5659)
    workflow_content += extract(lines, 6767, 6781)
    workflow_content += "\n\n#[cfg(test)]\n"
    workflow_content += extract(lines, 7128, 7269)
    (out_dir / "character" / "workflow.rs").write_text(workflow_content, encoding="utf-8")

    # commands
    (out_dir / "commands" / "characters").mkdir(parents=True, exist_ok=True)

    crud_header = """use std::fs;
use std::path::PathBuf;

use tracing::info;

use crate::character::actions::tracks::build_default_action_tracks;
use crate::character::model::*;
use crate::character::preview::{
    attach_character_image_previews, attach_selected_master_image, hydrate_character_action_tracks,
    populate_action_frame_paths, populate_character_image_paths, to_character_library_record,
    CharacterPreviewScope,
};
use crate::character::prompt::{
    build_character_generation_config, build_default_export_profiles, build_initial_character_views,
    build_initial_processing_metadata,
};
use crate::character::store::*;
use crate::storage::database::current_timestamp;

"""
    crud_content = crud_header + extract(lines, 668, 892) + extract(lines, 1170, 1284)
    (out_dir / "commands" / "characters" / "crud.rs").write_text(crud_content, encoding="utf-8")

    gen_header = """use tauri::AppHandle;

use crate::character::generation::master::{
    generate_character_master_candidates_blocking, generate_character_master_image_blocking,
};
use crate::character::generation::views::generate_character_view_images_blocking;
use crate::character::model::*;

"""
    (out_dir / "commands" / "characters" / "generation.rs").write_text(
        gen_header + extract(lines, 1286, 1320), encoding="utf-8"
    )

    proc_header = """use std::fs;
use std::path::{Path, PathBuf};

use tracing::info;

use crate::character::generation::provider::{
    build_background_removal_output_from_png, build_image_data_url, build_rembg_warnings,
    remove_background_from_image_bytes, resolve_project_image_path, select_character_view_index,
    BackgroundRemovalOutput, ProceduralBackgroundRemovalOptions,
};
use crate::character::generation::views::{build_initial_character_views, prepare_character_view_slots};
use crate::character::model::*;
use crate::character::preview::attach_character_image_previews;
use crate::character::store::{
    normalize_cache_segment, upsert_character_database, upsert_character_index, validate_character_id,
    validate_project_root, write_character_record,
};
use crate::commands::background_tools::{run_rembg_remove, RembgRemovalOptions};
use crate::commands::characters::crud::get_character_asset;
use crate::storage::database::current_timestamp;

"""
    proc_content = proc_header + extract(lines, 893, 1016) + extract(lines, 1017, 1080) + extract(lines, 1082, 1168)
    (out_dir / "commands" / "characters" / "processing.rs").write_text(proc_content, encoding="utf-8")

    actions_header = """use std::fs;
use std::path::Path;

use image::ImageFormat;
use tracing::info;

use crate::character::actions::filmstrip::workflow_post_process_action_frames;
use crate::character::actions::tracks::{
    build_action_frame_image_asset, default_action_track_label, upsert_action_track_frames,
};
use crate::character::generation::provider::resolve_project_image_path;
use crate::character::generation::views::record_target_canvas;
use crate::character::model::*;
use crate::character::preview::{attach_character_image_previews, populate_character_image_paths, CharacterPreviewScope};
use crate::character::store::{
    get_character_asset, upsert_character_index, validate_character_id, validate_project_root,
    write_character_record,
};
use crate::commands::characters::crud::get_character_asset as get_character_asset_cmd;
use crate::image_pipeline::action_quality::score_action_frames;
use crate::image_pipeline::segment::{extract_filmstrip_frames_with_cuts, ExtractFilmstripOptions};
use crate::storage::database::current_timestamp;

"""
    actions_content = actions_header + extract(lines, 6920, 7126)
    actions_content = actions_content.replace(
        "get_character_asset(input.project_root.clone(), character_id)?",
        "get_character_asset_cmd(input.project_root.clone(), character_id)?",
        1,
    )
    (out_dir / "commands" / "characters" / "actions.rs").write_text(actions_content, encoding="utf-8")

    print("Split complete. Writing mod.rs files...")


if __name__ == "__main__":
    main()
