export interface StylePresetRecord {
  createdAt: number;
  id: string;
  isBuiltin: boolean;
  label: string;
  params: Record<string, unknown>;
  tagline: string;
  tags: string[];
  thumbnail: string;
  updatedAt: number;
}

export interface SaveStylePresetInput {
  id: string;
  label: string;
  params: Record<string, unknown>;
  tagline: string;
  tags: string[];
  thumbnail: string;
}

export interface StylePresetLibraryOpenPayload {
  mode: "edit" | "pick";
  nodeId?: string;
  presetId?: string;
  projectRoot?: string;
}

export const STYLE_OVERRIDE_PARAM_KEYS = [
  "enableLocalOverride",
  "styleWeight",
  "consistencyStrength",
  "referenceStrength",
  "negativeConstraintStrength",
] as const;

export const INLINE_STYLE_PARAM_KEYS = [
  "styleType",
  "artReference",
  "artReferences",
  "colorTheme",
  "colorThemeMode",
  "customColorThemeColors",
  "renderType",
  "pixelDensity",
  "edgeStyle",
  "materialStyle",
  "shadingStyle",
  "textureStyle",
  "lineWeight",
  "visualDnaCustomKeywords",
  "detail",
  "contrast",
  "saturation",
  "sharpness",
  "paletteMode",
  "palettePresetId",
  "maxColors",
  "paletteStrength",
  "dithering",
  "paletteColors",
  "lightingType",
  "shadowStrength",
  "highlightStrength",
  "ambient",
  "paletteLock",
  "lineStyleLock",
  "identityLock",
] as const;

export function resolvePresetId(params: Record<string, unknown>): string {
  const presetId = params.presetId ?? params.preset;
  return typeof presetId === "string" && presetId.trim() ? presetId : "pixel_retro_16";
}

function hasInlineStyleParamKeys(params: Record<string, unknown>): boolean {
  return INLINE_STYLE_PARAM_KEYS.some((key) => key in params);
}

function hasExplicitPresetReference(params: Record<string, unknown>): boolean {
  const presetId = params.presetId ?? params.preset;
  return typeof presetId === "string" && presetId.trim().length > 0;
}

export function hasLegacyInlineStyleParams(params: Record<string, unknown>): boolean {
  if (!hasInlineStyleParamKeys(params)) {
    return false;
  }

  if (Boolean(params.enableLocalOverride)) {
    return true;
  }

  return !hasExplicitPresetReference(params);
}

export function stripInlineStyleParamKeys(params: Record<string, unknown>): Record<string, unknown> {
  const next = { ...params };
  for (const key of INLINE_STYLE_PARAM_KEYS) {
    delete next[key];
  }
  return next;
}

export function resolveStyleParamsForPreview(
  nodeParams: Record<string, unknown>,
  presetParams?: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...(presetParams ?? {}) };

  if (Boolean(nodeParams.enableLocalOverride)) {
    for (const key of INLINE_STYLE_PARAM_KEYS) {
      if (key in nodeParams) {
        merged[key] = nodeParams[key];
      }
    }
    for (const key of STYLE_OVERRIDE_PARAM_KEYS) {
      if (key in nodeParams) {
        merged[key] = nodeParams[key];
      }
    }
  } else if (!hasExplicitPresetReference(nodeParams) && hasInlineStyleParamKeys(nodeParams)) {
    return { ...nodeParams };
  }

  merged.preset = resolvePresetId(nodeParams);
  merged.presetId = resolvePresetId(nodeParams);
  return merged;
}
