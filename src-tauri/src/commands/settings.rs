use crate::storage::database::{current_timestamp, ensure_app_settings_schema, open_app_database};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use tauri::AppHandle;

const SETTINGS_KEY: &str = "app.settings";

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_language")]
    language: String,
    #[serde(default = "default_theme")]
    theme: String,
    #[serde(default = "default_accent_color")]
    accent_color: String,
    #[serde(default = "default_true")]
    autosave_enabled: bool,
    #[serde(default = "default_autosave_interval")]
    autosave_interval_seconds: u32,
    #[serde(default = "default_export_format")]
    default_export_format: String,
    #[serde(default)]
    workspace_root: String,
    #[serde(default = "default_ai_service_mode")]
    ai_service_mode: String,
    #[serde(default)]
    launch_on_startup: bool,
    #[serde(default)]
    minimize_on_startup: bool,
    #[serde(default)]
    clipboard_quick_import: bool,
    #[serde(default = "default_close_window_behavior")]
    close_window_behavior: String,
    #[serde(default = "default_ui_density")]
    ui_density: String,
    #[serde(default = "default_font_size")]
    font_size: String,
    #[serde(default = "default_panel_border_strength")]
    panel_border_strength: String,
    #[serde(default = "default_sidebar_state")]
    sidebar_default_state: String,
    #[serde(default = "default_true")]
    fixed_topbar: bool,
    #[serde(default = "default_preview_quality")]
    preview_quality: String,
    #[serde(default = "default_preview_fps_limit")]
    preview_fps_limit: u32,
    #[serde(default = "default_pixel_scale_mode")]
    pixel_scale_mode: String,
    #[serde(default = "default_preview_background")]
    preview_background: String,
    #[serde(default)]
    show_preview_grid: bool,
    #[serde(default = "default_true")]
    preview_hardware_acceleration: bool,
    #[serde(default)]
    reduce_motion: bool,
    #[serde(default = "default_preset_dictionaries")]
    preset_dictionaries: PresetDictionaries,
    #[serde(default = "default_ai_provider")]
    ai_provider: String,
    #[serde(default = "default_ai_api_base")]
    ai_api_base: String,
    #[serde(default)]
    ai_api_key: String,
    #[serde(default = "default_ai_text_model")]
    ai_text_model: String,
    #[serde(default)]
    ai_text_provider_id: String,
    #[serde(default = "default_ai_image_model")]
    ai_image_model: String,
    #[serde(default = "default_ai_image_model")]
    ai_character_model: String,
    #[serde(default)]
    ai_character_provider_id: String,
    #[serde(default)]
    ai_character_edit_model: String,
    #[serde(default)]
    ai_character_edit_provider_id: String,
    #[serde(default = "default_ai_image_model")]
    ai_scene_model: String,
    #[serde(default)]
    ai_scene_provider_id: String,
    #[serde(default = "default_ai_image_model")]
    ai_vfx_model: String,
    #[serde(default)]
    ai_vfx_provider_id: String,
    #[serde(default = "default_ai_image_model")]
    ai_ui_model: String,
    #[serde(default)]
    ai_ui_provider_id: String,
    #[serde(default = "default_ai_text_model")]
    ai_animation_model: String,
    #[serde(default)]
    ai_animation_provider_id: String,
    #[serde(default = "default_ai_audio_model")]
    ai_audio_model: String,
    #[serde(default)]
    ai_audio_provider_id: String,
    #[serde(default = "default_background_removal_engine")]
    background_removal_engine: String,
    #[serde(default)]
    background_removal_executable_path: String,
    #[serde(default = "default_background_removal_model")]
    background_removal_model: String,
    #[serde(default)]
    background_removal_model_path: String,
    #[serde(default = "default_background_removal_tolerance")]
    background_removal_tolerance: u8,
    #[serde(default = "default_background_removal_edge_softness")]
    background_removal_edge_softness: u8,
    #[serde(default)]
    background_removal_alpha_matting: bool,
    #[serde(default = "default_background_removal_foreground_threshold")]
    background_removal_foreground_threshold: u8,
    #[serde(default = "default_background_removal_background_threshold")]
    background_removal_background_threshold: u8,
    #[serde(default = "default_background_removal_cleanup_strength")]
    background_removal_cleanup_strength: String,
    #[serde(default = "default_background_removal_hole_fill_max_pixels")]
    background_removal_hole_fill_max_pixels: u32,
    #[serde(default)]
    background_removal_preserve_small_parts: bool,
    #[serde(default = "default_background_removal_spill_suppression")]
    background_removal_spill_suppression: u8,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetDictionaries {
    #[serde(default = "default_character_style_presets")]
    character_styles: Vec<PresetDictionaryEntry>,
    #[serde(default = "default_character_feature_presets")]
    character_features: Vec<PresetDictionaryEntry>,
    #[serde(default = "default_character_trait_presets")]
    character_traits: Vec<CharacterTraitDictionaryEntry>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterTraitDictionaryEntry {
    #[serde(default)]
    category: String,
    #[serde(default)]
    colors: Vec<String>,
    #[serde(default)]
    description: String,
    #[serde(default = "default_true")]
    enabled: bool,
    #[serde(default)]
    entity_types: Vec<String>,
    #[serde(default)]
    id: String,
    #[serde(default)]
    label: String,
    #[serde(default)]
    prompt: String,
    #[serde(default)]
    value: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetDictionaryEntry {
    #[serde(default)]
    description: String,
    #[serde(default = "default_true")]
    enabled: bool,
    #[serde(default)]
    id: String,
    #[serde(default)]
    label: String,
    #[serde(default)]
    value: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            language: default_language(),
            theme: default_theme(),
            accent_color: default_accent_color(),
            autosave_enabled: default_true(),
            autosave_interval_seconds: default_autosave_interval(),
            default_export_format: default_export_format(),
            workspace_root: String::new(),
            ai_service_mode: default_ai_service_mode(),
            launch_on_startup: false,
            minimize_on_startup: false,
            clipboard_quick_import: false,
            close_window_behavior: default_close_window_behavior(),
            ui_density: default_ui_density(),
            font_size: default_font_size(),
            panel_border_strength: default_panel_border_strength(),
            sidebar_default_state: default_sidebar_state(),
            fixed_topbar: true,
            preview_quality: default_preview_quality(),
            preview_fps_limit: default_preview_fps_limit(),
            pixel_scale_mode: default_pixel_scale_mode(),
            preview_background: default_preview_background(),
            show_preview_grid: false,
            preview_hardware_acceleration: true,
            reduce_motion: false,
            preset_dictionaries: default_preset_dictionaries(),
            ai_provider: default_ai_provider(),
            ai_api_base: default_ai_api_base(),
            ai_api_key: String::new(),
            ai_text_model: default_ai_text_model(),
            ai_text_provider_id: String::new(),
            ai_image_model: default_ai_image_model(),
            ai_character_model: default_ai_image_model(),
            ai_character_edit_model: String::new(),
            ai_character_edit_provider_id: String::new(),
            ai_character_provider_id: String::new(),
            ai_scene_model: default_ai_image_model(),
            ai_scene_provider_id: String::new(),
            ai_vfx_model: default_ai_image_model(),
            ai_vfx_provider_id: String::new(),
            ai_ui_model: default_ai_image_model(),
            ai_ui_provider_id: String::new(),
            ai_animation_model: default_ai_text_model(),
            ai_animation_provider_id: String::new(),
            ai_audio_model: default_ai_audio_model(),
            ai_audio_provider_id: String::new(),
            background_removal_engine: default_background_removal_engine(),
            background_removal_executable_path: String::new(),
            background_removal_model: default_background_removal_model(),
            background_removal_model_path: String::new(),
            background_removal_tolerance: default_background_removal_tolerance(),
            background_removal_edge_softness: default_background_removal_edge_softness(),
            background_removal_alpha_matting: false,
            background_removal_foreground_threshold:
                default_background_removal_foreground_threshold(),
            background_removal_background_threshold:
                default_background_removal_background_threshold(),
            background_removal_cleanup_strength: default_background_removal_cleanup_strength(),
            background_removal_hole_fill_max_pixels:
                default_background_removal_hole_fill_max_pixels(),
            background_removal_preserve_small_parts: false,
            background_removal_spill_suppression: default_background_removal_spill_suppression(),
        }
    }
}

