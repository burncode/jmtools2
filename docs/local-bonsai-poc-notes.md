# Bonsai Image 4B POC 评估笔记

> 评估日期：2026-06-24  
> 结论：**暂不集成** `bonsai-ternary-4b` 为可用档位；维持 catalog 展示 + Phase 2 评估态。

## 评估项

| 项 | 结论 | 说明 |
|---|---|---|
| 模型获取 | 可行 | PrismML / HuggingFace 有 Bonsai Image 4B 权重；Ternary ~1.2GB DiT，总体 bundle 仍约 4–5GB |
| 推理路径 A：OxiBonsai | **未就绪** | `backends.rs` 标记 `integrated: false`；需新增 `OxiBonsaiBackend` + 下载 manifest + 引擎分支，工作量约 1–2 周 |
| 推理路径 B：sd.cpp GGUF | **未验证** | 需确认 leejet/stable-diffusion.cpp 是否已有可用 Bonsai GGUF 与 Klein 同级 img2img；若无则仍依赖路径 A |
| 512×512 @ 4–6GB Vulkan | **待实测** | 理论优于 Klein Q4（权重更小），但缺少本机 benchmark；POC 未跑通端到端出图 |
| LoRA 兼容 | **未知** | catalog 注明 pixel LoRA 与 Bonsai 兼容性待验证 |
| img2img | **依赖 Runtime** | 若走 sd.cpp，与 Klein 相同依赖 `--init-img` / `--mode img2img`；OxiBonsai 需单独实现 |

## 推荐

1. **短期（当前版本）**：继续推荐 `sdxs-512`（极低显存）与 `klein-4b-q4`（质量/速度平衡）。
2. **中期**：当 OxiBonsai 或 sd.cpp 官方提供稳定 Bonsai GGUF + img2img 文档后，再开集成 spike。
3. **集成成本估算（若走 OxiBonsai）**：
   - Rust：`OxiBonsaiBackend` 实现 `LocalInferenceEngine`（~3–5 天）
   - 资源：`local_sd_model_assets.json` bundle + 下载（~2 天）
   - 前端：档位/Runtime 文案（~0.5 天）
   - 验证：512 出图 + img2img + LoRA 冒烟（~2 天）

## 决策

- **不合并** `bonsai-ternary-4b` 到默认可用档位。
- UI 继续在「引擎评估」与 catalog 中展示 Phase 2 状态。
- 待用户环境有 OxiBonsai 或 sd.cpp Bonsai 权重实测数据后，再更新本文件第二节 benchmark 表格。
