export type RuntimeParamCategory = "memory" | "vae" | "encoder" | "performance" | "expert";

export interface RuntimeParamMeta {
  category: RuntimeParamCategory;
  cliFlag: string;
  description: string;
  id: string;
  label: string;
}

export const runtimeParamCatalog: RuntimeParamMeta[] = [
  {
    id: "offloadToCpu",
    category: "memory",
    cliFlag: "--offload-to-cpu",
    label: "Offload to CPU",
    description: "将模型权重放在内存，推理时再载入 GPU，显著降低显存占用。",
  },
  {
    id: "diffusionFa",
    category: "performance",
    cliFlag: "--diffusion-fa",
    label: "Diffusion Flash Attention",
    description: "启用 Flash Attention，降低注意力层显存峰值。",
  },
  {
    id: "vaeOnCpu",
    category: "vae",
    cliFlag: "--vae-on-cpu",
    label: "VAE on CPU",
    description: "VAE 解码在 CPU 执行，降低 GPU 峰值，略慢。",
  },
  {
    id: "vaeTiling",
    category: "vae",
    cliFlag: "--vae-tiling",
    label: "VAE Tiling",
    description: "分块解码大图，适合极低显存或高分辨率。",
  },
  {
    id: "clipOnCpu",
    category: "encoder",
    cliFlag: "--clip-on-cpu",
    label: "文本编码器放 CPU",
    description: "Klein 的 LLM/文本编码器在 CPU 运行，进一步省显存。",
  },
  {
    id: "loraApplyMode",
    category: "performance",
    cliFlag: "--lora-apply-mode",
    label: "LoRA 应用模式",
    description: "控制 LoRA 注入时机：auto / at_runtime / immediately。",
  },
  {
    id: "paramsBackend",
    category: "expert",
    cliFlag: "--params-backend",
    label: "Params Backend",
    description: "按模块指定权重存放后端（高级，误配置可能导致极慢）。",
  },
  {
    id: "backend",
    category: "expert",
    cliFlag: "--backend",
    label: "Backend 分配",
    description: "细粒度指定各子模块计算设备（高级用户）。",
  },
];

export const runtimeCategoryLabels: Record<RuntimeParamCategory, string> = {
  memory: "显存与权重放置",
  vae: "VAE 解码",
  encoder: "文本编码 / LLM",
  performance: "性能与注意力",
  expert: "专家选项",
};

export type RuntimePresetId = "manifest" | "lowVram" | "ultraLowVram" | "custom";
