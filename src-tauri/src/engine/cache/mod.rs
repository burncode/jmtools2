use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use sha2::{Digest, Sha256};

pub struct WorkflowCacheStore {
    root: PathBuf,
}

impl WorkflowCacheStore {
    pub fn new(project_root: &Path, workflow_id: &str) -> Self {
        Self {
            root: project_root
                .join(".cache")
                .join("workflows")
                .join(workflow_id),
        }
    }

    pub fn get(&self, cache_key: &str) -> Option<Value> {
        let path = self.cache_file_path(cache_key);
        let content = fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    }

    pub fn set(&self, cache_key: &str, outputs: &Value) -> Result<(), String> {
        fs::create_dir_all(&self.root).map_err(|error| format!("创建工作流缓存目录失败：{error}"))?;
        let path = self.cache_file_path(cache_key);
        let content = serde_json::to_string_pretty(outputs)
            .map_err(|error| format!("序列化缓存输出失败：{error}"))?;
        fs::write(path, content).map_err(|error| format!("写入工作流缓存失败：{error}"))
    }

    fn cache_file_path(&self, cache_key: &str) -> PathBuf {
        self.root.join(format!("{cache_key}.json"))
    }
}

/// 计算节点输出缓存键。
///
/// 使用 SHA-256 对 canonical JSON（对象键递归排序）求散列，保证跨 Rust 版本、
/// 跨进程稳定一致；避免 `DefaultHasher` 的算法不稳定导致升级后缓存整体失效。
pub fn compute_cache_key(node_kind: &str, params: &Value, inputs: &Value) -> String {
    let mut canonical = String::new();
    canonical.push_str(node_kind);
    canonical.push('\u{0}');
    write_canonical_json(params, &mut canonical);
    canonical.push('\u{0}');
    write_canonical_json(inputs, &mut canonical);

    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    let digest = hasher.finalize();

    let mut hex = String::with_capacity(digest.len() * 2);
    for byte in digest {
        hex.push_str(&format!("{byte:02x}"));
    }
    hex
}

/// 将 JSON 序列化为 canonical 形式：对象键按字典序递归排序，数组与标量保持原序。
fn write_canonical_json(value: &Value, out: &mut String) {
    match value {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            out.push('{');
            for (index, key) in keys.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                out.push_str(&Value::String((*key).clone()).to_string());
                out.push(':');
                if let Some(child) = map.get(*key) {
                    write_canonical_json(child, out);
                }
            }
            out.push('}');
        }
        Value::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_canonical_json(item, out);
            }
            out.push(']');
        }
        other => out.push_str(&other.to_string()),
    }
}
