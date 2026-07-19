import { getColorThemeLabel } from "./colorThemeCatalog";
import { parsePaletteColorsParam } from "./stylePresetParams";
import { getLightingTypeLabel, getRenderTypeLabel } from "../workflows/styleProfilePreview";

function readNumber(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function buildStylePresetSummary(params: Record<string, unknown>): string {
  const maxColors = Math.round(readNumber(params, "maxColors", 16));
  const lightingLabel = getLightingTypeLabel(String(params.lightingType ?? "flat"));
  const renderLabel = getRenderTypeLabel(String(params.renderType ?? params.styleType ?? "pixel"));
  const colorThemeMode = String(params.colorThemeMode ?? "preset");

  const parts = [`${maxColors} 色`, lightingLabel, renderLabel];

  if (colorThemeMode === "custom") {
    const colors = parsePaletteColorsParam(params.customColorThemeColors ?? "[]");
    if (colors.length > 0) {
      parts.push("自定义配色");
    }
  } else {
    const themeLabel = getColorThemeLabel(String(params.colorTheme ?? "fantasy"));
    if (themeLabel) {
      parts.push(themeLabel);
    }
  }

  return parts.join(" · ");
}
