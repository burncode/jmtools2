import animeCelThumb from "@/assets/style-presets/anime-cel.svg";
import handPaintThumb from "@/assets/style-presets/hand-paint.svg";
import lowPolyFlatThumb from "@/assets/style-presets/low-poly-flat.svg";
import pixelRetro16Thumb from "@/assets/style-presets/pixel-retro-16.svg";
import realisticSoftThumb from "@/assets/style-presets/realistic-soft.svg";

import animeCel from "../../../shared/style-presets/anime_cel.json";
import handPaint from "../../../shared/style-presets/hand_paint.json";
import lowPolyFlat from "../../../shared/style-presets/low_poly_flat.json";
import pixelRetro16 from "../../../shared/style-presets/pixel_retro_16.json";
import realisticSoft from "../../../shared/style-presets/realistic_soft.json";

export interface StylePresetDefinition {
  id: string;
  label: string;
  params: Record<string, unknown>;
  tagline: string;
  thumbnail: string;
}

const PRESET_CATALOG: Record<string, Pick<StylePresetDefinition, "tagline" | "thumbnail">> = {
  pixel_retro_16: {
    tagline: "16 色 · 平光 · 复古 RPG",
    thumbnail: pixelRetro16Thumb,
  },
  anime_cel: {
    tagline: "赛璐璐 · 柔光 · 角色立绘",
    thumbnail: animeCelThumb,
  },
  realistic_soft: {
    tagline: "柔光 · 电影感 · 写实插画",
    thumbnail: realisticSoftThumb,
  },
  hand_paint: {
    tagline: "手绘笔触 · 暖色 · 风格化",
    thumbnail: handPaintThumb,
  },
  low_poly_flat: {
    tagline: "低模 · 平光 · 几何块面",
    thumbnail: lowPolyFlatThumb,
  },
};

function enrichPreset(raw: { id: string; label: string; params: Record<string, unknown> }): StylePresetDefinition {
  const catalog = PRESET_CATALOG[raw.id];
  return {
    ...raw,
    tagline: catalog?.tagline ?? raw.label,
    thumbnail: catalog?.thumbnail ?? pixelRetro16Thumb,
  };
}

export const STYLE_PRESETS: StylePresetDefinition[] = [
  enrichPreset(pixelRetro16),
  enrichPreset(animeCel),
  enrichPreset(realisticSoft),
  enrichPreset(handPaint),
  enrichPreset(lowPolyFlat),
];

export function toStylePresetDefinition(preset: StylePresetDefinition) {
  return {
    createdAt: 0,
    id: preset.id,
    isBuiltin: true,
    label: preset.label,
    params: preset.params,
    tagline: preset.tagline,
    tags: [],
    thumbnail: preset.thumbnail,
    updatedAt: 0,
  };
}

export function getStylePresetThumbnail(thumbnailKey: string, fallback = pixelRetro16Thumb): string {
  const catalog = PRESET_CATALOG[thumbnailKey];
  return catalog?.thumbnail ?? fallback;
}

export function getStylePreset(presetId: string): StylePresetDefinition | undefined {
  return STYLE_PRESETS.find((preset) => preset.id === presetId);
}

export function isStyleParamsMatchingPreset(
  params: Record<string, unknown>,
  presetId: string,
): boolean {
  const preset = getStylePreset(presetId);
  if (!preset) {
    return false;
  }

  return Object.entries(preset.params).every(([key, value]) => {
    const current = params[key];
    if (typeof value === "number" && typeof current === "number") {
      return Math.abs(value - current) < 0.0001;
    }
    return current === value;
  });
}