pub(crate) fn resolve_text_ai_defaults(settings: &AppSettings) -> (Option<String>, Option<String>) {
    let provider_id = settings.ai_text_provider_id.trim();
    let model = settings.ai_text_model.trim();

    (
        (!provider_id.is_empty()).then(|| provider_id.to_string()),
        (!model.is_empty()).then(|| model.to_string()),
    )
}

#[tauri::command]
pub fn get_app_settings(app: AppHandle) -> Result<AppSettings, String> {
    let connection = open_app_database(&app)?;
    ensure_app_settings_schema(&connection)?;

    let settings_json: Option<String> = connection
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![SETTINGS_KEY],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("读取应用设置失败：{error}"))?;

    match settings_json {
        Some(value) => {
            serde_json::from_str(&value).map_err(|error| format!("应用设置格式错误：{error}"))
        }
        None => Ok(AppSettings::default()),
    }
}

#[tauri::command]
pub fn save_app_settings(app: AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    let normalized_settings = normalize_settings(settings)?;
    let connection = open_app_database(&app)?;
    ensure_app_settings_schema(&connection)?;

    let settings_json = serde_json::to_string_pretty(&normalized_settings)
        .map_err(|error| format!("序列化应用设置失败：{error}"))?;

    connection
        .execute(
            "INSERT INTO app_settings (key, value, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![SETTINGS_KEY, settings_json, current_timestamp()],
        )
        .map_err(|error| format!("保存应用设置失败：{error}"))?;

    Ok(normalized_settings)
}

