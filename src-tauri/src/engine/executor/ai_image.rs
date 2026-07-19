use std::path::Path;

use serde_json::Value;
use tauri::AppHandle;

use super::ExecutorContext;

pub fn generate_workflow_image(
    app: &AppHandle,
    project_root: &Path,
    prompt: &str,
    provider_id: Option<String>,
    model: Option<String>,
    mut context: Option<&mut ExecutorContext<'_>>,
) -> Result<Value, String> {
    if let Some(context) = context.as_deref_mut() {
        context.report_progress(45);
        context.check_canceled()?;
    }

    let image = crate::character::generate_workflow_image_blocking(
        app,
        project_root,
        prompt,
        provider_id,
        model,
    )?;

    if let Some(context) = context.as_deref_mut() {
        context.report_progress(80);
    }

    Ok(image)
}
