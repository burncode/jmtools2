use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
use std::path::Path;
use std::time::Instant;

use reqwest::blocking::Client;

use super::download_progress::report_download_progress;
use super::settings::rewrite_huggingface_url;

fn existing_part_bytes(part_path: &Path) -> u64 {
    std::fs::metadata(part_path)
        .map(|meta| meta.len())
        .unwrap_or(0)
}

fn parse_content_range_total(value: &str) -> Option<u64> {
    let slash = value.rfind('/')?;
    value[slash + 1..].trim().parse().ok()
}

pub fn download_http_file(
    url: &str,
    part_path: &Path,
    label: &str,
    base_bytes: u64,
    bundle_total_bytes: u64,
    file_estimated_bytes: u64,
    hf_endpoint: &str,
    mut check_abort: impl FnMut() -> Result<(), String>,
) -> Result<(), String> {
    let request_url = rewrite_huggingface_url(url, hf_endpoint);
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(3600))
        .build()
        .map_err(|error| format!("创建下载客户端失败：{error}"))?;

    if let Some(parent) = part_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("创建下载临时目录失败：{error}"))?;
    }

    let mut existing_bytes = existing_part_bytes(part_path);
    let mut response = if existing_bytes > 0 {
        client
            .get(&request_url)
            .header("Range", format!("bytes={existing_bytes}-"))
            .send()
            .map_err(|error| format!("下载失败：{error}"))?
    } else {
        client
            .get(&request_url)
            .send()
            .map_err(|error| format!("下载失败：{error}"))?
    };

    let status = response.status();
    if status.as_u16() == 404 {
        return Err(format!(
            "下载地址不可用（HTTP 404）：{request_url}。请检查网络或等待 manifest 更新。"
        ));
    }

    if existing_bytes > 0 && status.as_u16() == 200 {
        let _ = std::fs::remove_file(part_path);
        existing_bytes = 0;
        response = client
            .get(&request_url)
            .send()
            .map_err(|error| format!("下载失败：{error}"))?;
    }

    let status = response.status();
    if !(status.is_success() || status.as_u16() == 206) {
        return Err(format!("下载失败（HTTP {}）", status.as_u16()));
    }

    let content_range_total = response
        .headers()
        .get("content-range")
        .and_then(|value| value.to_str().ok())
        .and_then(parse_content_range_total);

    let file_content_length = content_range_total.or_else(|| {
        response
            .content_length()
            .map(|length| existing_bytes.saturating_add(length))
    });

    let mut file = if existing_bytes > 0 && status.as_u16() == 206 {
        OpenOptions::new()
            .create(true)
            .append(true)
            .open(part_path)
            .map_err(|error| format!("打开临时文件失败：{error}"))?
    } else {
        existing_bytes = 0;
        File::create(part_path).map_err(|error| format!("创建临时文件失败：{error}"))?
    };

    let mut file_bytes = existing_bytes;
    let mut buffer = [0_u8; 8192];
    let mut last_report = Instant::now();
    let mut last_reported_at = file_bytes;

    loop {
        check_abort()?;

        let read = response
            .read(&mut buffer)
            .map_err(|error| format!("读取数据失败：{error}"))?;
        if read == 0 {
            break;
        }
        file.write_all(&buffer[..read])
            .map_err(|error| format!("写入临时文件失败：{error}"))?;
        file_bytes += read as u64;

        let cumulative = base_bytes.saturating_add(file_bytes);
        let should_report = last_report.elapsed().as_millis() >= 200
            || file_bytes.saturating_sub(last_reported_at) >= 256 * 1024;
        if should_report {
            report_download_progress(
                label,
                cumulative,
                file_content_length.map(|total| {
                    if total >= file_bytes {
                        base_bytes.saturating_add(total.saturating_sub(existing_bytes))
                    } else {
                        base_bytes.saturating_add(total)
                    }
                }),
                Some(bundle_total_bytes.max(file_estimated_bytes)),
                "downloading",
            );
            last_report = Instant::now();
            last_reported_at = file_bytes;
        }
    }

    file.sync_all()
        .map_err(|error| format!("同步临时文件失败：{error}"))?;

    report_download_progress(
        label,
        base_bytes.saturating_add(file_bytes),
        file_content_length.map(|total| base_bytes.saturating_add(total.max(file_bytes))),
        Some(bundle_total_bytes.max(file_estimated_bytes)),
        "downloading",
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::parse_content_range_total;

    #[test]
    fn parse_content_range_total_reads_suffix() {
        assert_eq!(
            parse_content_range_total("bytes 100-999/5000"),
            Some(5000)
        );
    }
}
