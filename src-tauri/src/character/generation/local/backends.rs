use super::types::BackendEvaluationStatus;

pub fn list_backend_evaluations() -> Vec<BackendEvaluationStatus> {
    vec![
        BackendEvaluationStatus {
            id: "sd-cpp".to_string(),
            label: "stable-diffusion.cpp（Runtime 扩展包）".to_string(),
            phase: "Phase 1".to_string(),
            integrated: true,
            summary: "官方 sd-cli 子进程，Vulkan / CUDA / AVX2 预编译包。".to_string(),
            recommendation: "主后端：下载 stable-diffusion.cpp Runtime，Klein Q4/Q8 出图。".to_string(),
        },
        BackendEvaluationStatus {
            id: "ollama".to_string(),
            label: "Ollama 图像 API".to_string(),
            phase: "Phase 1".to_string(),
            integrated: true,
            summary: "通过 /v1/images/generations 调用本机 Ollama。".to_string(),
            recommendation: "可选备选：需自行安装并 pull 对应模型。".to_string(),
        },
        evaluate_oxibonsai(),
        evaluate_bonsai_image_4b(),
        evaluate_candle(),
        evaluate_pixel_forge(),
    ]
}

fn evaluate_oxibonsai() -> BackendEvaluationStatus {
    BackendEvaluationStatus {
        id: "oxibonsai".to_string(),
        label: "OxiBonsai（纯 Rust Bonsai）".to_string(),
        phase: "Phase 2".to_string(),
        integrated: false,
        summary: "零 FFI 纯 Rust 推理，原生支持 Bonsai 1-bit/ternary 与 Bonsai-Image 管线。".to_string(),
        recommendation: "待 benchmark：若 Bonsai 体积/速度优于 Klein Q4，切换 4–8GB 默认档。".to_string(),
    }
}

fn evaluate_bonsai_image_4b() -> BackendEvaluationStatus {
    BackendEvaluationStatus {
        id: "bonsai-image-4b".to_string(),
        label: "Bonsai Image 4B（PrismML）".to_string(),
        phase: "Phase 2".to_string(),
        integrated: false,
        summary: "基于 Klein 4B 的 QAT 压缩模型；官方 MLX/GemLite 格式不直接集成，计划经 OxiBonsai 或 sd.cpp GGUF 转换。".to_string(),
        recommendation: "POC 结论：暂不集成。详见 docs/local-bonsai-poc-notes.md；4–6GB 仍优先 sdxs-512 / klein-4b-q4。".to_string(),
    }
}

fn evaluate_candle() -> BackendEvaluationStatus {
    BackendEvaluationStatus {
        id: "candle-mold".to_string(),
        label: "Candle / mold / plakat".to_string(),
        phase: "Phase 2".to_string(),
        integrated: false,
        summary: "纯 Rust HF 生态；Klein/Flux GGUF 与 LoRA stacking 能力强，但 pipeline 集成成本高。".to_string(),
        recommendation: "仅当 sd-cpp 不足时评估第二后端；可借鉴 mold catalog UX。".to_string(),
    }
}

fn evaluate_pixel_forge() -> BackendEvaluationStatus {
    BackendEvaluationStatus {
        id: "pixel-forge".to_string(),
        label: "Pixel-Forge（32×32 专用）".to_string(),
        phase: "Phase 2".to_string(),
        integrated: false,
        summary: "cochranblock/pixel-forge crate 面向 32×32 像素图标；CPU 可跑。".to_string(),
        recommendation: "作为 PixelBackend 服务图标/小道具，不支持 turnaround。".to_string(),
    }
}
