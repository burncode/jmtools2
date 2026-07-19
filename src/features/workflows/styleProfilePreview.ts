import {
  getBuiltinPalette,
  resolveActivePalettePresetId,
} from "../style-presets/stylePaletteCatalog";
import { parsePaletteColorsParam } from "../style-presets/stylePresetParams";
import {
  getLightingTypeLabel,
  getLineWeightLabel,
  getMaterialStyleLabel,
  getRenderTypeLabel,
  getShadingStyleLabel,
  getTextureStyleLabel,
  LIGHTING_TYPE_CHOICES,
  PALETTE_MODE_CHOICES,
  RENDER_TYPE_CHOICES,
} from "./styleChoiceCatalog";

export interface StyleProfilePreviewResult {
  negativeHints: string[];
  styleProfile: StyleProfileAssetPreview;
  stylePrompt: string;
}

export interface StyleProfileAssetPreview {
  artReference: string;
  artReferences: string[];
  colorTheme: string;
  constraints: {
    consistencyStrength: number;
    identityLock: boolean;
    lineStyleLock: boolean;
    paletteLock: boolean;
  };
  lighting: {
    ambient: number;
    highlightStrength: number;
    shadowStrength: number;
    type: string;
  };
  negativeHints: string[];
  palette: {
    colors: string[];
    dithering: boolean;
    maxColors: number;
    mode: string;
    paletteStrength: number;
  };
  preset: string;
  stylePrompt: string;
  styleType: string;
  visualDna: {
    contrast: number;
    detail: number;
    edgeStyle: string;
    lineWeight: string;
    materialStyle: string;
    pixelDensity: string;
    renderType: string;
    saturation: number;
    shadingStyle: string;
    sharpness: number;
    textureStyle: string;
    customKeywords: string;
  };
}

function readString(params: Record<string, unknown>, key: string, fallback = ""): string {
  const value = params[key];
  return typeof value === "string" ? value.trim() : fallback;
}

function readNumber(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(1, Math.max(0, value));
  }
  return fallback;
}

function readInt(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(64, Math.max(2, Math.round(value)));
  }
  return fallback;
}