fn normalize_settings(mut settings: AppSettings) -> Result<AppSettings, String> {
    settings.workspace_root = settings.workspace_root.trim().to_string();

    if !matches!(settings.language.as_str(), "zh-CN" | "en-US") {
        return Err("语言设置不受支持。".to_string());
    }

    if !matches!(settings.theme.as_str(), "dark" | "light" | "system") {
        return Err("主题设置不受支持。".to_string());
    }

    if !matches!(
        settings.accent_color.as_str(),
        "blue" | "cyan" | "violet" | "amber" | "rose"
    ) {
        return Err("强调色设置不受支持。".to_string());
    }

    if !matches!(
        settings.close_window_behavior.as_str(),
        "ask" | "minimize" | "exit"
    ) {
        return Err("关闭窗口行为不受支持。".to_string());
    }

    if !matches!(
        settings.ui_density.as_str(),
        "comfortable" | "compact" | "spacious"
    ) {
        return Err("界面密度设置不受支持。".to_string());
    }

    if !matches!(settings.font_size.as_str(), "small" | "medium" | "large") {
        return Err("字体大小设置不受支持。".to_string());
    }

    if !matches!(
        settings.panel_border_strength.as_str(),
        "soft" | "standard" | "clear"
    ) {
        return Err("面板边框强度设置不受支持。".to_string());
    }

    if !matches!(
        settings.sidebar_default_state.as_str(),
        "expanded" | "collapsed" | "remember"
    ) {
        return Err("侧边栏默认状态不受支持。".to_string());
    }

    if !(30..=600).contains(&settings.autosave_interval_seconds) {
        return Err("自动保存间隔需要在 30 到 600 秒之间。".to_string());
    }

    if !matches!(
        settings.default_export_format.as_str(),
        "png" | "spritesheet-json"
    ) {
        return Err("默认导出格式不受支持。".to_string());
    }

    if !matches!(settings.ai_service_mode.as_str(), "local-first" | "custom") {
        return Err("生成服务模式不受支持。".to_string());
    }

    if !matches!(
        settings.preview_quality.as_str(),
        "balanced" | "performance" | "quality"
    ) {
        return Err("预览质量设置不受支持。".to_string());
    }

    if !matches!(settings.preview_fps_limit, 30 | 60 | 120) {
        return Err("预览帧率上限不受支持。".to_string());
    }

    if !matches!(settings.pixel_scale_mode.as_str(), "nearest" | "linear") {
        return Err("像素缩放模式不受支持。".to_string());
    }

    if !matches!(
        settings.preview_background.as_str(),
        "checkerboard" | "dark" | "light" | "transparent"
    ) {
        return Err("预览背景设置不受支持。".to_string());
    }

    if !matches!(
        settings.ai_provider.as_str(),
        "openai" | "deepseek" | "ollama" | "custom"
    ) {
        return Err("AI 服务提供商不受支持。".to_string());
    }

    settings.ai_api_base = settings.ai_api_base.trim().to_string();
    settings.ai_text_model = settings.ai_text_model.trim().to_string();
    settings.ai_text_provider_id = settings.ai_text_provider_id.trim().to_string();
    settings.ai_image_model = settings.ai_image_model.trim().to_string();
    settings.ai_character_model = settings.ai_character_model.trim().to_string();
    settings.ai_scene_model = settings.ai_scene_model.trim().to_string();
    settings.ai_vfx_model = settings.ai_vfx_model.trim().to_string();
    settings.ai_ui_model = settings.ai_ui_model.trim().to_string();
    settings.ai_animation_model = settings.ai_animation_model.trim().to_string();
    settings.ai_audio_model = settings.ai_audio_model.trim().to_string();
    settings.ai_character_provider_id = settings.ai_character_provider_id.trim().to_string();
    settings.ai_character_edit_model = settings.ai_character_edit_model.trim().to_string();
    settings.ai_character_edit_provider_id =
        settings.ai_character_edit_provider_id.trim().to_string();
    settings.ai_scene_provider_id = settings.ai_scene_provider_id.trim().to_string();
    settings.ai_vfx_provider_id = settings.ai_vfx_provider_id.trim().to_string();
    settings.ai_ui_provider_id = settings.ai_ui_provider_id.trim().to_string();
    settings.ai_animation_provider_id = settings.ai_animation_provider_id.trim().to_string();
    settings.ai_audio_provider_id = settings.ai_audio_provider_id.trim().to_string();
    settings.background_removal_model_path =
        settings.background_removal_model_path.trim().to_string();
    settings.background_removal_executable_path = settings
        .background_removal_executable_path
        .trim()
        .to_string();

    if !matches!(
        settings.background_removal_engine.as_str(),
        "chroma" | "rembg"
    ) {
        return Err("去背景算法设置不受支持。".to_string());
    }

    if !matches!(
        settings.background_removal_model.as_str(),
        "isnet-general-use" | "birefnet-general-lite" | "birefnet-general" | "silueta" | "custom"
    ) {
        return Err("去背景模型设置不受支持。".to_string());
    }

    settings.background_removal_tolerance = settings.background_removal_tolerance.clamp(4, 96);
    settings.background_removal_edge_softness =
        settings.background_removal_edge_softness.clamp(0, 96);
    if !matches!(
        settings.background_removal_cleanup_strength.as_str(),
        "off" | "soft" | "standard" | "strict"
    ) {
        return Err("去背景碎点清理强度不受支持。".to_string());
    }
    settings.background_removal_hole_fill_max_pixels = settings
        .background_removal_hole_fill_max_pixels
        .clamp(0, 4096);
    settings.background_removal_spill_suppression =
        settings.background_removal_spill_suppression.clamp(0, 100);
    settings.preset_dictionaries = normalize_preset_dictionaries(settings.preset_dictionaries);

    Ok(settings)
}

