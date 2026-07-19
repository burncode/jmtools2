use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use image::RgbaImage;
use jmtools_lib::image_pipeline::action_quality::score_action_frames;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ValidateReport {
    errors: Vec<String>,
    expected_frames: usize,
    found_frames: usize,
    grade: String,
    ok: bool,
    score: u16,
    warnings: Vec<String>,
}

fn main() {
    if let Err(message) = run() {
        eprintln!("{message}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let mut args = env::args().skip(1);
    let mut frames_dir = PathBuf::new();
    let mut expected_frames = 8_usize;

    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--frames-dir" | "-d" => {
                frames_dir = PathBuf::from(args.next().ok_or("缺少 --frames-dir 参数值")?);
            }
            "--expected" | "-e" => {
                expected_frames = args
                    .next()
                    .ok_or("缺少 --expected 参数值")?
                    .parse()
                    .map_err(|_| "expected 必须是正整数".to_string())?;
            }
            "--help" | "-h" => {
                print_help();
                return Ok(());
            }
            _ if frames_dir.as_os_str().is_empty() => {
                frames_dir = PathBuf::from(arg);
            }
            other => return Err(format!("未知参数：{other}")),
        }
    }

    if frames_dir.as_os_str().is_empty() {
        print_help();
        return Err("请指定帧目录。".to_string());
    }

    let frames = load_frame_images(&frames_dir)?;
    let report = score_action_frames(&frames, expected_frames);
    let payload = ValidateReport {
        ok: report.score >= 70 && report.errors.is_empty(),
        errors: report.errors.clone(),
        expected_frames: report.expected_frames,
        found_frames: report.found_frames,
        grade: report.grade.clone(),
        score: report.score,
        warnings: report.warnings.clone(),
    };

    println!("{}", serde_json::to_string_pretty(&payload).map_err(|error| error.to_string())?);

    if !payload.ok {
        return Err(format!("QC 未通过：{} 分（{}）", payload.score, payload.grade));
    }

    Ok(())
}

fn load_frame_images(directory: &Path) -> Result<Vec<RgbaImage>, String> {
    if !directory.is_dir() {
        return Err(format!("帧目录不存在：{}", directory.display()));
    }

    let mut paths: Vec<PathBuf> = fs::read_dir(directory)
        .map_err(|error| format!("读取帧目录失败：{error}"))?
        .filter_map(|entry| entry.ok().map(|item| item.path()))
        .filter(|path| {
            path.extension()
                .and_then(|value| value.to_str())
                .is_some_and(|ext| {
                    matches!(
                        ext.to_ascii_lowercase().as_str(),
                        "png" | "webp" | "jpg" | "jpeg"
                    )
                })
        })
        .collect();

    paths.sort();

    if paths.is_empty() {
        return Err("帧目录内未找到 PNG/WebP/JPEG 图片。".to_string());
    }

    paths
        .into_iter()
        .map(|path| {
            image::open(&path)
                .map_err(|error| format!("读取图片失败 {}：{error}", path.display()))
                .map(|image| image.to_rgba8())
        })
        .collect()
}

fn print_help() {
    println!(
        "jm_ppvalidate — PerfectPixel 动作帧 headless QC\n\n\
用法：jm_ppvalidate <frames-dir> [--expected 8]\n\
     jm_ppvalidate --frames-dir ./frames --expected 8\n"
    );
}
