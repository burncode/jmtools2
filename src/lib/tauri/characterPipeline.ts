import { invoke } from "@tauri-apps/api/core";

import type {
  CharacterAssetRecord,
  CharacterImageAsset,
  CharacterMasterPlan,
  CharacterMasterPlanGenerationResult,
  CharacterWorkshopDraft,
} from "@/features/characters/types";
import type { AppSettings } from "@/lib/tauri/commands";

export interface CharacterExportAssetResult {
  absolutePath: string;
  kind: string;
  manifestPath?: string;
  path: string;
}

export interface GenerateCharacterViewImagesInput {
  characterId: string;
  generationStrategy?: string;
  projectRoot: string;
  referenceMode?: string;
  referenceStrength?: number;
  viewMode?: string;
  views?: string[];
}

export interface GenerateCharacterActionFramesInput {
  actionIds?: string[];
  allViews?: boolean;
  characterId: string;
  frameCount?: number;
  generationMode?: "filmstrip" | "perFrame";
  loopMode?: string;
  maxRetries?: number;
  motionPrompt?: string;
  poseReferencePng?: number[];
  previewFps?: number;
  projectRoot: string;
  referenceMode?: string;
  referenceStrength?: number;
  userFeedback?: string;
  viewKind?: string;
  viewKinds?: string[];
}

export interface NormalizeCharacterViewInput {
  characterId: string;
  paletteSize?: number;
  projectRoot: string;
  scaleMode?: string;
  targetHeight?: number;
  targetWidth?: number;
  viewId?: string;
}

export interface AnalyzeCharacterInput {
  characterId: string;
  maxBboxRatioPct?: number;
  minAlphaCoveragePct?: number;
  projectRoot: string;
  viewId?: string;
}

export interface ExportCharacterAnimationInput {
  actionId: string;
  characterId: string;
  exportFormat?: "png" | "json" | "godot" | "spritesheet" | "aseprite" | "manifest";
  fileName?: string;
  fps?: number;
  projectRoot: string;
}

export interface RunPostProcessSegmentOptions {
  runAnalyze?: boolean;
  runNormalize?: boolean;
  runRemoveBackground?: boolean;
  runViews?: boolean;
}

export interface RunPostProcessSegmentParams {
  analyze?: {
    maxBboxRatioPct: number;
    minAlphaCoveragePct: number;
  };
  normalize?: {
    scaleMode: string;
    targetHeight: number;
    targetWidth: number;
  };
}

function mapRustPlanToUiPlan(plan: CharacterMasterPlan & { rawContent?: string }): CharacterMasterPlan {
  return {
    ...plan,
    candidatePlans: (plan.candidatePlans ?? []).map((candidate) => ({
      ...candidate,
      selected: candidate.selected ?? false,
    })),
    directionConsistency: plan.directionConsistency ?? [],
    exportNotes: plan.exportNotes ?? [],
    rawContent: plan.rawContent ?? "",
    rolePositioning: plan.rolePositioning ?? "",
    visualKeywords: plan.visualKeywords ?? [],
  };
}

export async function generateMasterPlan(input: {
  compiledPrompt?: string;
  draft: CharacterWorkshopDraft;
  model: string;
  projectRoot: string;
  providerId: string;
  taskId: string;
}): Promise<CharacterMasterPlanGenerationResult> {
  const result = await invoke<{
    model: string;
    plan: CharacterMasterPlan;
    providerId: string;
    providerName: string;
    taskId: string;
  }>("generate_character_master_plan", {
    input: {
      compiledPrompt: input.compiledPrompt,
      draft: input.draft,
      model: input.model,
      projectRoot: input.projectRoot,
      providerId: input.providerId,
      taskId: input.taskId,
    },
  });

  return {
    model: result.model,
    plan: mapRustPlanToUiPlan(result.plan),
    providerId: result.providerId,
    providerName: result.providerName,
    taskId: result.taskId,
  };
}

export function generateViews(input: GenerateCharacterViewImagesInput) {
  return invoke<CharacterAssetRecord>("generate_character_view_images", {
    input: {
      characterId: input.characterId,
      generationStrategy: input.generationStrategy,
      projectRoot: input.projectRoot,
      referenceMode: input.referenceMode,
      referenceStrength: input.referenceStrength,
      viewMode: input.viewMode,
      views: input.views,
    },
  });
}

export function removeBackground(input: {
  alphaMatting?: boolean;
  backgroundThreshold?: number;
  characterId: string;
  cleanupStrength?: AppSettings["backgroundRemovalCleanupStrength"];
  customModelPath?: string;
  edgeSoftness?: number;
  engine?: "chroma" | "rembg";
  executablePath?: string;
  foregroundThreshold?: number;
  holeFillMaxPixels?: number;
  mattingColorSpace?: "rgb" | "ycbcr";
  model?: AppSettings["backgroundRemovalModel"];
  preserveSmallParts?: boolean;
  projectRoot: string;
  spillSuppression?: number;
  tolerance?: number;
  viewId?: string;
}) {
  return invoke<CharacterAssetRecord>("remove_character_background", { input });
}

export function normalizeViews(input: NormalizeCharacterViewInput) {
  return invoke<CharacterAssetRecord>("normalize_character_view", { input });
}

export function analyzeCharacter(input: AnalyzeCharacterInput) {
  return invoke<CharacterAssetRecord>("analyze_character", { input });
}

