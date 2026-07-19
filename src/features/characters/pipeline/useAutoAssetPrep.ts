import type { CharacterAssetRecord } from "@/features/characters/types";
import {
  analyzeCharacter,
  generateActionFrames,
  generateViews,
  normalizeViews,
  postProcessActionFrames,
  removeBackground,
  type GenerateCharacterActionFramesInput,
} from "@/lib/tauri/characterPipeline";
import type { AppSettings } from "@/lib/tauri/commands";
import { getAppSettings } from "@/lib/tauri/commands";
import {
  logProductionError,
  logProductionQc,
  logProductionStep,
} from "@/stores/characterProductionLogStore";

import {
  isAllApplicableViewKindsSelected,
  viewKindToDirectionLabel,
} from "../components/CharacterDirectionGrid";
import {
  findViewByKind,
  getViewReadiness,
  isViewImageReady,
  resolveTargetViewKind,
} from "../components/viewReadiness";

export interface AdvancedPrepSettings {
  generationStrategy?: string;
  mattingColorSpace?: "rgb" | "ycbcr";
  referenceMode?: string;
  referenceStrength?: number;
}

function hasGeneratedViews(record: CharacterAssetRecord) {
  return (record.views ?? []).some((view) => view.rawImage || view.transparentImage || view.normalizedImage);
}

function needsReferencePrep(record: CharacterAssetRecord) {
  if (record.direction === "single") {
    return !record.processing?.backgroundRemoved || !record.processing?.normalized;
  }
  return !hasGeneratedViews(record) || !record.processing?.backgroundRemoved || !record.processing?.normalized;
}

async function loadBackgroundSettings(settings: AppSettings) {
  return {
    alphaMatting: settings.backgroundRemovalAlphaMatting,
    backgroundThreshold: settings.backgroundRemovalBackgroundThreshold,
    cleanupStrength: settings.backgroundRemovalCleanupStrength,
    customModelPath: settings.backgroundRemovalModelPath,
    edgeSoftness: settings.backgroundRemovalEdgeSoftness,
    engine: settings.backgroundRemovalEngine,
    executablePath: settings.backgroundRemovalExecutablePath,
    foregroundThreshold: settings.backgroundRemovalForegroundThreshold,
    holeFillMaxPixels: settings.backgroundRemovalHoleFillMaxPixels,
    model: settings.backgroundRemovalModel,
    preserveSmallParts: settings.backgroundRemovalPreserveSmallParts,
    spillSuppression: settings.backgroundRemovalSpillSuppression,
    tolerance: settings.backgroundRemovalTolerance,
  } as const;
}

async function runMattingAndNormalize(record: CharacterAssetRecord, projectRoot: string, advanced: AdvancedPrepSettings) {
  const settings = await getAppSettings();
  const bg = await loadBackgroundSettings(settings);
  let next = record;

  if (!next.processing?.backgroundRemoved) {
    logProductionStep("正在对参考视图去背景…", "reference");
    next = await removeBackground({
      ...bg,
      characterId: record.id,
      mattingColorSpace: advanced.mattingColorSpace ?? "rgb",
      projectRoot,
    });
    logProductionStep("参考视图去背景完成。", "reference");
  }

  if (!next.processing?.normalized) {
    logProductionStep("正在规范化参考视图…", "reference");
    next = await normalizeViews({
      characterId: record.id,
      projectRoot,
      scaleMode: "fitFootLine",
    });
    logProductionStep("参考视图规范化完成。", "reference");
  }

  try {
    next = await analyzeCharacter({ characterId: record.id, projectRoot });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logProductionError(`参考 QC 预检失败：${message}`, "reference");
  }

  return next;
}

export async function ensureReferenceReady(
  record: CharacterAssetRecord,
  projectRoot: string,
  advanced: AdvancedPrepSettings = {},
): Promise<CharacterAssetRecord> {
  if (!needsReferencePrep(record)) {
    return record;
  }

  let next = record;

  if (record.direction !== "single" && !hasGeneratedViews(next)) {
    logProductionStep("正在生成缺失视图…", "reference");
    next = await generateViews({
      characterId: record.id,
      generationStrategy: advanced.generationStrategy ?? "img2img",
      projectRoot,
      referenceMode: advanced.referenceMode ?? "characterAndPose",
      referenceStrength: advanced.referenceStrength ?? 0.72,
    });
    logProductionStep("视图生成完成。", "reference");
  }

  return runMattingAndNormalize(next, projectRoot, advanced);
}

export async function ensureReferenceReadyForView(
  record: CharacterAssetRecord,
  projectRoot: string,
  viewKindInput: string | undefined,
  advanced: AdvancedPrepSettings = {},
): Promise<CharacterAssetRecord> {
  if (!viewKindInput || viewKindInput === "default") {
    return ensureReferenceReady(record, projectRoot, advanced);
  }

  if (record.direction === "single") {
    return ensureReferenceReady(record, projectRoot, advanced);
  }

  const targetKind = resolveTargetViewKind(viewKindInput as Parameters<typeof resolveTargetViewKind>[0], record.direction);
  const directionLabel = viewKindToDirectionLabel(targetKind);
  const readiness = getViewReadiness(record, targetKind, projectRoot);

  if (readiness === "ready") {
    logProductionStep(`参考视图「${directionLabel}」已就绪。`, "reference");
    if (!record.processing?.backgroundRemoved || !record.processing?.normalized) {
      return runMattingAndNormalize(record, projectRoot, advanced);
    }
    return record;
  }

  if (readiness === "mirrored") {
    logProductionStep(`参考视图「${directionLabel}」将由镜像方向推导。`, "reference");
    if (!record.processing?.backgroundRemoved || !record.processing?.normalized) {
      return runMattingAndNormalize(record, projectRoot, advanced);
    }
    return record;
  }

  let next = record;

  if (!hasGeneratedViews(next)) {
    logProductionStep(`正在生成「${directionLabel}」等缺失参考视图…`, "reference");
    next = await generateViews({
      characterId: record.id,
      generationStrategy: advanced.generationStrategy ?? "img2img",
      projectRoot,
      referenceMode: advanced.referenceMode ?? "characterAndPose",
      referenceStrength: advanced.referenceStrength ?? 0.72,
      views: [targetKind],
    });
  } else if (!isViewImageReady(findViewByKind(next, targetKind), projectRoot)) {
    logProductionStep(`正在生成「${directionLabel}」参考视图…`, "reference");
    next = await generateViews({
      characterId: record.id,
      generationStrategy: advanced.generationStrategy ?? "img2img",
      projectRoot,
      referenceMode: advanced.referenceMode ?? "characterAndPose",
      referenceStrength: advanced.referenceStrength ?? 0.72,
      views: [targetKind],
    });
  }

  logProductionStep(`「${directionLabel}」参考视图生成完成。`, "reference");
  return runMattingAndNormalize(next, projectRoot, advanced);
}

