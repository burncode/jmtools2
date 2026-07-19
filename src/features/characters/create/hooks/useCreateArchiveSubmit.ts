import { useState } from "react";

import { createCharacterAsset } from "@/lib/tauri/commands";
import { runPostProcessSegment } from "@/lib/tauri/characterPipeline";
import { appLogger } from "@/lib/logger";

import type {
  CharacterAssetRecord,
  CharacterMasterCandidatePlan,
  CharacterMasterPlanGenerationResult,
  CharacterWorkshopDraft,
} from "../../types";
import type {
  CreateArchivePostProcessParams,
  CreateArchivePostProcessState,
} from "../types/createArchiveTypes";
import { hasEnabledPostProcess } from "../types/createArchiveTypes";

interface UseCreateArchiveSubmitInput {
  draft: CharacterWorkshopDraft;
  generationState: { result: CharacterMasterPlanGenerationResult; status: "success" };
  onComplete: (record: CharacterAssetRecord) => void;
  onError: (message: string | undefined) => void;
  postProcessPreviewReady: boolean;
  postProcessState: CreateArchivePostProcessState;
  projectRoot: string;
  selectedPlan: CharacterMasterCandidatePlan;
  setCharacterImageStatus: (message: string) => void;
}

function buildRemoveBackgroundInput(params: CreateArchivePostProcessParams["removeBackground"]) {
  return {
    alphaMatting: params.alphaMatting,
    backgroundThreshold: params.backgroundThreshold,
    cleanupStrength: params.cleanupStrength,
    customModelPath: params.customModelPath,
    edgeSoftness: params.edgeSoftness,
    engine: params.engine,
    executablePath: params.executablePath,
    foregroundThreshold: params.foregroundThreshold,
    holeFillMaxPixels: params.holeFillMaxPixels,
    mattingColorSpace: params.mattingColorSpace,
    model: params.model,
    preserveSmallParts: params.preserveSmallParts,
    spillSuppression: params.spillSuppression,
    tolerance: params.tolerance,
  };
}

export function useCreateArchiveSubmit({
  draft,
  generationState,
  onComplete,
  onError,
  postProcessPreviewReady,
  postProcessState,
  projectRoot,
  selectedPlan,
  setCharacterImageStatus,
}: UseCreateArchiveSubmitInput) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitArchive(input: {
    description: string;
    displayName: string;
    tags: string[];
  }) {
    const { options, params } = postProcessState;

    if (hasEnabledPostProcess(options) && !postProcessPreviewReady) {
      onError("请先预览后处理结果，确认满意后再入库。");
      return;
    }

    onError(undefined);
    setIsSubmitting(true);
    setCharacterImageStatus("正在写入角色库...");

    try {
      const record = await createCharacterAsset({
        draft: {
          ...draft,
          description: input.description.trim() || draft.description,
          name: input.displayName.trim() || draft.name,
        },
        masterPlan: {
          ...generationState.result.plan,
          visualKeywords: Array.from(
            new Set([...generationState.result.plan.visualKeywords, ...input.tags]),
          ).slice(0, 12),
        },
        model: generationState.result.model,
        projectRoot,
        providerName: generationState.result.providerName,
        selectedPlan,
        taskId: generationState.result.taskId,
      });

      if (hasEnabledPostProcess(options)) {
        setCharacterImageStatus("正在执行快捷后处理...");
        await runPostProcessSegment(
          projectRoot,
          record.id,
          options,
          options.runRemoveBackground
            ? buildRemoveBackgroundInput(params.removeBackground)
            : undefined,
          {
            analyze: params.analyze,
            normalize: params.normalize,
          },
        );
      }

      setCharacterImageStatus("角色已入库。");
      onComplete(record);
      await appLogger.info(`角色入库完成：id=${record.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onError(message);
      setCharacterImageStatus("");
      await appLogger.error("角色入库失败", {
        errorMessage: message,
        scope: "character.create.archive",
        taskId: generationState.result.taskId,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    isSubmitting,
    submitArchive,
  };
}
