use std::path::Path;
use std::process::Command;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tracing::info;

use super::runtime_pack::resolve_cli_executable;

static CAPABILITIES_CACHE: Mutex<Option<SdCliCapabilities>> = Mutex::new(None);

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SdCliCapabilities {
    pub available: bool,
    pub runtime_version: Option<String>,
    pub supported_flags: Vec<String>,
    pub img2img_supported: bool,
    pub img2img_init_flag: Option<String>,
    pub img2img_mode_flag: Option<String>,
}

const PROBED_FLAGS: &[(&str, &str)] = &[
    ("offloadToCpu", "--offload-to-cpu"),
    ("diffusionFa", "--diffusion-fa"),
    ("vaeOnCpu", "--vae-on-cpu"),
    ("vaeTiling", "--vae-tiling"),
    ("clipOnCpu", "--clip-on-cpu"),
    ("vaeTileOverlap", "--vae-tile-overlap"),
    ("loraApplyMode", "--lora-apply-mode"),
    ("paramsBackend", "--params-backend"),
    ("backend", "--backend"),
    ("strength", "--strength"),
    ("seed", "--seed"),
];

pub fn get_sd_cli_capabilities(app: &AppHandle) -> SdCliCapabilities {
    if let Ok(cache) = CAPABILITIES_CACHE.lock() {
        if let Some(value) = cache.clone() {
            return value;
        }
    }

    let capabilities = probe_sd_cli_capabilities(app);
    if let Ok(mut cache) = CAPABILITIES_CACHE.lock() {
        *cache = Some(capabilities.clone());
    }
    capabilities
}

pub fn invalidate_sd_cli_capabilities_cache() {
    if let Ok(mut cache) = CAPABILITIES_CACHE.lock() {
        *cache = None;
    }
}

pub fn sd_cli_supports_flag(capabilities: &SdCliCapabilities, flag: &str) -> bool {
    capabilities.supported_flags.iter().any(|entry| entry == flag)
}

fn probe_sd_cli_capabilities(app: &AppHandle) -> SdCliCapabilities {
    let executable = match resolve_cli_executable(app) {
        Ok(path) => path,
        Err(_) => {
            return SdCliCapabilities {
                available: false,
                runtime_version: None,
                supported_flags: Vec::new(),
                img2img_supported: false,
                img2img_init_flag: None,
                img2img_mode_flag: None,
            };
        }
    };

    let help_text = match read_sd_cli_help(&executable) {
        Some(text) => text,
        None => {
            return SdCliCapabilities {
                available: true,
                runtime_version: None,
                supported_flags: Vec::new(),
                img2img_supported: false,
                img2img_init_flag: None,
                img2img_mode_flag: None,
            };
        }
    };

    let supported_flags = PROBED_FLAGS
        .iter()
        .filter_map(|(id, flag)| help_contains_flag(&help_text, flag).then(|| (*id).to_string()))
        .collect::<Vec<_>>();

    let init_flag = ["--init-img", "--img2img"]
        .into_iter()
        .find(|flag| help_contains_flag(&help_text, flag))
        .map(str::to_string);

    let mode_flag = if help_text.contains("img2img") && help_contains_flag(&help_text, "--mode") {
        Some("--mode".to_string())
    } else {
        None
    };

    let img2img_supported = init_flag.is_some();

    let capabilities = SdCliCapabilities {
        available: true,
        runtime_version: extract_runtime_version(&help_text),
        supported_flags,
        img2img_supported,
        img2img_init_flag: init_flag,
        img2img_mode_flag: mode_flag,
    };

    info!(
        target = "jmtools::local_inference",
        runtime_version = capabilities.runtime_version.as_deref().unwrap_or("unknown"),
        img2img_supported = capabilities.img2img_supported,
        flag_count = capabilities.supported_flags.len(),
        "sd-cli capabilities probed"
    );

    capabilities
}

fn read_sd_cli_help(executable: &Path) -> Option<String> {
    let output = Command::new(executable).arg("--help").output().ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    Some(format!("{stdout}{stderr}"))
}

fn help_contains_flag(help_text: &str, flag: &str) -> bool {
    help_text.contains(flag)
}

fn extract_runtime_version(help_text: &str) -> Option<String> {
    for line in help_text.lines().take(20) {
        let trimmed = line.trim();
        if trimmed.starts_with("sd-cli") || trimmed.starts_with("stable-diffusion.cpp") {
            return Some(trimmed.to_string());
        }
        if let Some(rest) = trimmed.strip_prefix("version:") {
            return Some(rest.trim().to_string());
        }
    }
    None
}
