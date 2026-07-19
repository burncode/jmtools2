use std::path::{Path, PathBuf};

pub const DOWNLOADS_TEMP_SEGMENT: &str = ".tmp/downloads";

pub fn models_downloads_temp_root(models_root: &Path) -> PathBuf {
    models_root.join(DOWNLOADS_TEMP_SEGMENT)
}

pub fn models_download_temp_dir(models_root: &Path, profile_id: &str) -> PathBuf {
    models_downloads_temp_root(models_root).join(profile_id.trim())
}

pub fn models_download_part_path(models_root: &Path, profile_id: &str, file_name: &str) -> PathBuf {
    models_download_temp_dir(models_root, profile_id).join(format!("{file_name}.part"))
}

pub fn lora_download_part_path(models_root: &Path, lora_id: &str) -> PathBuf {
    models_downloads_temp_root(models_root)
        .join("loras")
        .join(format!("{lora_id}.part"))
}

pub fn lora_bundle_dir(models_root: &Path, lora_id: &str) -> PathBuf {
    models_root.join("loras").join(lora_id.trim())
}

pub fn is_under_download_temp(path: &Path, models_root: &Path) -> bool {
    let temp_root = models_downloads_temp_root(models_root);
    path.starts_with(&temp_root)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_part_path_under_tmp_downloads() {
        let root = PathBuf::from(r"C:\models");
        let part = models_download_part_path(&root, "klein-4b-q4", "file.gguf");
        assert!(part.to_string_lossy().contains(".tmp"));
        assert!(part.to_string_lossy().contains("downloads"));
        assert!(part.to_string_lossy().ends_with("file.gguf.part"));
    }
}
