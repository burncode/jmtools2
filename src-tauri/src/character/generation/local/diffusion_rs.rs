#[cfg(feature = "local-diffusion")]
mod diffusion_impl;

use std::path::{Path, PathBuf};

use tauri::AppHandle;

use super::engine::LocalInferenceEngine;
use super::types::{GenerateImageRequest, ModelProfile};

pub struct DiffusionRsBackend {
    ready_profile_id: Option<String>,
}

impl DiffusionRsBackend {
    pub fn new() -> Self {
        Self {
            ready_profile_id: None,
        }
    }
}

impl Default for DiffusionRsBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl LocalInferenceEngine for DiffusionRsBackend {
    fn id(&self) -> &'static str {
        "diffusion-rs"
    }

    fn ensure_ready(
        &mut self,
        profile: &ModelProfile,
        models_root: &PathBuf,
        _app: &AppHandle,
    ) -> Result<(), String> {
        if self.ready_profile_id.as_deref() == Some(profile.id.as_str()) {
            return Ok(());
        }

        std::fs::create_dir_all(models_root)
            .map_err(|error| format!("创建本地模型目录失败：{error}"))?;

        #[cfg(feature = "local-diffusion")]
        {
            diffusion_impl::warmup_profile(profile, models_root)?;
            self.ready_profile_id = Some(profile.id.clone());
            return Ok(());
        }

        #[cfg(not(feature = "local-diffusion"))]
        {
            let _ = models_root;
            Err(
                "当前构建未启用 local-diffusion 特性，无法使用 diffusion-rs 后端。请使用 Ollama 备选或重新编译。"
                    .to_string(),
            )
        }
    }

    fn generate_png(
        &mut self,
        profile: &ModelProfile,
        models_root: &PathBuf,
        request: &GenerateImageRequest,
        _resolved_loras: &[super::lora::ResolvedLora],
        output_path: &PathBuf,
        app: &AppHandle,
    ) -> Result<(), String> {
        self.ensure_ready(profile, models_root, app)?;

        #[cfg(feature = "local-diffusion")]
        {
            return diffusion_impl::generate_png(profile, models_root, request, output_path);
        }

        #[cfg(not(feature = "local-diffusion"))]
        {
            let _ = (profile, models_root, request, output_path);
            Err("diffusion-rs 后端未编译。".to_string())
        }
    }
}

pub fn diffusion_rs_available() -> bool {
    cfg!(feature = "local-diffusion")
}

pub fn diffusion_rs_detail() -> &'static str {
    if cfg!(feature = "local-diffusion") {
        "已编译 diffusion-rs（stable-diffusion.cpp）内嵌后端。"
    } else {
        "默认使用 Runtime 扩展包（diffusion-rs-cli）；内嵌编译为可选维护者路径。"
    }
}

pub fn ensure_parent_directory(output_path: &Path) -> Result<(), String> {
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("创建输出目录失败：{error}"))?;
    }
    Ok(())
}
