#[derive(Debug, Clone)]
pub struct ParsedHfFile {
    pub repo_id: String,
    pub revision: String,
    pub filename: String,
}

pub fn parse_hf_download_url(url: &str) -> Option<ParsedHfFile> {
    let marker = "/resolve/";
    let lower = url.to_lowercase();
    let host_end = lower
        .find("huggingface.co/")
        .map(|index| index + "huggingface.co/".len())
        .or_else(|| lower.find("hf.co/").map(|index| index + "hf.co/".len()))?;

    let rest = &url[host_end..];
    let resolve_index = rest.find(marker)?;
    let repo_id = rest[..resolve_index].trim().to_string();
    let after_resolve = &rest[resolve_index + marker.len()..];
    let mut parts = after_resolve.splitn(2, '/');
    let revision = parts.next()?.trim().to_string();
    let filename = parts.next()?.trim().to_string();

    if repo_id.is_empty() || revision.is_empty() || filename.is_empty() {
        return None;
    }

    Some(ParsedHfFile {
        repo_id,
        revision,
        filename,
    })
}

pub fn is_hf_download_url(
    download_url: &str,
    hf_repo: Option<&str>,
    fallback_file_name: &str,
) -> bool {
    resolve_hf_file(download_url, hf_repo, None, fallback_file_name).is_some()
}

pub fn resolve_hf_file(
    download_url: &str,
    hf_repo: Option<&str>,
    hf_revision: Option<&str>,
    fallback_file_name: &str,
) -> Option<ParsedHfFile> {
    if let Some(parsed) = parse_hf_download_url(download_url) {
        return Some(parsed);
    }

    let repo_id = hf_repo.filter(|value| !value.trim().is_empty())?;
    Some(ParsedHfFile {
        repo_id: repo_id.to_string(),
        revision: hf_revision
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("main")
            .to_string(),
        filename: fallback_file_name.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::parse_hf_download_url;

    #[test]
    fn parses_nested_hf_paths() {
        let parsed = parse_hf_download_url(
            "https://huggingface.co/Comfy-Org/flux2-dev/resolve/main/split_files/vae/flux2-vae.safetensors",
        )
        .expect("should parse nested hf path");

        assert_eq!(parsed.repo_id, "Comfy-Org/flux2-dev");
        assert_eq!(parsed.revision, "main");
        assert_eq!(parsed.filename, "split_files/vae/flux2-vae.safetensors");
    }
}
