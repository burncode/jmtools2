use std::sync::{Arc, Mutex, OnceLock};

static ACTIVE_RUNS: OnceLock<Mutex<std::collections::BTreeMap<String, Arc<std::sync::atomic::AtomicBool>>>> =
    OnceLock::new();

fn active_runs() -> &'static Mutex<std::collections::BTreeMap<String, Arc<std::sync::atomic::AtomicBool>>> {
    ACTIVE_RUNS.get_or_init(|| Mutex::new(std::collections::BTreeMap::new()))
}

pub fn register_run_cancel_flag(run_id: &str) -> Arc<std::sync::atomic::AtomicBool> {
    let flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
    if let Ok(mut runs) = active_runs().lock() {
        runs.insert(run_id.to_string(), flag.clone());
    }
    flag
}

pub fn cancel_active_run(run_id: &str) -> bool {
    if let Ok(runs) = active_runs().lock() {
        if let Some(flag) = runs.get(run_id) {
            flag.store(true, std::sync::atomic::Ordering::SeqCst);
            return true;
        }
    }
    false
}

pub fn clear_run_cancel_flag(run_id: &str) {
    if let Ok(mut runs) = active_runs().lock() {
        runs.remove(run_id);
    }
}

pub fn is_run_canceled(flag: &Arc<std::sync::atomic::AtomicBool>) -> bool {
    flag.load(std::sync::atomic::Ordering::SeqCst)
}
