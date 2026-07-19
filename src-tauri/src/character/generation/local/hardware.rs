use std::process::Command;

use sysinfo::System;

use super::types::{HardwareProfile, InferenceBackend};

pub fn probe_hardware_profile() -> HardwareProfile {
    let mut system = System::new();
    system.refresh_memory();

    let total_ram_mb = system.total_memory() / 1024 / 1024;
    let os = std::env::consts::OS.to_string();

    let (gpu_name, vram_mb, has_nvidia_gpu) = probe_gpu_info();
    let backend = infer_inference_backend(has_nvidia_gpu);

    HardwareProfile {
        total_ram_mb,
        gpu_name,
        vram_mb,
        backend,
        has_nvidia_gpu,
        os,
    }
}

fn probe_gpu_info() -> (Option<String>, Option<u64>, bool) {
    if let Some(info) = probe_nvidia_smi() {
        return info;
    }

    #[cfg(windows)]
    {
        if let Some(info) = probe_wmic_gpu() {
            return info;
        }
    }

    (None, None, false)
}

fn probe_nvidia_smi() -> Option<(Option<String>, Option<u64>, bool)> {
    let output = Command::new("nvidia-smi")
        .args([
            "--query-gpu=name,memory.total",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let first_line = stdout.lines().next()?.trim();
    let mut parts = first_line.split(',').map(str::trim);
    let name = parts.next()?.to_string();
    let vram = parts
        .next()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value > 0);

    Some((Some(name), vram, true))
}

#[cfg(windows)]
fn probe_wmic_gpu() -> Option<(Option<String>, Option<u64>, bool)> {
    let output = Command::new("wmic")
        .args(["path", "win32_VideoController", "get", "Name,AdapterRAM", "/format:csv"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines().skip(1) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let mut parts = trimmed.split(',');
        let _node = parts.next();
        let adapter_ram = parts.next().and_then(|value| value.trim().parse::<u64>().ok());
        let name = parts.next().map(str::trim).filter(|value| !value.is_empty());

        if let Some(name) = name {
            let vram_mb = adapter_ram.map(|bytes| {
                let mb = bytes / 1024 / 1024;
                // WMIC AdapterRAM 在部分驱动上报告共享内存总量，对 Vulkan 显存预算偏乐观。
                if mb > 16 * 1024 {
                    mb / 2
                } else {
                    mb
                }
            });
            let has_nvidia = name.to_ascii_lowercase().contains("nvidia");
            return Some((Some(name.to_string()), vram_mb, has_nvidia));
        }
    }

    None
}

#[cfg(not(windows))]
fn probe_wmic_gpu() -> Option<(Option<String>, Option<u64>, bool)> {
    None
}

fn infer_inference_backend(has_nvidia_gpu: bool) -> InferenceBackend {
    if has_nvidia_gpu {
        InferenceBackend::Cuda
    } else if cfg!(feature = "local-diffusion-vulkan") {
        InferenceBackend::Vulkan
    } else {
        InferenceBackend::Cpu
    }
}
