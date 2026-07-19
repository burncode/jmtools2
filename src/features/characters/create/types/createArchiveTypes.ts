import type { AppSettings } from "@/lib/tauri/commands";

import type { CharacterImageAsset, CharacterMasterCandidatePlan } from "../../types";

export interface CreateArchivePostProcessOptions {
  runAnalyze: boolean;
  runNormalize: boolean;
  runRemoveBackground: boolean;
  runViews: boolean;
}

export interface CreateArchiveRemoveBackgroundParams {
  alphaMatting: boolean;
  backgroundThreshold: number;
  cleanupStrength: AppSettings["backgroundRemovalCleanupStrength"];
  customModelPath: string;
  edgeSoftness: number;
  engine: AppSettings["backgroundRemovalEngine"];
  executablePath: string;
  foregroundThreshold: number;
  holeFillMaxPixels: number;
  mattingColorSpace: "rgb" | "ycbcr";
  model: AppSettings["backgroundRemovalModel"];
  preserveSmallParts: boolean;
  spillSuppression: number;
  tolerance: number;
}

export interface CreateArchiveNormalizeParams {
  scaleMode: string;
  targetHeight: number;
  targetWidth: number;
}

export interface CreateArchiveAnalyzeParams {
  maxBboxRatioPct: number;
  minAlphaCoveragePct: number;
}

export interface CreateArchivePostProcessParams {
  analyze: CreateArchiveAnalyzeParams;
  normalize: CreateArchiveNormalizeParams;
  removeBackground: CreateArchiveRemoveBackgroundParams;
}

export interface CreateArchivePostProcessState {
  options: CreateArchivePostProcessOptions;
  params: CreateArchivePostProcessParams;
}

export type PostProcessPreviewImages = Partial<
  Record<"back" | "front" | "left" | "right", CharacterImageAsset>
>;

export interface PostProcessPreviewResult {
  analyzeReport?: {
    score?: number;
    warnings: string[];
  };
  directionPreviews: PostProcessPreviewImages;
  planId: string;
}

export function hasEnabledPostProcess(options: CreateArchivePostProcessOptions) {
  return (
    options.runAnalyze ||
    options.runNormalize ||
    options.runRemoveBackground ||
    options.runViews
  );
}

export function buildDefaultPostProcessParams(
  settings: AppSettings,
  draftSize: { customHeight: number; customWidth: number; size: string },
): CreateArchivePostProcessParams {
  const [targetWidth, targetHeight] = resolveDraftCanvasSize(draftSize);

  return {
    analyze: {
      maxBboxRatioPct: 85,
      minAlphaCoveragePct: 6,
    },
    normalize: {
      scaleMode: "integer",
      targetHeight,
      targetWidth,
    },
    removeBackground: {
      alphaMatting: settings.backgroundRemovalAlphaMatting,
      backgroundThreshold: settings.backgroundRemovalBackgroundThreshold,
      cleanupStrength: settings.backgroundRemovalCleanupStrength,
      customModelPath: settings.backgroundRemovalModelPath,
      edgeSoftness: settings.backgroundRemovalEdgeSoftness,
      engine: settings.backgroundRemovalEngine,
      executablePath: settings.backgroundRemovalExecutablePath,
      foregroundThreshold: settings.backgroundRemovalForegroundThreshold,
      holeFillMaxPixels: settings.backgroundRemovalHoleFillMaxPixels,
      mattingColorSpace: "rgb",
      model: settings.backgroundRemovalModel,
      preserveSmallParts: settings.backgroundRemovalPreserveSmallParts,
      spillSuppression: settings.backgroundRemovalSpillSuppression,
      tolerance: settings.backgroundRemovalTolerance,
    },
  };
}

function resolveDraftCanvasSize(draft: {
  customHeight: number;
  customWidth: number;
  size: string;
}): [number, number] {
  if (draft.size === "自定义") {
    return [draft.customWidth || 32, draft.customHeight || 48];
  }

  if (draft.size === "48x48") {
    return [48, 48];
  }

  if (draft.size === "64x64") {
    return [64, 64];
  }

  return [32, 48];
}

export function collectPlanSourceImages(plan: CharacterMasterCandidatePlan): PostProcessPreviewImages {
  const images: PostProcessPreviewImages = {};

  if (plan.masterImage) {
    images.front = plan.masterImage;
  }

  if (plan.directionPreviews) {
    for (const key of ["front", "back", "left", "right"] as const) {
      if (plan.directionPreviews[key]) {
        images[key] = plan.directionPreviews[key];
      }
    }
  }

  return images;
}
