use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use super::activity::{clear_local_inference_activity, get_local_inference_activity, LocalInferenceActivity};

pub const DOWNLOAD_PAUSED_MESSAGE: &str = "下载已暂停";
pub const DOWNLOAD_CANCELLED_MESSAGE: &str = "下载已取消";

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadTaskState {
    Running,
    Paused,
    Cancelled,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadTaskKind {
    #[serde(alias = "model")]
    Model,
    #[serde(alias = "lora")]
    Lora,
}

impl Default for DownloadTaskKind {
    fn default() -> Self {
        Self::Model
    }
}

#[derive(Debug)]
pub enum DownloadInterrupt {
    Paused,
    Cancelled,
}

impl DownloadInterrupt {
    pub fn user_message(self) -> &'static str {
        match self {
            Self::Paused => DOWNLOAD_PAUSED_MESSAGE,
            Self::Cancelled => DOWNLOAD_CANCELLED_MESSAGE,
        }
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDownloadTask {
    #[serde(default)]
    pub task_kind: DownloadTaskKind,
    #[serde(default)]
    pub profile_id: String,
    #[serde(default)]
    pub lora_id: String,
    pub state: DownloadTaskState,
    pub activity: LocalInferenceActivity,
    pub can_resume: bool,
}

struct DownloadControlInner {
    kind: DownloadTaskKind,
    resource_id: String,
    pause_flag: Arc<AtomicBool>,
    cancel_flag: Arc<AtomicBool>,
    state: DownloadTaskState,
}

struct DownloadControlStore {
    task: Option<DownloadControlInner>,
}

fn store_mutex() -> &'static Mutex<DownloadControlStore> {
    static STORE: OnceLock<Mutex<DownloadControlStore>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(DownloadControlStore { task: None }))
}

fn begin_download(kind: DownloadTaskKind, resource_id: &str) -> Result<(), String> {
    let normalized = resource_id.trim();
    if normalized.is_empty() {
        return Err("下载任务 ID 不能为空。".to_string());
    }

    let mut store = store_mutex()
        .lock()
        .map_err(|_| "下载任务状态锁异常。".to_string())?;

    if let Some(task) = store.task.as_ref() {
        if task.state == DownloadTaskState::Running {
            return Err("已有进行中的下载任务。".to_string());
        }
    }

    store.task = Some(DownloadControlInner {
        kind,
        resource_id: normalized.to_string(),
        pause_flag: Arc::new(AtomicBool::new(false)),
        cancel_flag: Arc::new(AtomicBool::new(false)),
        state: DownloadTaskState::Running,
    });

    Ok(())
}

pub fn begin_model_download(profile_id: &str) -> Result<(), String> {
    begin_download(DownloadTaskKind::Model, profile_id)
}

pub fn begin_lora_download(lora_id: &str) -> Result<(), String> {
    begin_download(DownloadTaskKind::Lora, lora_id)
}

fn resume_download(kind: DownloadTaskKind, resource_id: &str) -> Result<(), String> {
    let normalized = resource_id.trim();
    let mut store = store_mutex()
        .lock()
        .map_err(|_| "下载任务状态锁异常。".to_string())?;

    let Some(task) = store.task.as_mut() else {
        return Err("当前没有可恢复的下载任务。".to_string());
    };

    if task.kind != kind || task.resource_id != normalized {
        return Err("恢复下载的任务与当前任务不一致。".to_string());
    }

    if task.state != DownloadTaskState::Paused {
        return Err("当前下载任务未处于暂停状态。".to_string());
    }

    task.pause_flag.store(false, Ordering::SeqCst);
    task.cancel_flag.store(false, Ordering::SeqCst);
    task.state = DownloadTaskState::Running;
    drop(store);

    match kind {
        DownloadTaskKind::Model => {
            super::download_progress::set_resuming_download_activity(normalized, None);
        }
        DownloadTaskKind::Lora => {
            super::download_progress::set_resuming_download_activity(normalized, Some(normalized));
        }
    }
    Ok(())
}

pub fn resume_model_download(profile_id: &str) -> Result<(), String> {
    resume_download(DownloadTaskKind::Model, profile_id)
}

pub fn resume_lora_download(lora_id: &str) -> Result<(), String> {
    resume_download(DownloadTaskKind::Lora, lora_id)
}

pub fn request_cancel() -> Result<(), String> {
    let mut store = store_mutex()
        .lock()
        .map_err(|_| "下载任务状态锁异常。".to_string())?;
    let Some(task) = store.task.as_ref() else {
        return Err("当前没有进行中的下载任务。".to_string());
    };

    match task.state {
        DownloadTaskState::Running => {
            task.cancel_flag.store(true, Ordering::SeqCst);
            Ok(())
        }
        DownloadTaskState::Paused | DownloadTaskState::Cancelled => {
            store.task = None;
            drop(store);
            clear_local_inference_activity();
            Ok(())
        }
    }
}

pub fn request_pause() -> Result<(), String> {
    let store = store_mutex()
        .lock()
        .map_err(|_| "下载任务状态锁异常。".to_string())?;
    let Some(task) = store.task.as_ref() else {
        return Err("当前没有进行中的下载任务。".to_string());
    };
    if task.state != DownloadTaskState::Running {
        return Err("当前下载任务未在运行中。".to_string());
    }
    task.pause_flag.store(true, Ordering::SeqCst);
    Ok(())
}