export function generateActionFrames(input: GenerateCharacterActionFramesInput) {
  return invoke<CharacterAssetRecord>("generate_character_action_frames", {
    input: {
      actionIds: input.actionIds,
      allViews: input.allViews,
      characterId: input.characterId,
      frameCount: input.frameCount,
      generationMode: input.generationMode,
      loopMode: input.loopMode,
      maxRetries: input.maxRetries,
      motionPrompt: input.motionPrompt,
      poseReferencePng: input.poseReferencePng,
      previewFps: input.previewFps,
      projectRoot: input.projectRoot,
      referenceMode: input.referenceMode,
      referenceStrength: input.referenceStrength,
      userFeedback: input.userFeedback,
      viewKind: input.viewKind,
    },
  });
}

export function exportAnimation(input: ExportCharacterAnimationInput) {
  return invoke<CharacterExportAssetResult>("export_character_animation", { input });
}

export interface PostProcessActionFramesInput {
  actionIds?: string[];
  characterId: string;
  mattingColorSpace?: "rgb" | "ycbcr";
  projectRoot: string;
  useMagentaKey?: boolean;
}

export function postProcessActionFrames(input: PostProcessActionFramesInput) {
  return invoke<CharacterAssetRecord>("post_process_action_frames", {
    input: {
      actionIds: input.actionIds,
      characterId: input.characterId,
      mattingColorSpace: input.mattingColorSpace,
      projectRoot: input.projectRoot,
      useMagentaKey: input.useMagentaKey,
    },
  });
}

export interface ManageCharacterActionTrackInput {
  actionId: string;
  characterId: string;
  label?: string;
  note?: string;
  projectRoot: string;
}

export function addCharacterActionTrack(input: ManageCharacterActionTrackInput) {
  return invoke<CharacterAssetRecord>("add_character_action_track", { input });
}

export function removeCharacterActionTrack(input: ManageCharacterActionTrackInput) {
  return invoke<CharacterAssetRecord>("remove_character_action_track", { input });
}

export async function runPostProcessSegment(
  projectRoot: string,
  characterId: string,
  options: RunPostProcessSegmentOptions,
  backgroundSettings?: Omit<Parameters<typeof removeBackground>[0], "characterId" | "projectRoot">,
  segmentParams?: RunPostProcessSegmentParams,
) {
  let record: CharacterAssetRecord | undefined;

  if (options.runViews) {
    record = await generateViews({ characterId, projectRoot });
  }

  if (options.runRemoveBackground && backgroundSettings) {
    record = await removeBackground({ ...backgroundSettings, characterId, projectRoot });
  }

  if (options.runNormalize) {
    record = await normalizeViews({
      characterId,
      projectRoot,
      scaleMode: segmentParams?.normalize?.scaleMode,
      targetHeight: segmentParams?.normalize?.targetHeight,
      targetWidth: segmentParams?.normalize?.targetWidth,
    });
  }

  if (options.runAnalyze) {
    record = await analyzeCharacter({
      characterId,
      maxBboxRatioPct: segmentParams?.analyze?.maxBboxRatioPct,
      minAlphaCoveragePct: segmentParams?.analyze?.minAlphaCoveragePct,
      projectRoot,
    });
  }

  if (!record) {
    throw new Error("未选择任何后处理步骤。");
  }

  return record;
}

export interface PreviewCandidatePostProcessInput {
  options: RunPostProcessSegmentOptions;
  params: {
    analyze: { maxBboxRatioPct: number; minAlphaCoveragePct: number };
    normalize: { scaleMode: string; targetHeight: number; targetWidth: number };
    removeBackground: {
      alphaMatting: boolean;
      backgroundThreshold: number;
      cleanupStrength: string;
      customModelPath: string;
      edgeSoftness: number;
      engine: string;
      executablePath: string;
      foregroundThreshold: number;
      holeFillMaxPixels: number;
      mattingColorSpace: string;
      model: string;
      preserveSmallParts: boolean;
      spillSuppression: number;
      tolerance: number;
    };
  };
  planId: string;
  projectRoot: string;
  sourceImages: Partial<Record<"back" | "front" | "left" | "right", CharacterImageAsset>>;
  taskId: string;
}

export interface PreviewCandidatePostProcessResult {
  analyzeReport?: { score?: number; warnings: string[] };
  directionPreviews: Partial<Record<"back" | "front" | "left" | "right", CharacterImageAsset>>;
  planId: string;
}

export function previewCandidatePostProcess(input: PreviewCandidatePostProcessInput) {
  return invoke<PreviewCandidatePostProcessResult>("preview_candidate_post_process", { input });
}

export interface PreviewCharacterGenerationPromptItem {
  planId: string;
  planName: string;
  prompt: string;
}

export interface PreviewCharacterGenerationPromptsResult {
  prompts: PreviewCharacterGenerationPromptItem[];
}

export function previewCharacterGenerationPrompts(input: {
  compiledPrompt?: string;
  draft: CharacterWorkshopDraft;
  masterPlan: CharacterMasterPlan;
  projectRoot: string;
}) {
  return invoke<PreviewCharacterGenerationPromptsResult>("preview_character_generation_prompts", {
    input: {
      compiledPrompt: input.compiledPrompt,
      draft: input.draft,
      masterPlan: input.masterPlan,
      projectRoot: input.projectRoot,
    },
  });
}
