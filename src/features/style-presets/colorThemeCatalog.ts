export interface ColorThemeDefinition {
  gradient: string;
  id: string;
  label: string;
}

export const BUILTIN_COLOR_THEME_CATALOG: ColorThemeDefinition[] = [
  {
    id: "dark",
    label: "暗色",
    gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #334155 100%)",
  },
  {
    id: "light",
    label: "亮色",
    gradient: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 45%, #cbd5e1 100%)",
  },
  {
    id: "fantasy",
    label: "奇幻",
    gradient: "linear-gradient(135deg, #312e81 0%, #7c3aed 45%, #22d3ee 100%)",
  },
  {
    id: "warm",
    label: "暖色",
    gradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 45%, #fbbf24 100%)",
  },
  {
    id: "cool",
    label: "冷色",
    gradient: "linear-gradient(135deg, #0c4a6e 0%, #0284c7 45%, #67e8f9 100%)",
  },
  {
    id: "neon",
    label: "霓虹",
    gradient: "linear-gradient(135deg, #09090b 0%, #22d3ee 45%, #f0abfc 100%)",
  },
  {
    id: "pastel",
    label: "粉彩",
    gradient: "linear-gradient(135deg, #fce7f3 0%, #fbcfe8 45%, #ddd6fe 100%)",
  },
  {
    id: "earth",
    label: "大地",
    gradient: "linear-gradient(135deg, #365314 0%, #854d0e 45%, #78716c 100%)",
  },
  {
    id: "monochrome",
    label: "单色",
    gradient: "linear-gradient(135deg, #171717 0%, #525252 45%, #d4d4d4 100%)",
  },
];

export const DEFAULT_CUSTOM_COLOR_THEME_COLORS = ["#1e293b", "#64748b"];

export function getBuiltinColorTheme(themeId: string): ColorThemeDefinition | undefined {
  return BUILTIN_COLOR_THEME_CATALOG.find((item) => item.id === themeId);
}

export function getColorThemeLabel(themeId: string): string {
  return getBuiltinColorTheme(themeId)?.label ?? themeId;
}

export function resolveActiveColorThemeId(params: Record<string, unknown>): string {
  const explicit = params.colorTheme;
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit;
  }
  return BUILTIN_COLOR_THEME_CATALOG[2]?.id ?? "fantasy";
}
