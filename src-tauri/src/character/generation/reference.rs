use std::path::{Path, PathBuf};

use crate::character::model::{
    CharacterAssetRecord, CharacterReferenceImageAsset, CharacterWorkshopDraftInput,
};
use crate::character::store::validate_project_root;

#[derive(Clone, Debug)]
pub struct ResolvedReferenceImage {
    pub bytes: Vec<u8>,
    pub strength: f64,
}

const DEFAULT_LAYOUT_REFERENCE_STRENGTH: f64 = 0.42;

pub fn resolve_candidate_reference(
    project_root: &Path,
    draft: &CharacterWorkshopDraftInput,
    layout_reference: Option<Vec<u8>>,
) -> Option<ResolvedReferenceImage> {
    if let Some(resolved) = resolve_primary_reference_from_draft(project_root, draft) {
        return Some(resolved);
    }

    layout_reference.map(|bytes| ResolvedReferenceImage {
        bytes,
        strength: DEFAULT_LAYOUT_REFERENCE_STRENGTH,
    })
}

pub fn resolve_primary_reference_from_draft(
    project_root: &Path,
    draft: &CharacterWorkshopDraftInput,
) -> Option<ResolvedReferenceImage> {
    let asset = select_primary_reference_asset(&draft.reference_images)?;
    let bytes = read_reference_asset(project_root, asset)?;
    let strength = normalize_reference_strength(draft.reference_strength);
    Some(ResolvedReferenceImage { bytes, strength })
}

pub fn resolve_primary_reference_from_record(
    project_root: &Path,
    record: &CharacterAssetRecord,
) -> Option<ResolvedReferenceImage> {
    let config = record.config.as_ref()?;
    let asset = select_primary_reference_asset(&config.references)?;
    let bytes = read_reference_asset(project_root, asset)?;
    let strength = config
        .reference_strength
        .map(normalize_reference_strength)
        .unwrap_or(DEFAULT_LAYOUT_REFERENCE_STRENGTH);
    Some(ResolvedReferenceImage { bytes, strength })
}

fn select_primary_reference_asset(
    references: &[CharacterReferenceImageAsset],
) -> Option<&CharacterReferenceImageAsset> {
    if references.is_empty() {
        return None;
    }

    references
        .iter()
        .find(|asset| asset.role.trim().eq_ignore_ascii_case("style"))
        .or_else(|| references.first())
}

fn read_reference_asset(
    project_root: &Path,
    asset: &CharacterReferenceImageAsset,
) -> Option<Vec<u8>> {
    let absolute_path = asset.absolute_path.trim();
    if !absolute_path.is_empty() {
        if let Ok(bytes) = read_reference_file(project_root, Path::new(absolute_path)) {
            return Some(bytes);
        }
    }

    let relative_path = asset.project_relative_path.trim();
    if relative_path.is_empty() {
        return None;
    }

    read_reference_file(project_root, &project_root.join(relative_path)).ok()
}

fn read_reference_file(project_root: &Path, candidate: &Path) -> Result<Vec<u8>, String> {
    let canonical_root = project_root
        .canonicalize()
        .map_err(|error| format!("解析项目目录失败：{error}"))?;
    let canonical_path = candidate
        .canonicalize()
        .map_err(|error| format!("读取参考图失败：{error}"))?;

    if !canonical_path.starts_with(&canonical_root) {
        return Err("参考图路径不在当前项目目录内。".to_string());
    }

    if !canonical_path.is_file() {
        return Err(format!(
            "参考图不存在：{}",
            canonical_path.to_string_lossy()
        ));
    }

    std::fs::read(&canonical_path).map_err(|error| format!("读取参考图失败：{error}"))
}

fn normalize_reference_strength(strength: f64) -> f64 {
    if strength <= 0.0 {
        DEFAULT_LAYOUT_REFERENCE_STRENGTH
    } else {
        strength.clamp(0.05, 1.0)
    }
}

pub fn resolve_project_root_path(project_root: &str) -> Result<PathBuf, String> {
    validate_project_root(project_root)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_reference_strength_clamps_and_defaults() {
        assert_eq!(normalize_reference_strength(0.0), DEFAULT_LAYOUT_REFERENCE_STRENGTH);
        assert_eq!(normalize_reference_strength(0.75), 0.75);
        assert_eq!(normalize_reference_strength(2.0), 1.0);
    }

    #[test]
    fn select_primary_reference_prefers_style_role() {
        let references = vec![
            CharacterReferenceImageAsset {
                absolute_path: "/tmp/a.png".to_string(),
                data_url: String::new(),
                file_name: "a.png".to_string(),
                id: "a".to_string(),
                project_relative_path: String::new(),
                role: "pose".to_string(),
            },
            CharacterReferenceImageAsset {
                absolute_path: "/tmp/b.png".to_string(),
                data_url: String::new(),
                file_name: "b.png".to_string(),
                id: "b".to_string(),
                project_relative_path: String::new(),
                role: "style".to_string(),
            },
        ];

        let selected = select_primary_reference_asset(&references).expect("style asset");
        assert_eq!(selected.id, "b");
    }
}
