pub mod ai_generation;
pub mod ai_models;
pub mod asset_tools;
pub mod background_tools;
pub mod character_archetypes;
pub mod character_pipeline;
pub mod characters;
pub mod diagnostics;
pub mod local_models;
pub mod logging;
pub mod project;
pub mod project_character_generation;
pub mod settings;
pub mod style_presets;
pub mod system;
pub mod workflows;

#[cfg(test)]
mod command_file_line_limits {
    use std::fs;
    use std::path::PathBuf;

    const MAX_COMMAND_FILE_LINES: usize = 600;

    fn count_lines(path: &PathBuf) -> usize {
        fs::read_to_string(path)
            .map(|content| content.lines().count())
            .unwrap_or(0)
    }

    #[test]
    fn characters_command_files_stay_under_line_limit() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let characters_commands_dir = manifest_dir.join("src").join("commands").join("characters");
        let legacy_monolith = manifest_dir.join("src").join("commands").join("characters.rs");

        assert!(
            !legacy_monolith.exists(),
            "legacy monolith must be removed: {}",
            legacy_monolith.display()
        );

        let mut offenders = Vec::new();
        for entry in fs::read_dir(&characters_commands_dir).expect("read characters commands dir") {
            let entry = entry.expect("characters command entry");
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("rs") {
                continue;
            }
            let lines = count_lines(&path);
            if lines > MAX_COMMAND_FILE_LINES {
                offenders.push(format!("{} ({lines} lines)", path.display()));
            }
        }

        assert!(
            offenders.is_empty(),
            "commands/characters files exceed {MAX_COMMAND_FILE_LINES} lines:\n{}",
            offenders.join("\n")
        );
    }

    #[test]
    fn character_domain_files_stay_under_line_limit() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let character_dir = manifest_dir.join("src").join("character");

        let mut offenders = Vec::new();
        for entry in walkdir_rs_files(&character_dir) {
            let lines = count_lines(&entry);
            if lines > MAX_COMMAND_FILE_LINES {
                offenders.push(format!("{} ({lines} lines)", entry.display()));
            }
        }

        assert!(
            offenders.is_empty(),
            "character domain files exceed {MAX_COMMAND_FILE_LINES} lines:\n{}",
            offenders.join("\n")
        );
    }

    fn walkdir_rs_files(dir: &PathBuf) -> Vec<PathBuf> {
        let mut files = Vec::new();
        for entry in fs::read_dir(dir).expect("read character dir") {
            let entry = entry.expect("character entry");
            let path = entry.path();
            if path.is_dir() {
                files.extend(walkdir_rs_files(&path));
            } else if path.extension().and_then(|ext| ext.to_str()) == Some("rs") {
                files.push(path);
            }
        }
        files
    }
}

