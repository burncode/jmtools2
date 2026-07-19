mod commands;
pub mod character;
mod engine;
pub mod image_pipeline;
mod logging;
mod prompt_compiler;
mod storage;
mod style_compiler;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .setup(|app| {
            logging::init(app.handle())?;
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::ai_generation::generate_ai_text,
            commands::ai_models::delete_ai_model_provider,
            commands::ai_models::delete_ai_provider_model,
            commands::ai_models::list_ai_provider_models,
            commands::ai_models::list_ai_model_providers,
            commands::ai_models::refresh_ai_provider_models,
            commands::ai_models::save_ai_provider_model,
            commands::ai_models::save_ai_model_provider,
            commands::ai_models::test_ai_model_provider,
            commands::asset_tools::load_asset_tool_source_preview,
            commands::asset_tools::run_asset_tool,
            commands::background_tools::list_background_removal_models,
            commands::background_tools::test_background_removal_runtime,
            commands::background_tools::warmup_background_removal_model,
            commands::character_archetypes::delete_project_character_archetype,
            commands::character_archetypes::list_project_character_archetypes,
            commands::character_archetypes::save_project_character_archetype,
            commands::character_pipeline::analyze_character,
            commands::character_pipeline::export_character_animation,
            commands::character_pipeline::generate_character_action_frames,
            commands::character_pipeline::generate_character_master_plan,
            commands::character_pipeline::normalize_character_view,
            commands::character_pipeline::optimize_character_description,
            commands::characters::bind_character_tool_result,
            commands::characters::create_character_asset,
            commands::characters::delete_character_asset,
            commands::characters::generate_character_master_candidates,
            commands::characters::generate_character_master_image,
            commands::characters::generate_character_view_images,
            commands::characters::get_character_asset,
            commands::characters::hydrate_character_action_previews,
            commands::characters::add_character_action_track,
            commands::characters::remove_character_action_track,
            commands::characters::post_process_action_frames,
            commands::characters::import_character_reference_images,
            commands::characters::list_character_assets,
            commands::characters::list_character_library,
            commands::characters::list_character_summaries,
            commands::characters::prepare_character_view_style,
            commands::characters::preview_candidate_post_process,
            commands::characters::preview_character_generation_prompts,
            commands::characters::reextract_filmstrip_frames,
            commands::characters::remove_character_background,
            commands::characters::toggle_character_favorite,
            commands::diagnostics::export_log_entries_command,
            commands::diagnostics::get_log_directory,
            commands::diagnostics::get_log_settings,
            commands::diagnostics::list_log_files_command,
            commands::diagnostics::open_log_directory,
            commands::diagnostics::query_log_entries_command,
            commands::diagnostics::set_log_settings,
            commands::logging::write_app_log,
            commands::local_models::cancel_local_model_download_command,
            commands::local_models::delete_local_model_download_command,
            commands::local_models::download_local_diffusion_runtime,
            commands::local_models::download_local_lora_command,
            commands::local_models::download_local_model_profile,
            commands::local_models::get_local_diffusion_runtime_directory,
            commands::local_models::get_local_download_task_command,
            commands::local_models::get_local_generation_limits,
            commands::local_models::get_sd_cli_capabilities_command,
            commands::local_models::get_local_inference_activity_command,
            commands::local_models::get_local_inference_settings,
            commands::local_models::import_local_diffusion_runtime_from_zip,
            commands::local_models::import_local_lora_command,
            commands::local_models::import_local_model_bundle_from_directory,
            commands::local_models::list_compatible_local_loras,
            commands::local_models::list_local_backend_evaluations,
            commands::local_models::list_local_diffusion_runtimes,
            commands::local_models::list_local_loras,
            commands::local_models::list_local_model_catalog,
            commands::local_models::list_local_model_profiles,
            commands::local_models::pause_local_model_download_command,
            commands::local_models::probe_local_hardware,
            commands::local_models::remove_local_diffusion_runtime,
            commands::local_models::resume_local_lora_download_command,
            commands::local_models::resume_local_model_download_command,
            commands::local_models::save_local_inference_settings_command,
            commands::local_models::set_active_local_diffusion_runtime,
            commands::local_models::test_local_image_generation,
            commands::project::create_project,
            commands::project::create_project_manifest,
            commands::project::list_recent_projects,
            commands::project::open_project,
            commands::project_character_generation::get_project_character_generation,
            commands::project_character_generation::set_project_layout_anchor_character,
            commands::project_character_generation::update_project_character_generation,
            commands::settings::get_app_settings,
            commands::settings::save_app_settings,
            commands::style_presets::delete_style_preset,
            commands::style_presets::get_style_preset,
            commands::style_presets::list_style_presets,
            commands::style_presets::save_style_preset,
            commands::system::app_health,
            commands::workflows::list_workflow_node_descriptors,
            commands::workflows::cancel_workflow_run,
            commands::workflows::delete_workflow_definition,
            commands::workflows::export_workflow_definition,
            commands::workflows::get_workflow_definition,
            commands::workflows::get_workflow_awaiting_input,
            commands::workflows::get_workflow_run,
            commands::workflows::import_workflow_from_file,
            commands::workflows::list_workflow_definitions,
            commands::workflows::list_workflow_runs,
            commands::workflows::preflight_workflow,
            commands::workflows::retry_workflow_node,
            commands::workflows::resume_workflow_run,
            commands::workflows::run_workflow,
            commands::workflows::save_workflow_definition
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