fn normalize_preset_dictionaries(dictionaries: PresetDictionaries) -> PresetDictionaries {
    PresetDictionaries {
        character_styles: normalize_preset_entries(
            dictionaries.character_styles,
            default_character_style_presets(),
            32,
            16,
            80,
        ),
        character_features: normalize_preset_entries(
            dictionaries.character_features,
            default_character_feature_presets(),
            64,
            16,
            32,
        ),
        character_traits: normalize_character_trait_entries(dictionaries.character_traits),
    }
}

fn normalize_character_trait_entries(
    entries: Vec<CharacterTraitDictionaryEntry>,
) -> Vec<CharacterTraitDictionaryEntry> {
    let source_entries = if entries.is_empty() {
        default_character_trait_presets()
    } else {
        entries
    };
    let mut normalized_entries: Vec<CharacterTraitDictionaryEntry> = Vec::new();

    for mut entry in source_entries {
        entry.label = entry.label.trim().chars().take(32).collect();
        entry.value = entry
            .value
            .trim()
            .chars()
            .take(32)
            .collect();
        if entry.value.is_empty() {
            entry.value = entry.label.clone();
        }
        entry.description = entry.description.trim().chars().take(160).collect();
        entry.id = entry.id.trim().chars().take(80).collect();
        entry.category = entry.category.trim().chars().take(16).collect();
        entry.prompt = entry.prompt.trim().chars().take(160).collect();
        entry.entity_types = entry
            .entity_types
            .into_iter()
            .map(|value| value.trim().chars().take(16).collect())
            .filter(|value: &String| !value.is_empty())
            .take(8)
            .collect();
        entry.colors = entry
            .colors
            .into_iter()
            .map(|value| value.trim().chars().take(16).collect())
            .filter(|value: &String| !value.is_empty())
            .take(8)
            .collect();

        if entry.id.is_empty() || entry.label.is_empty() || entry.prompt.is_empty() {
            continue;
        }

        if normalized_entries.iter().any(|existing| existing.id == entry.id) {
            continue;
        }

        normalized_entries.push(entry);
        if normalized_entries.len() >= 96 {
            break;
        }
    }

    if normalized_entries.is_empty() {
        return default_character_trait_presets();
    }

    normalized_entries
}

