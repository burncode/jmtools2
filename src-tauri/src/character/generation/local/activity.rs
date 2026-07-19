use std::sync::{Mutex, OnceLock};

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LocalInferencePhase {
    Idle,
    Downloading,
    Generating,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalInferenceActivity {
    pub phase: LocalInferencePhase,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress_percent: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes_downloaded: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes_total: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed_bytes_per_sec: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub control_state: Option<String>,
}

impl Default for LocalInferenceActivity {
    fn default() -> Self {
        Self {
            phase: LocalInferencePhase::Idle,
            message: String::new(),
            progress_percent: None,
            bytes_downloaded: None,
            bytes_total: None,
            stage: None,
            speed_bytes_per_sec: None,
            profile_id: None,
            control_state: None,
        }
    }
}

fn activity_mutex() -> &'static Mutex<LocalInferenceActivity> {
    static ACTIVITY: OnceLock<Mutex<LocalInferenceActivity>> = OnceLock::new();
    ACTIVITY.get_or_init(|| Mutex::new(LocalInferenceActivity::default()))
}

pub fn set_local_inference_activity(phase: LocalInferencePhase, message: impl Into<String>) {
    set_local_inference_activity_detailed(
        phase,
        message,
        None,
        None,
        None,
        None,
        None,
    );
}

pub fn set_local_inference_activity_detailed(
    phase: LocalInferencePhase,
    message: impl Into<String>,
    progress_percent: Option<u8>,
    bytes_downloaded: Option<u64>,
    bytes_total: Option<u64>,
    stage: Option<String>,
    speed_bytes_per_sec: Option<u64>,
) {
    set_local_inference_activity_full(
        phase,
        message,
        progress_percent,
        bytes_downloaded,
        bytes_total,
        stage,
        speed_bytes_per_sec,
        None,
        None,
    );
}

pub fn set_local_inference_activity_full(
    phase: LocalInferencePhase,
    message: impl Into<String>,
    progress_percent: Option<u8>,
    bytes_downloaded: Option<u64>,
    bytes_total: Option<u64>,
    stage: Option<String>,
    speed_bytes_per_sec: Option<u64>,
    profile_id: Option<String>,
    control_state: Option<String>,
) {
    if let Ok(mut activity) = activity_mutex().lock() {
        *activity = LocalInferenceActivity {
            phase,
            message: message.into(),
            progress_percent,
            bytes_downloaded,
            bytes_total,
            stage,
            speed_bytes_per_sec,
            profile_id,
            control_state,
        };
    }
}

pub fn clear_local_inference_activity() {
    if let Ok(mut activity) = activity_mutex().lock() {
        *activity = LocalInferenceActivity::default();
    }
}

pub fn get_local_inference_activity() -> LocalInferenceActivity {
    activity_mutex()
        .lock()
        .map(|activity| activity.clone())
        .unwrap_or_default()
}
