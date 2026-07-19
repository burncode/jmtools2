import type { SettingsSection } from "./types";

export const settingsSections = [
  {
    description: "启动、保存和基础行为。",
    id: "general",
    label: "通用设置",
  },
  {
    description: "模型服务与流水线验证。",
    id: "ai",
    label: "AI 设置",
  },
  {
    description: "Klein / SDXS / Ollama 本地生图引擎。",
    id: "local-models",
    label: "本地生图",
  },
  {
    description: "风格、标签和生成参数字典。",
    id: "presets",
    label: "预设字典",
  },
  {
    description: "主题、密度和预览表现。",
    id: "display",
    label: "显示设置",
  },
  {
    description: "本地数据库和资源目录。",
    id: "resources",
    label: "项目与资源",
  },
  {
    description: "默认资源导出格式。",
    id: "export",
    label: "导出设置",
  },
  {
    description: "应用日志筛选、导出与级别设置。",
    id: "diagnostics",
    label: "诊断与日志",
  },
  {
    description: "版本、许可和诊断入口。",
    id: "about",
    label: "关于 JMTools",
  },
] as const satisfies SettingsSection[];

export const languageOptions = [
  { label: "简体中文", value: "zh-CN" },
  { label: "English", value: "en-US" },
] as const;

export const themeOptions = [
  { label: "深色桌面模式", value: "dark" },
  { label: "浅色模式", value: "light" },
  { label: "跟随系统", value: "system" },
] as const;

export const closeWindowOptions = [
  { label: "每次询问", value: "ask" },
  { label: "最小化到后台", value: "minimize" },
  { label: "直接退出", value: "exit" },
] as const;

export const densityOptions = [
  { label: "紧凑", value: "compact" },
  { label: "舒适", value: "comfortable" },
  { label: "宽松", value: "spacious" },
] as const;

export const sidebarStateOptions = [
  { label: "默认展开", value: "expanded" },
  { label: "默认收起", value: "collapsed" },
  { label: "记住上次状态", value: "remember" },
] as const;

export const accentColorOptions = [
  { label: "蓝色", value: "blue" },
  { label: "青色", value: "cyan" },
  { label: "紫色", value: "violet" },
  { label: "琥珀", value: "amber" },
  { label: "玫红", value: "rose" },
] as const;

export const fontSizeOptions = [
  { label: "小（13px）", value: "small" },
  { label: "中（14px）", value: "medium" },
  { label: "大（15px）", value: "large" },
] as const;

export const panelBorderOptions = [
  { label: "柔和", value: "soft" },
  { label: "标准", value: "standard" },
  { label: "清晰", value: "clear" },
] as const;

export const exportFormatOptions = [
  { label: "通用 PNG", value: "png" },
  { label: "Spritesheet + JSON", value: "spritesheet-json" },
] as const;

export const serviceModeOptions = [
  { label: "本地优先", value: "local-first" },
  { label: "自定义服务", value: "custom" },
] as const;

export const aiProviderOptions = [
  { label: "OpenAI", value: "openai" },
  { label: "DeepSeek", value: "deepseek" },
  { label: "本地模型（Ollama）", value: "ollama" },
  { label: "自定义接口", value: "custom" },
] as const;

export const previewQualityOptions = [
  { label: "性能优先", value: "performance" },
  { label: "标准", value: "balanced" },
  { label: "高质量", value: "quality" },
] as const;

export const previewFpsOptions = [
  { label: "30 FPS", value: 30 },
  { label: "60 FPS", value: 60 },
  { label: "120 FPS", value: 120 },
] as const;

export const pixelScaleOptions = [
  { label: "最近邻（像素清晰）", value: "nearest" },
  { label: "线性缩放", value: "linear" },
] as const;

export const previewBackgroundOptions = [
  { label: "透明棋盘格", value: "checkerboard" },
  { label: "深色背景", value: "dark" },
  { label: "浅色背景", value: "light" },
  { label: "透明背景", value: "transparent" },
] as const;

export const backgroundRemovalEngineOptions = [
  { label: "快速纯色背景", value: "chroma" },
  { label: "AI 语义去背景（rembg）", value: "rembg" },
] as const;

export const backgroundRemovalCleanupStrengthOptions = [
  { label: "关闭清理", value: "off" },
  { label: "轻度", value: "soft" },
  { label: "标准", value: "standard" },
  { label: "严格", value: "strict" },
] as const;

export const backgroundRemovalModelOptions = [
  { label: "IS-Net 通用模型", value: "isnet-general-use" },
  { label: "BiRefNet 轻量模型", value: "birefnet-general-lite" },
  { label: "BiRefNet 通用模型", value: "birefnet-general" },
  { label: "Silueta 轻量模型", value: "silueta" },
  { label: "自定义本地模型", value: "custom" },
] as const;