pub fn check_interrupt() -> Result<(), DownloadInterrupt> {
    let store = store_mutex()
        .lock()
        .map_err(|_| DownloadInterrupt::Cancelled)?;
    let Some(task) = store.task.as_ref() else {
        return Ok(());
    };

    if task.cancel_flag.load(Ordering::SeqCst) {
        return Err(DownloadInterrupt::Cancelled);
    }

    if task.pause_flag.load(Ordering::SeqCst) {
        return Err(DownloadInterrupt::Paused);
    }

    Ok(())
}

pub fn mark_paused() {
    if let Ok(mut store) = store_mutex().lock() {
        if let Some(task) = store.task.as_mut() {
            task.state = DownloadTaskState::Paused;
            task.pause_flag.store(false, Ordering::SeqCst);
        }
    }
}

pub fn mark_cancelled() {
    if let Ok(mut store) = store_mutex().lock() {
        if let Some(task) = store.task.as_mut() {
            task.state = DownloadTaskState::Cancelled;
            task.pause_flag.store(false, Ordering::SeqCst);
            task.cancel_flag.store(false, Ordering::SeqCst);
        }
    }
}

pub fn clear_task() {
    if let Ok(mut store) = store_mutex().lock() {
        store.task = None;
    }
}

pub fn finish_running_task() {
    if let Ok(mut store) = store_mutex().lock() {
        if let Some(task) = store.task.as_ref() {
            if task.state == DownloadTaskState::Running {
                store.task = None;
            }
        }
    }
}

pub fn get_download_task() -> Option<LocalDownloadTask> {
    let store = store_mutex().lock().ok()?;
    let task = store.task.as_ref()?;
    let activity = get_local_inference_activity();

    let (profile_id, lora_id) = match task.kind {
        DownloadTaskKind::Model => (task.resource_id.clone(), String::new()),
        DownloadTaskKind::Lora => (String::new(), task.resource_id.clone()),
    };

    Some(LocalDownloadTask {
        task_kind: task.kind,
        profile_id,
        lora_id,
        state: task.state,
        can_resume: task.state == DownloadTaskState::Paused,
        activity,
    })
}

pub fn current_task_kind() -> Option<DownloadTaskKind> {
    let store = store_mutex().lock().ok()?;
    store.task.as_ref().map(|task| task.kind)
}

pub fn current_task_profile_id() -> Option<String> {
    let store = store_mutex().lock().ok()?;
    store.task.as_ref().and_then(|task| {
        if task.kind == DownloadTaskKind::Model {
            Some(task.resource_id.clone())
        } else {
            None
        }
    })
}

pub fn current_task_lora_id() -> Option<String> {
    let store = store_mutex().lock().ok()?;
    store.task.as_ref().and_then(|task| {
        if task.kind == DownloadTaskKind::Lora {
            Some(task.resource_id.clone())
        } else {
            None
        }
    })
}

pub fn current_task_resource_id() -> Option<String> {
    let store = store_mutex().lock().ok()?;
    store.task.as_ref().map(|task| task.resource_id.clone())
}

pub fn current_task_state() -> Option<DownloadTaskState> {
    let store = store_mutex().lock().ok()?;
    store.task.as_ref().map(|task| task.state)
}

pub fn interrupt_to_error(interrupt: DownloadInterrupt) -> String {
    interrupt.user_message().to_string()
}

pub fn apply_download_interrupt(interrupt: DownloadInterrupt, _partial_path: Option<&Path>) -> String {
    match interrupt {
        DownloadInterrupt::Paused => {
            mark_paused();
            if let Some((kind, resource_id)) = current_task_kind().zip(current_task_resource_id()) {
                match kind {
                    DownloadTaskKind::Model => {
                        super::download_progress::set_paused_download_activity(
                            resource_id.as_str(),
                            None,
                        );
                    }
                    DownloadTaskKind::Lora => {
                        super::download_progress::set_paused_download_activity(
                            resource_id.as_str(),
                            Some(resource_id.as_str()),
                        );
                    }
                }
            }
        }
        DownloadInterrupt::Cancelled => {
            mark_cancelled();
            clear_task();
        }
    }
    interrupt_to_error(interrupt)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pause_and_resume_model_task_state() {
        clear_task();
        begin_model_download("klein-4b-q4").expect("begin");
        request_pause().expect("pause");
        assert!(matches!(
            check_interrupt(),
            Err(DownloadInterrupt::Paused)
        ));
        mark_paused();
        assert_eq!(
            get_download_task().map(|task| task.state),
            Some(DownloadTaskState::Paused)
        );
        resume_model_download("klein-4b-q4").expect("resume");
        assert_eq!(
            get_download_task().map(|task| task.state),
            Some(DownloadTaskState::Running)
        );
        clear_task();
    }

    #[test]
    fn pause_and_resume_lora_task_state() {
        clear_task();
        begin_lora_download("pixel-art-sprite-klein").expect("begin");
        request_pause().expect("pause");
        mark_paused();
        let task = get_download_task().expect("task");
        assert_eq!(task.task_kind, DownloadTaskKind::Lora);
        resume_lora_download("pixel-art-sprite-klein").expect("resume");
        clear_task();
    }
}