export async function ensureReferenceReadyForViews(
  record: CharacterAssetRecord,
  projectRoot: string,
  viewKinds: string[],
  advanced: AdvancedPrepSettings = {},
): Promise<CharacterAssetRecord> {
  let next = record;
  for (const viewKind of viewKinds) {
    next = await ensureReferenceReadyForView(next, projectRoot, viewKind, advanced);
  }
  return next;
}

export async function generateActionWithFullPrep(
  record: CharacterAssetRecord,
  projectRoot: string,
  input: GenerateCharacterActionFramesInput,
  advanced: AdvancedPrepSettings = {},
): Promise<CharacterAssetRecord> {
  if (input.allViews) {
    let next = await ensureReferenceReady(record, projectRoot, advanced);
    logProductionStep(`正在生成动作帧（${input.generationMode === "perFrame" ? "逐帧" : "Filmstrip"}）…`, "generate");
    logProductionStep("使用全部方向视图参考。", "generate");
    next = await generateActionFrames({ ...input, allViews: true, viewKind: undefined, viewKinds: undefined });
    logProductionStep("动作帧 AI 生成完成。", "generate");
    return finishActionDelivery(next, record, input, advanced);
  }

  const viewKinds =
    input.viewKinds?.filter((kind) => kind && kind !== "default") ??
    (input.viewKind && input.viewKind !== "default" ? [input.viewKind] : []);

  if (viewKinds.length === 0) {
    let next = await ensureReferenceReady(record, projectRoot, advanced);
    logProductionStep(`正在生成动作帧（${input.generationMode === "perFrame" ? "逐帧" : "Filmstrip"}）…`, "generate");
    next = await generateActionFrames({ ...input, allViews: false, viewKind: undefined, viewKinds: undefined });
    logProductionStep("动作帧 AI 生成完成。", "generate");
    return finishActionDelivery(next, record, input, advanced);
  }

  if (isAllApplicableViewKindsSelected(record.direction, viewKinds as Parameters<typeof isAllApplicableViewKindsSelected>[1])) {
    let next = await ensureReferenceReadyForViews(record, projectRoot, viewKinds, advanced);
    logProductionStep(`正在生成动作帧（${input.generationMode === "perFrame" ? "逐帧" : "Filmstrip"}）…`, "generate");
    logProductionStep(`使用 ${viewKinds.length} 个方向视图参考。`, "generate");
    next = await generateActionFrames({ ...input, allViews: true, viewKind: undefined, viewKinds: undefined });
    logProductionStep("动作帧 AI 生成完成。", "generate");
    return finishActionDelivery(next, record, input, advanced);
  }

  let next = await ensureReferenceReadyForViews(record, projectRoot, viewKinds, advanced);
  logProductionStep(`正在生成动作帧（${input.generationMode === "perFrame" ? "逐帧" : "Filmstrip"}）…`, "generate");

  for (const viewKind of viewKinds) {
    const label = viewKindToDirectionLabel(viewKind as Parameters<typeof viewKindToDirectionLabel>[0]);
    logProductionStep(`使用「${label}」视图参考。`, "generate");
    next = await generateActionFrames({
      ...input,
      allViews: false,
      viewKind,
      viewKinds: undefined,
    });
  }

  logProductionStep("动作帧 AI 生成完成。", "generate");
  return finishActionDelivery(next, record, input, advanced);
}

async function finishActionDelivery(
  record: CharacterAssetRecord,
  sourceRecord: CharacterAssetRecord,
  input: GenerateCharacterActionFramesInput,
  advanced: AdvancedPrepSettings,
) {
  let next = record;

  logProductionStep("正在对动作帧抠图与规范化…", "delivery");
  next = await postProcessActionFrames({
    actionIds: input.actionIds,
    characterId: sourceRecord.id,
    mattingColorSpace: advanced.mattingColorSpace ?? "rgb",
    projectRoot: input.projectRoot,
    useMagentaKey: input.generationMode !== "perFrame",
  });
  logProductionStep("动作帧交付准备完成。", "delivery");

  const actionId = input.actionIds?.[0];
  const action = actionId ? next.actions.find((item) => item.id === actionId) : next.actions[0];
  if (action?.qualityScore !== undefined) {
    logProductionQc(
      `${action.label} QC ${action.qualityGrade ?? "unknown"}（${action.qualityScore} 分）` +
        (action.qualityWarnings?.length ? `，警告 ${action.qualityWarnings.length} 条` : ""),
    );
  }

  return next;
}