function readBoolean(params: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = params[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return fallback;
}

function parsePaletteColors(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

function renderTypeLabel(renderType: string): string {
  switch (renderType) {
    case "pixel":
      return "pixel art";
    case "anime":
      return "anime cel shading";
    case "realistic":
      return "realistic illustration";
    case "hand_drawn":
      return "hand drawn";
    case "low_poly":
      return "low poly 3d style";
    case "realism":
      return "realistic";
    case "stylized":
      return "stylized";
    default:
      return "stylized";
  }
}

function lightingLabel(lightingType: string): string {
  switch (lightingType) {
    case "flat":
      return "flat lighting";
    case "soft":
      return "soft diffused lighting";
    case "cinematic":
      return "cinematic lighting";
    case "volumetric":
      return "volumetric lighting";
    case "game":
      return "game style lighting";
    default:
      return "flat lighting";
  }
}

function buildColorThemeSegment(colorThemeMode: string, colorTheme: string, customColors: string[]): string {
  if (colorThemeMode === "custom" && customColors.length > 0) {
    return `custom color mood: ${customColors.join(", ")}`;
  }
  return `${colorTheme} color theme`;
}

function buildStylePrompt(params: {
  ambient: number;
  artReference: string;
  artReferences: string[];
  colorTheme: string;
  colorThemeMode: string;
  contrast: number;
  customColorThemeColors: string[];
  detail: number;
  dithering: boolean;
  edgeStyle: string;
  highlightStrength: number;
  lightingType: string;
  lineWeight: string;
  materialStyle: string;
  maxColors: number;
  paletteColors: string[];
  paletteMode: string;
  palettePresetLabel: string;
  paletteStrength: number;
  pixelDensity: string;
  renderType: string;
  saturation: number;
  shadingStyle: string;
  shadowStrength: number;
  sharpness: number;
  textureStyle: string;
  visualDnaCustomKeywords: string;
}): string {
  const segments: string[] = [];

  segments.push(renderTypeLabel(params.renderType));
  if (params.renderType === "pixel" && params.pixelDensity && params.pixelDensity !== "none") {
    segments.push(`${params.pixelDensity} sprite`);
  }
  if (params.edgeStyle === "hard") {
    segments.push("clean outline");
  } else if (params.edgeStyle === "soft") {
    segments.push("soft edges");
  }

  if (params.materialStyle && params.materialStyle !== "flat") {
    segments.push(`${getMaterialStyleLabel(params.materialStyle)} material`);
  }
  if (params.shadingStyle && params.shadingStyle !== "hard_cel") {
    segments.push(`${getShadingStyleLabel(params.shadingStyle)} shading`);
  }
  if (params.textureStyle && params.textureStyle !== "smooth") {
    segments.push(`${getTextureStyleLabel(params.textureStyle)} texture`);
  }
  if (params.lineWeight && params.lineWeight !== "medium") {
    const lineLabel = getLineWeightLabel(params.lineWeight);
    if (params.lineWeight === "none") {
      segments.push("lineless");
    } else {
      segments.push(`${lineLabel} line weight`);
    }
  }

  segments.push(buildColorThemeSegment(params.colorThemeMode, params.colorTheme, params.customColorThemeColors));
  segments.push(lightingLabel(params.lightingType));

  if (params.shadowStrength >= 0.55) {
    segments.push("defined shadows");
  }
  if (params.highlightStrength >= 0.5) {
    segments.push("strong highlights");
  }
  if (params.ambient >= 0.55) {
    segments.push("ambient fill light");
  }
  if (params.detail >= 0.7) {
    segments.push("high detail");
  } else if (params.detail <= 0.35) {
    segments.push("minimal detail");
  }
  if (params.contrast >= 0.65) {
    segments.push("high contrast");
  }
  if (params.saturation >= 0.65) {
    segments.push("vivid colors");
  } else if (params.saturation <= 0.35) {
    segments.push("muted colors");
  }
  if (params.sharpness >= 0.55) {
    segments.push("crisp edges");
  }
  if (params.paletteStrength >= 0.7) {
    segments.push(`limited ${params.maxColors} color palette`);
  }
  if (params.paletteMode === "manual" && params.paletteColors.length > 0) {
    segments.push(`palette colors: ${params.paletteColors.slice(0, params.maxColors).join(", ")}`);
  } else if (params.paletteMode === "locked") {
    segments.push("strict locked palette, no color drift");
    if (params.paletteColors.length > 0) {
      segments.push(`locked colors: ${params.paletteColors.slice(0, params.maxColors).join(", ")}`);
    }
  } else if (params.paletteMode === "preset" && params.paletteColors.length > 0) {
    if (params.palettePresetLabel) {
      segments.push(`preset palette: ${params.palettePresetLabel}`);
    } else {
      segments.push("preset palette colors");
    }
    segments.push(`colors: ${params.paletteColors.slice(0, params.maxColors).join(", ")}`);
  }
  if (params.dithering) {
    segments.push("ordered dithering");
  }
  const referenceText =
    params.artReferences.length > 0
      ? params.artReferences.join(" | ")
      : params.artReference;
  if (referenceText) {
    segments.push(`reference: ${referenceText}`);
  }
  if (params.visualDnaCustomKeywords.trim()) {
    segments.push(params.visualDnaCustomKeywords.trim());
  }

  return segments.join(", ");
}

function buildNegativeHints(
  renderType: string,
  lightingType: string,
  paletteLock: boolean,
  lineStyleLock: boolean,
): string[] {
  const hints = ["blurry", "low quality", "watermark", "text"];

  if (renderType === "pixel") {
    hints.push("realistic", "3d render", "smooth gradient");
  } else if (renderType === "anime") {
    hints.push("photorealistic", "western comic");
  } else if (renderType === "realistic") {
    hints.push("cartoon", "pixel art");
  } else if (renderType === "hand_drawn") {
    hints.push("3d", "vector flat");
  } else if (renderType === "low_poly") {
    hints.push("high poly", "realistic texture");
  }

  if (lightingType === "flat") {
    hints.push("harsh shadows");
  }
  if (paletteLock) {
    hints.push("color drift", "off-palette colors");
  }
  if (lineStyleLock) {
    hints.push("inconsistent line weight");
  }

  return hints;
}

function parseArtReferences(params: Record<string, unknown>, legacyReference: string): string[] {
  const raw = params.artReferences;
  if (Array.isArray(raw)) {
    const parsed = raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (parsed.length > 0) {
      return parsed;
    }
  }
  return legacyReference ? [legacyReference] : [];
}

export function previewStyleProfile(params: Record<string, unknown>): StyleProfilePreviewResult {
  const styleType = readString(params, "styleType", "pixel");
  const artReference = readString(params, "artReference");
  const artReferences = parseArtReferences(params, artReference);
  const colorTheme = readString(params, "colorTheme", "fantasy");
  const colorThemeMode = readString(params, "colorThemeMode", "preset");
  const customColorThemeColors = parsePaletteColorsParam(params.customColorThemeColors ?? "[]");
  const preset = readString(params, "preset", "pixel_retro_16");

  const renderType = readString(params, "renderType", styleType);
  const pixelDensity = readString(params, "pixelDensity");
  const edgeStyle = readString(params, "edgeStyle", "hard");
  const materialStyle = readString(params, "materialStyle", "flat");
  const shadingStyle = readString(params, "shadingStyle", "hard_cel");
  const textureStyle = readString(params, "textureStyle", "smooth");
  const lineWeight = readString(params, "lineWeight", "medium");
  const visualDnaCustomKeywords = readString(params, "visualDnaCustomKeywords");
  const detail = readNumber(params, "detail", 0.6);
  const contrast = readNumber(params, "contrast", 0.7);
  const saturation = readNumber(params, "saturation", 0.6);
  const sharpness = readNumber(params, "sharpness", 0.4);

  const paletteMode = readString(params, "paletteMode", "preset");
  const maxColors = readInt(params, "maxColors", 16);
  const paletteStrength = readNumber(params, "paletteStrength", 0.85);
  const dithering = readBoolean(params, "dithering", true);
  const colors = parsePaletteColors(readString(params, "paletteColors", "[]"));

  const lightingType = readString(params, "lightingType", "flat");
  const shadowStrength = readNumber(params, "shadowStrength", 0.5);
  const highlightStrength = readNumber(params, "highlightStrength", 0.3);
  const ambient = readNumber(params, "ambient", 0.4);

  const paletteLock = readBoolean(params, "paletteLock", false);
  const lineStyleLock = readBoolean(params, "lineStyleLock", false);
  const identityLock = readBoolean(params, "identityLock", false);
  const consistencyStrength = readNumber(params, "consistencyStrength", 0.85);
  const palettePresetLabel =
    getBuiltinPalette(resolveActivePalettePresetId(params))?.label ??
    readString(params, "palettePresetId");

  const stylePrompt = buildStylePrompt({
    ambient,
    artReference,
    artReferences,
    colorTheme,
    colorThemeMode,
    contrast,
    customColorThemeColors,
    detail,
    dithering,
    edgeStyle,
    highlightStrength,
    lightingType,
    lineWeight,
    materialStyle,
    maxColors,
    paletteColors: colors,
    paletteMode,
    palettePresetLabel,
    paletteStrength,
    pixelDensity,
    renderType,
    saturation,
    shadingStyle,
    shadowStrength,
    sharpness,
    textureStyle,
    visualDnaCustomKeywords,
  });

  const negativeHints = buildNegativeHints(renderType, lightingType, paletteLock, lineStyleLock);

  const styleProfile: StyleProfileAssetPreview = {
    artReference: artReferences[0] ?? artReference,
    artReferences,
    colorTheme: colorThemeMode === "custom" ? "custom" : colorTheme,
    constraints: {
      consistencyStrength,
      identityLock,
      lineStyleLock,
      paletteLock,
    },
    lighting: {
      ambient,
      highlightStrength,
      shadowStrength,
      type: lightingType,
    },
    negativeHints,
    palette: {
      colors,
      dithering,
      maxColors,
      mode: paletteMode,
      paletteStrength,
    },
    preset,
    stylePrompt,
    styleType,
    visualDna: {
      contrast,
      customKeywords: visualDnaCustomKeywords,
      detail,
      edgeStyle,
      lineWeight,
      materialStyle,
      pixelDensity,
      renderType,
      saturation,
      shadingStyle,
      sharpness,
      textureStyle,
    },
  };

  return { negativeHints, styleProfile, stylePrompt };
}

export const RENDER_TYPE_OPTIONS = RENDER_TYPE_CHOICES;
export const LIGHTING_TYPE_OPTIONS = LIGHTING_TYPE_CHOICES;
export const PALETTE_MODE_OPTIONS = PALETTE_MODE_CHOICES;

export {
  getLightingTypeLabel,
  getLineWeightLabel,
  getMaterialStyleLabel,
  getRenderTypeLabel,
  getShadingStyleLabel,
  getTextureStyleLabel,
};
