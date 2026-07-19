use rusqlite::{params, Connection, OptionalExtension};

use super::hardware::probe_hardware_profile;
use super::recommender::recommend_profile;
use super::types::HardwareProfile;

const HARDWARE_CACHE_KEY: &str = "local.inference.hardware_cache";

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedHardwareProbe {
    pub hardware: HardwareProfile,
    pub recommended_profile_id: String,
    pub probed_at: i64,
}

pub struct ResolvedHardwareProfile {
    pub hardware: HardwareProfile,
    pub recommended_profile_id: String,
    pub from_cache: bool,
    pub probed_at: i64,
}

pub fn load_hardware_cache(connection: &Connection) -> Result<Option<CachedHardwareProbe>, String> {
    let stored: Option<String> = connection
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![HARDWARE_CACHE_KEY],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("读取硬件探测缓存失败：{error}"))?;

    if let Some(json) = stored {
        return serde_json::from_str(&json)
            .map_err(|error| format!("硬件探测缓存格式错误：{error}"))
            .map(Some);
    }

    Ok(None)
}

pub fn save_hardware_cache(
    connection: &Connection,
    cache: &CachedHardwareProbe,
) -> Result<(), String> {
    let json = serde_json::to_string(cache)
        .map_err(|error| format!("序列化硬件探测缓存失败：{error}"))?;
    let timestamp = crate::storage::database::current_timestamp();

    connection
        .execute(
            "INSERT INTO app_settings (key, value, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![HARDWARE_CACHE_KEY, json, timestamp],
        )
        .map_err(|error| format!("保存硬件探测缓存失败：{error}"))?;

    Ok(())
}

pub fn resolve_hardware_profile(
    connection: &Connection,
    force: bool,
) -> Result<ResolvedHardwareProfile, String> {
    if !force {
        if let Some(cache) = load_hardware_cache(connection)? {
            return Ok(ResolvedHardwareProfile {
                hardware: cache.hardware,
                recommended_profile_id: cache.recommended_profile_id,
                from_cache: true,
                probed_at: cache.probed_at,
            });
        }
    }

    let hardware = probe_hardware_profile();
    let recommended = recommend_profile(&hardware, None)?;
    let probed_at = crate::storage::database::current_timestamp() as i64;

    let cache = CachedHardwareProbe {
        hardware: hardware.clone(),
        recommended_profile_id: recommended.id.clone(),
        probed_at,
    };
    save_hardware_cache(connection, &cache)?;

    Ok(ResolvedHardwareProfile {
        hardware,
        recommended_profile_id: recommended.id,
        from_cache: false,
        probed_at,
    })
}
