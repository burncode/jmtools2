use serde::Serialize;

#[derive(Serialize)]
pub struct AppHealth {
    app: &'static str,
    status: &'static str,
}

#[tauri::command]
pub fn app_health() -> AppHealth {
    AppHealth {
        app: "JMTools",
        status: "ok",
    }
}
