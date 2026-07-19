use std::sync::Mutex;
use std::time::Instant;

use super::activity::{set_local_inference_activity_full, LocalInferencePhase};
use super::download_control::{
    current_task_lora_id, current_task_profile_id, DOWNLOAD_PAUSED_MESSAGE,
};

static LAST_SAMPLE: Mutex<Option<(Instant, u64)>> = Mutex::new(None);

pub fn reset_download_speed_sample() {
    if let Ok(mut guard) = LAST_SAMPLE.lock() {
        *guard = None;
    }
}

pub fn resolve_effective_total(bytes_total: Option<u64>, estimated_bytes: Option<u64>) -> Option<u64> {
    bytes_total.or_else(|| estimated_bytes.filter(|value| *value > 0))
}

pub fn set_paused_download_activity(profile_id: &str, lora_id: Option<&str>) {
    let current = super::activity::get_local_inference_activity();
    set_local_inference_activity_full(
        LocalInferencePhase::Downloading,
        format!("{DOWNLOAD_PAUSED_MESSAGE}，点击恢复将从断点继续下载。"),
        current.progress_percent,
        current.bytes_downloaded,
        current.bytes_total,
        current.stage.or_else(|| Some("downloading".to_string())),
        None,
        lora_id
            .map(|value| value.to_string())
            .or_else(|| Some(profile_id.to_string())),
        Some("paused".to_string()),
    );
}

pub fn set_resuming_download_activity(profile_id: &str, lora_id: Option<&str>) {
    let current = super::activity::get_local_inference_activity();
    set_local_inference_activity_full(
        LocalInferencePhase::Downloading,
        "正在恢复下载…".to_string(),
        current.progress_percent,
        current.bytes_downloaded,
        current.bytes_total,
        current.stage.or_else(|| Some("downloading".to_string())),
        None,
        lora_id
            .map(|value| value.to_string())
            .or_else(|| Some(profile_id.to_string())),
        Some("running".to_string()),
    );
}

pub fn report_download_progress(
    label: &str,
    bytes_downloaded: u64,
    bytes_total: Option<u64>,
    estimated_bytes: Option<u64>,
    stage: &str,
) {
    let effective_total = resolve_effective_total(bytes_total, estimated_bytes);
    let progress_percent = effective_total.and_then(|total| {
        if total == 0 {
            None
        } else {
            Some(((bytes_downloaded.saturating_mul(100)) / total).min(100) as u8)
        }
    });

    let speed_bytes_per_sec = compute_speed(bytes_downloaded);
    let downloaded_mb = bytes_downloaded as f64 / 1024.0 / 1024.0;
    let message = if let Some(total) = effective_total {
        let total_mb = total as f64 / 1024.0 / 1024.0;
        format!("正在下载 {label}（{downloaded_mb:.1} / {total_mb:.1} MB）…")
    } else {
        format!("正在下载 {label}（{downloaded_mb:.1} MB）…")
    };

    set_local_inference_activity_full(
        LocalInferencePhase::Downloading,
        message,
        progress_percent,
        Some(bytes_downloaded),
        effective_total,
        Some(stage.to_string()),
        speed_bytes_per_sec,
        current_task_lora_id().or_else(current_task_profile_id),
        Some("running".to_string()),
    );
}

fn compute_speed(bytes_downloaded: u64) -> Option<u64> {
    let now = Instant::now();
    let mut guard = LAST_SAMPLE.lock().ok()?;

    if let Some((last_at, last_bytes)) = *guard {
        let elapsed = now.duration_since(last_at).as_secs_f64();
        if elapsed >= 0.15 {
            let delta = bytes_downloaded.saturating_sub(last_bytes);
            let speed = (delta as f64 / elapsed) as u64;
            *guard = Some((now, bytes_downloaded));
            return Some(speed);
        }
        return None;
    }

    *guard = Some((now, bytes_downloaded));
    None
}
