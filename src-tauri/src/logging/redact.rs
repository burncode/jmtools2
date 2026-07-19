const PROMPT_PREVIEW_CHARS: usize = 120;
const STDERR_MAX_LINES: usize = 32;
const STDERR_MAX_CHARS: usize = 4_000;

pub fn redact_api_key(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if trimmed.len() <= 8 {
        return "***".to_string();
    }

    format!("{}***{}", &trimmed[..4], &trimmed[trimmed.len() - 2..])
}

pub fn redact_prompt(value: &str, redact_enabled: bool) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if !redact_enabled {
        return trimmed.chars().take(PROMPT_PREVIEW_CHARS * 4).collect();
    }

    if trimmed.len() <= PROMPT_PREVIEW_CHARS {
        return format!("[prompt:{} chars]", trimmed.len());
    }

    format!(
        "[prompt:{} chars] {}…",
        trimmed.len(),
        trimmed.chars().take(PROMPT_PREVIEW_CHARS).collect::<String>()
    )
}

pub fn truncate_stderr(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let mut lines = Vec::new();
    let mut total_chars = 0usize;

    for line in trimmed.lines().take(STDERR_MAX_LINES) {
        if total_chars >= STDERR_MAX_CHARS {
            break;
        }
        let remaining = STDERR_MAX_CHARS.saturating_sub(total_chars);
        let chunk: String = line.chars().take(remaining).collect();
        total_chars += chunk.len();
        lines.push(chunk);
    }

    let mut output = lines.join("\n");
    if trimmed.lines().count() > lines.len() || total_chars >= STDERR_MAX_CHARS {
        output.push_str("\n…(stderr truncated)");
    }
    output
}

pub fn sanitize_project_root(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    std::path::Path::new(trimmed)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("project")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_api_key_middle() {
        assert!(redact_api_key("sk-1234567890abcdef").contains("***"));
    }

    #[test]
    fn redacts_long_prompt_when_enabled() {
        let prompt = "a".repeat(200);
        let redacted = redact_prompt(&prompt, true);
        assert!(redacted.contains("200 chars"));
    }

    #[test]
    fn truncates_stderr_lines() {
        let stderr = (0..50).map(|index| format!("line-{index}")).collect::<Vec<_>>().join("\n");
        let truncated = truncate_stderr(&stderr);
        assert!(truncated.contains("truncated"));
    }
}
