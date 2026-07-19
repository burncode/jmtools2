import animeCel from "../../../shared/style-presets/anime_cel.json";
import handPaint from "../../../shared/style-presets/hand_paint.json";
import lowPolyFlat from "../../../shared/style-presets/low_poly_flat.json";
import pixelRetro16 from "../../../shared/style-presets/pixel_retro_16.json";
import realisticSoft from "../../../shared/style-presets/realistic_soft.json";

import { parsePaletteColorsParam } from "./stylePresetParams";

export interface BuiltinPaletteDefinition {
  colors: string[];
  id: string;
  label: string;
  maxColors: number;
  tagline: string;
}

function fromStylePreset(
  id: string,
  label: string,
  tagline: string,
  params: Record<string, unknown>,
): BuiltinPaletteDefinition {
  const colors = parsePaletteColorsParam(params.paletteColors ?? "[]");
  const maxColors =
    typeof params.maxColors === "number" && Number.isFinite(params.maxColors)
      ? Math.round(params.maxColors)
      : colors.length;

  return { id, label, tagline, maxColors, colors };
}

export const BUILTIN_PALETTE_CATALOG: BuiltinPaletteDefinition[] = [
  fromStylePreset("palette_pixel_retro_16", "复古 16 色", "像素 RPG 经典盘", pixelRetro16.params),
  fromStylePreset("palette_anime_cel", "赛璐璐 8 色", "角色立绘常用盘", animeCel.params),
  fromStylePreset("palette_realistic_soft", "柔光写实 8 色", "电影感插画盘", realisticSoft.params),
  fromStylePreset("palette_hand_paint", "手绘暖色 8 色", "风格化场景盘", handPaint.params),
  fromStylePreset("palette_low_poly", "低模几何 8 色", "块面风格盘", lowPolyFlat.params),
  {
    id: "palette_dark_dungeon",
    label: "暗色地牢 8 色",
    tagline: "低饱和地下城氛围",
    maxColors: 8,
    colors: ["#0d0d0d", "#1a1a2e", "#16213e", "#0f3460", "#533483", "#6a4c93", "#8d99ae", "#c9ada7"],
  },
  {
    id: "palette_vivid_cel",
    label: "高饱和赛璐璐 12 色",
    tagline: "高对比动漫配色",
    maxColors: 12,
    colors: ["#ffffff", "#ffe066", "#ff6b6b", "#ee5a24", "#0984e3", "#6c5ce7", "#00b894", "#fdcb6e", "#e17055", "#74b9ff", "#a29bfe", "#2d3436"],
  },
  {
    id: "palette_fantasy_glow",
    label: "奇幻辉光 10 色",
    tagline: "魔法场景与 UI 高光",
    maxColors: 10,
    colors: ["#1b1033", "#3d1c78", "#6b2fb5", "#9b59ff", "#c084fc", "#f0abfc", "#fde68a", "#34d399", "#22d3ee", "#f8fafc"],
  },
  {
    id: "palette_forest_green",
    label: "森林绿 8 色",
    tagline: "自然场景与植被",
    maxColors: 8,
    colors: ["#0d1f0d", "#1a3a1a", "#2d5a27", "#4a7c3f", "#6b8e4e", "#8fbc8f", "#c4d7a5", "#e8f0d8"],
  },
  {
    id: "palette_sunset_orange",
    label: "日落橙 8 色",
    tagline: "暖色黄昏与火焰",
    maxColors: 8,
    colors: ["#1a0a00", "#4a1a00", "#8b2500", "#cc5500", "#ff7700", "#ff9933", "#ffcc66", "#ffe4b5"],
  },
  {
    id: "palette_cyber_teal",
    label: "赛博青 8 色",
    tagline: "科幻 UI 与霓虹",
    maxColors: 8,
    colors: ["#0a0e14", "#0f2027", "#203a43", "#2c5364", "#11998e", "#38ef7d", "#00d2ff", "#3a7bd5"],
  },
  {
    id: "palette_metal_gray",
    label: "金属灰 8 色",
    tagline: "机械与工业质感",
    maxColors: 8,
    colors: ["#0d0d0d", "#1c1c1c", "#333333", "#4d4d4d", "#666666", "#8c8c8c", "#b3b3b3", "#d9d9d9"],
  },
  {
    id: "palette_candy_pink",
    label: "糖果粉 8 色",
    tagline: "可爱休闲与 UI",
    maxColors: 8,
    colors: ["#fff0f5", "#ffc0cb", "#ff69b4", "#ff1493", "#db7093", "#c71585", "#9370db", "#dda0dd"],
  },
  {
    id: "palette_ink_wash",
    label: "水墨灰 8 色",
    tagline: "东方水墨与留白",
    maxColors: 8,
    colors: ["#f5f5f0", "#e8e4d9", "#c4bfb3", "#9a9590", "#6b6660", "#4a4540", "#2d2926", "#1a1714"],
  },
];

export function getBuiltinPalette(paletteId: string): BuiltinPaletteDefinition | undefined {
  return BUILTIN_PALETTE_CATALOG.find((item) => item.id === paletteId);
}

export function resolveActivePalettePresetId(params: Record<string, unknown>): string {
  const explicit = params.palettePresetId;
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit;
  }

  const colors = parsePaletteColorsParam(params.paletteColors ?? "[]");
  const matched = BUILTIN_PALETTE_CATALOG.find(
    (item) =>
      item.colors.length === colors.length &&
      item.colors.every((color, index) => color.toLowerCase() === (colors[index] ?? "").toLowerCase()),
  );

  return matched?.id ?? BUILTIN_PALETTE_CATALOG[0].id;
}
