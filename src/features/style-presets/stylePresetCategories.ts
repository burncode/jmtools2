import type { StylePresetRecord } from "./types";

export interface StylePresetCategory {
  id: string;
  label: string;
  match: (preset: StylePresetRecord) => boolean;
}

export const STYLE_PRESET_CATEGORIES: StylePresetCategory[] = [
  {
    id: "all",
    label: "全部",
    match: () => true,
  },
  {
    id: "pixel",
    label: "像素风格",
    match: (preset) =>
      preset.id.includes("pixel") ||
      preset.tagline.includes("像素") ||
      String(preset.params.renderType ?? "") === "pixel",
  },
  {
    id: "anime",
    label: "动漫风格",
    match: (preset) =>
      preset.id.includes("anime") ||
      preset.tagline.includes("赛璐璐") ||
      preset.tagline.includes("动漫") ||
      String(preset.params.renderType ?? "") === "anime",
  },
  {
    id: "realistic",
    label: "写实风格",
    match: (preset) =>
      preset.id.includes("realistic") ||
      preset.tagline.includes("写实") ||
      String(preset.params.renderType ?? "") === "realistic",
  },
  {
    id: "hand_paint",
    label: "手绘风格",
    match: (preset) =>
      preset.id.includes("hand") ||
      preset.tagline.includes("手绘") ||
      String(preset.params.renderType ?? "") === "hand_drawn",
  },
  {
    id: "low_poly",
    label: "低模风格",
    match: (preset) =>
      preset.id.includes("poly") ||
      preset.tagline.includes("低模") ||
      String(preset.params.renderType ?? "") === "low_poly",
  },
];

export function filterPresetsByCategory(presets: StylePresetRecord[], categoryId: string): StylePresetRecord[] {
  const category = STYLE_PRESET_CATEGORIES.find((item) => item.id === categoryId) ?? STYLE_PRESET_CATEGORIES[0];
  return presets.filter(category.match);
}

export function countPresetsByCategory(presets: StylePresetRecord[], categoryId: string): number {
  return filterPresetsByCategory(presets, categoryId).length;
}
