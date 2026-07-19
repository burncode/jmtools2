use super::types::{RuntimeManifestEntry, RuntimeManifestFile};

use crate::character::generation::local::types::HardwareProfile;

pub fn load_runtime_manifest() -> Result<RuntimeManifestFile, String> {
    serde_json::from_str(include_str!(
        "../../../../../resources/local_diffusion_runtime_manifest.json"
    ))
    .map_err(|error| format!("解析 Runtime manifest 失败：{error}"))
}

pub fn current_platform_key() -> &'static str {
    #[cfg(all(windows, target_arch = "x86_64"))]
    {
        return "windows-x86_64";
    }

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        return "macos-aarch64";
    }

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        return "macos-x86_64";
    }

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        return "linux-x86_64";
    }

    #[cfg(not(any(
        all(windows, target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "x86_64"),
    )))]
    {
        return "unsupported";
    }
}

pub fn runtimes_for_platform() -> Result<Vec<RuntimeManifestEntry>, String> {
    let platform = current_platform_key();
    if platform == "unsupported" {
        return Ok(Vec::new());
    }

    Ok(load_runtime_manifest()?
        .runtimes
        .into_iter()
        .filter(|entry| entry.platform == platform)
        .collect())
}

pub fn find_manifest_entry(runtime_id: &str) -> Result<RuntimeManifestEntry, String> {
    let normalized = runtime_id.trim();
    load_runtime_manifest()?
        .runtimes
        .into_iter()
        .find(|entry| entry.id == normalized)
        .ok_or_else(|| format!("未找到 Runtime 条目：{normalized}"))
}

pub fn recommended_runtime_id_for_hardware(hardware: &HardwareProfile) -> Option<String> {
    let entries = runtimes_for_platform().ok()?;
    if hardware.has_nvidia_gpu {
        return entries
            .iter()
            .find(|entry| entry.variant == "cuda")
            .map(|entry| entry.id.clone());
    }

    entries
        .iter()
        .find(|entry| entry.variant == "vulkan")
        .or_else(|| entries.iter().find(|entry| entry.variant == "cpu"))
        .map(|entry| entry.id.clone())
}

pub fn default_runtime_id() -> Option<String> {
    recommended_runtime_id_for_hardware(&HardwareProfile {
        total_ram_mb: 0,
        gpu_name: None,
        vram_mb: None,
        backend: crate::character::generation::local::types::InferenceBackend::Unknown,
        has_nvidia_gpu: false,
        os: String::new(),
    })
}