fn normalize_preset_entries(
    entries: Vec<PresetDictionaryEntry>,
    fallback_entries: Vec<PresetDictionaryEntry>,
    max_entries: usize,
    max_label_len: usize,
    max_value_len: usize,
) -> Vec<PresetDictionaryEntry> {
    let source_entries = if entries.is_empty() {
        fallback_entries.clone()
    } else {
        entries
    };
    let mut normalized_entries = Vec::new();

    for mut entry in source_entries {
        entry.label = entry.label.trim().chars().take(max_label_len).collect();
        entry.value = entry.value.trim().chars().take(max_value_len).collect();
        entry.description = entry.description.trim().chars().take(160).collect();
        entry.id = entry.id.trim().chars().take(80).collect();

        if entry.label.is_empty() || entry.value.is_empty() {
            continue;
        }

        if entry.id.is_empty() {
            entry.id = format!("preset-{}", stable_preset_suffix(&entry.value));
        }

        if normalized_entries
            .iter()
            .any(|item: &PresetDictionaryEntry| {
                item.id == entry.id || item.value == entry.value || item.label == entry.label
            })
        {
            continue;
        }

        normalized_entries.push(entry);

        if normalized_entries.len() >= max_entries {
            break;
        }
    }

    if normalized_entries.is_empty() {
        fallback_entries
    } else {
        normalized_entries
    }
}

fn stable_preset_suffix(value: &str) -> String {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);

    format!("{:x}", hasher.finish())
}

fn default_true() -> bool {
    true
}

fn default_language() -> String {
    "zh-CN".to_string()
}

fn default_theme() -> String {
    "dark".to_string()
}

fn default_accent_color() -> String {
    "blue".to_string()
}

fn default_autosave_interval() -> u32 {
    60
}

fn default_export_format() -> String {
    "png".to_string()
}

fn default_ai_service_mode() -> String {
    "local-first".to_string()
}

fn default_close_window_behavior() -> String {
    "ask".to_string()
}

fn default_ui_density() -> String {
    "comfortable".to_string()
}

fn default_font_size() -> String {
    "medium".to_string()
}

fn default_panel_border_strength() -> String {
    "soft".to_string()
}

fn default_sidebar_state() -> String {
    "expanded".to_string()
}

fn default_preview_quality() -> String {
    "balanced".to_string()
}

fn default_preview_fps_limit() -> u32 {
    60
}

fn default_pixel_scale_mode() -> String {
    "nearest".to_string()
}

fn default_preview_background() -> String {
    "checkerboard".to_string()
}

fn default_ai_provider() -> String {
    "ollama".to_string()
}

fn default_ai_api_base() -> String {
    "http://127.0.0.1:11434".to_string()
}

fn default_ai_text_model() -> String {
    String::new()
}

fn default_ai_image_model() -> String {
    String::new()
}

fn default_ai_audio_model() -> String {
    String::new()
}

fn default_background_removal_engine() -> String {
    "chroma".to_string()
}

fn default_background_removal_model() -> String {
    "isnet-general-use".to_string()
}

fn default_background_removal_tolerance() -> u8 {
    34
}

fn default_background_removal_edge_softness() -> u8 {
    24
}

fn default_background_removal_foreground_threshold() -> u8 {
    240
}

fn default_background_removal_background_threshold() -> u8 {
    10
}

fn default_background_removal_cleanup_strength() -> String {
    "standard".to_string()
}

fn default_background_removal_hole_fill_max_pixels() -> u32 {
    128
}

fn default_background_removal_spill_suppression() -> u8 {
    45
}

