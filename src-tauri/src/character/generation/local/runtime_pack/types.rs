use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeManifestFile {
    pub version: u32,
    pub runtimes: Vec<RuntimeManifestEntry>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeManifestEntry {
    pub id: String,
    pub label: String,
    pub platform: String,
    pub channel: String,
    pub package_version: String,
    pub download_url: String,
    #[serde(default)]
    pub sha256: String,
    pub executable: String,
    pub description: String,
    #[serde(default)]
    pub variant: String,
    #[serde(default)]
    pub estimated_size_mb: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledRuntimeRecord {
    pub runtime_id: String,
    pub package_version: String,
    pub executable_path: String,
    pub install_directory: String,
    pub installed_at: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDiffusionRuntimeStatus {
    pub id: String,
    pub label: String,
    pub platform: String,
    pub channel: String,
    pub package_version: String,
    pub download_url: String,
    pub executable: String,
    pub description: String,
    pub installed: bool,
    pub installed_version: Option<String>,
    pub executable_path: Option<String>,
    pub install_directory: Option<String>,
    pub update_available: bool,
    pub active: bool,
    pub recommended: bool,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInstallState {
    #[serde(default)]
    pub records: Vec<InstalledRuntimeRecord>,
    #[serde(default)]
    pub active_runtime_id: String,
}
