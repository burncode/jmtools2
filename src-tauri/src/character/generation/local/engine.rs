use std::path::PathBuf;

use tauri::AppHandle;

use super::types::{GenerateImageRequest, ModelProfile};

pub trait LocalInferenceEngine: Send {
    fn id(&self) -> &'static str;

    fn ensure_ready(
        &mut self,
        profile: &ModelProfile,
        models_root: &PathBuf,
        app: &AppHandle,
    ) -> Result<(), String>;

    fn generate_png(
        &mut self,
        profile: &ModelProfile,
        models_root: &PathBuf,
        request: &GenerateImageRequest,
        resolved_loras: &[super::lora::ResolvedLora],
        output_path: &PathBuf,
        app: &AppHandle,
    ) -> Result<(), String>;

    fn supports_progress(&self) -> bool {
        false
    }
}
