pub mod activity;
pub mod backends;
pub mod catalog;
pub mod diffusion_rs;
pub mod download_cache;
pub mod download_control;
pub mod download_http;
pub mod download_paths;
pub mod download_progress;
pub mod engine;
pub mod generation_limits;
pub mod hardware;
pub mod hardware_cache;
pub mod hf_download;
pub mod lora;
pub mod lora_assets;
pub mod model_assets;
pub mod ollama;
pub mod provider_bridge;
pub mod recommender;
pub mod resolution;
pub mod runtime;
pub mod runtime_pack;
pub mod sd_cli_capabilities;
pub mod sd_cpp_cli;
pub mod settings;
pub mod types;

pub use download_control::{
    apply_download_interrupt, begin_lora_download, begin_model_download, clear_task,
    finish_running_task, get_download_task, interrupt_to_error, mark_cancelled, mark_paused,
    request_cancel, request_pause, resume_lora_download, resume_model_download,
    DownloadInterrupt, DownloadTaskKind, DownloadTaskState, LocalDownloadTask,
    DOWNLOAD_CANCELLED_MESSAGE, DOWNLOAD_PAUSED_MESSAGE,
};
pub use activity::{
    clear_local_inference_activity, get_local_inference_activity, set_local_inference_activity,
    LocalInferenceActivity, LocalInferencePhase,
};
pub use backends::list_backend_evaluations;
pub use hardware_cache::{resolve_hardware_profile, ResolvedHardwareProfile};
pub use hardware::probe_hardware_profile;
pub use lora_assets::{
    delete_lora_assets, ensure_lora_assets, import_lora_from_file, lora_assets_installed,
    lora_destination_path,
};
pub use lora::{append_lora_prompt_tags, list_compatible_loras, resolve_lora_model_dir, ResolvedLora};
pub use model_assets::{
    delete_partial_profile_assets, ensure_profile_assets, import_model_bundle_from_directory,
    profile_asset_file_statuses, profile_assets_installed, resolve_profile_assets,
    ResolvedProfileAssets,
};
pub use download_cache::{ensure_hf_cache_root, models_hf_cache_root, HF_CACHE_SEGMENT};
pub use download_paths::{
    models_download_part_path, models_download_temp_dir, models_downloads_temp_root,
    DOWNLOADS_TEMP_SEGMENT,
};
pub use provider_bridge::{is_local_image_preset, local_models_directory};
pub use runtime::{
    build_lora_statuses, build_profile_statuses, list_catalog_profiles, persist_local_settings,
    read_local_settings, LocalInferenceRuntime,
};
pub use runtime_pack::{
    diffusion_runtime_available, download_runtime, import_runtime_from_zip, list_runtime_statuses,
    remove_runtime, resolve_cli_executable, runtime_directory, set_active_runtime,
    InstalledRuntimeRecord, LocalDiffusionRuntimeStatus,
};
pub use settings::{
    load_local_inference_settings, normalize_huggingface_endpoint, resolve_hf_endpoint,
    rewrite_huggingface_url, save_local_inference_settings, DEFAULT_HF_ENDPOINT,
};
pub use types::*;