fn default_preset_dictionaries() -> PresetDictionaries {
    PresetDictionaries {
        character_features: default_character_feature_presets(),
        character_styles: default_character_style_presets(),
        character_traits: default_character_trait_presets(),
    }
}

fn default_character_style_presets() -> Vec<PresetDictionaryEntry> {
    vec![
        preset_entry(
            "character-style-16bit-rpg",
            "16bit RPG",
            "16bit RPG 像素风格",
        ),
        preset_entry("character-style-8bit-nes", "8bit NES", "8bit NES 像素风格"),
        preset_entry("character-style-chinese-pixel", "像素国风", "像素国风"),
        preset_entry("character-style-fantasy-pixel", "像素魔幻", "像素魔幻"),
    ]
}

fn default_character_feature_presets() -> Vec<PresetDictionaryEntry> {
    vec![
        preset_entry("character-feature-armor", "盔甲", "盔甲"),
        preset_entry("character-feature-cape", "披风", "披风"),
        preset_entry("character-feature-shield", "盾牌", "盾牌"),
        preset_entry("character-feature-sword", "长剑", "长剑"),
        preset_entry("character-feature-helmet", "头盔", "头盔"),
        preset_entry("character-feature-horn", "角", "角"),
        preset_entry("character-feature-wing", "翅膀", "翅膀"),
        preset_entry("character-feature-staff", "法杖", "法杖"),
    ]
}

fn default_character_trait_presets() -> Vec<CharacterTraitDictionaryEntry> {
    vec![
        character_trait_entry(
            "trait-hair-topknot",
            "发髻",
            "costume",
            "topknot hair, gray strands, calm monk silhouette",
            vec!["humanoid"],
        ),
        character_trait_entry(
            "trait-hair-long",
            "长发",
            "body",
            "long flowing hair, readable side silhouette",
            vec!["humanoid", "spirit"],
        ),
        character_trait_entry(
            "trait-robe-taoist",
            "道袍",
            "costume",
            "Taoist robe, wide sleeves, blue-white palette",
            vec!["humanoid"],
        ),
        character_trait_entry(
            "trait-armor-light",
            "轻甲",
            "costume",
            "silver light armor with layered plates",
            vec!["humanoid"],
        ),
        character_trait_entry(
            "trait-armor-heavy",
            "重甲",
            "costume",
            "heavy armor plates, strong shoulder silhouette",
            vec!["humanoid", "boss", "construct"],
        ),
        character_trait_entry(
            "trait-weapon-sword",
            "长剑",
            "weapon",
            "long sword with bright silver blade",
            vec!["humanoid"],
        ),
        character_trait_entry(
            "trait-weapon-whisk",
            "拂尘",
            "weapon",
            "horsetail whisk, flowing handle",
            vec!["humanoid", "spirit"],
        ),
        character_trait_entry(
            "trait-weapon-staff",
            "法杖",
            "weapon",
            "magic staff with glowing gem",
            vec!["humanoid", "spirit"],
        ),
        character_trait_entry(
            "trait-body-slime",
            "凝胶体",
            "body",
            "translucent slime body, bouncy silhouette",
            vec!["creature"],
        ),
        character_trait_entry(
            "trait-body-rock",
            "岩甲",
            "body",
            "rocky carapace, cracked magma veins",
            vec!["boss", "creature"],
        ),
        character_trait_entry(
            "trait-effect-glow",
            "光晕",
            "effect",
            "soft glowing aura, floating particles",
            vec!["spirit"],
        ),
    ]
}

fn character_trait_entry(
    id: &str,
    label: &str,
    category: &str,
    prompt: &str,
    entity_types: Vec<&str>,
) -> CharacterTraitDictionaryEntry {
    CharacterTraitDictionaryEntry {
        category: category.to_string(),
        colors: Vec::new(),
        description: String::new(),
        enabled: true,
        entity_types: entity_types.into_iter().map(str::to_string).collect(),
        id: id.to_string(),
        label: label.to_string(),
        prompt: prompt.to_string(),
        value: label.to_string(),
    }
}

fn preset_entry(id: &str, label: &str, value: &str) -> PresetDictionaryEntry {
    PresetDictionaryEntry {
        description: String::new(),
        enabled: true,
        id: id.to_string(),
        label: label.to_string(),
        value: value.to_string(),
    }
}
