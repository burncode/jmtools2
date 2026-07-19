import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createCharacterAsset } from "@/lib/tauri/commands";
import { appLogger } from "@/lib/logger";

import type {
  CharacterAssetRecord,
  CharacterMasterCandidatePlan,
  CharacterMasterPlanGenerationResult,
  CharacterWorkshopDraft,
} from "../../types";

interface ConfirmStepProps {
  creationError?: string;
  draft: CharacterWorkshopDraft;
  generationState: { result: CharacterMasterPlanGenerationResult; status: "success" };
  isCreatingCharacter: boolean;
  onCreated: (record: CharacterAssetRecord) => void;
  onError: (message: string | undefined) => void;
  onSubmitting: (value: boolean) => void;
  projectRoot: string;
  selectedPlan: CharacterMasterCandidatePlan;
  setCharacterImageStatus: (message: string) => void;
}

export function ConfirmStep({
  creationError,
  draft,
  generationState,
  isCreatingCharacter,
  onCreated,
  onError,
  onSubmitting,
  projectRoot,
  selectedPlan,
  setCharacterImageStatus,
}: ConfirmStepProps) {
  const [description, setDescription] = useState(draft.description);
  const [tags, setTags] = useState(draft.featureTags.join(", "));

  async function handleCreate() {
    onSubmitting(true);
    onError(undefined);
    setCharacterImageStatus("正在写入角色库...");

    try {
      const record = await createCharacterAsset({
        draft: { ...draft, description: description.trim() || draft.description },
        masterPlan: {
          ...generationState.result.plan,
          visualKeywords: Array.from(
            new Set([
              ...generationState.result.plan.visualKeywords,
              ...tags.split(/[,，]/).map((tag: string) => tag.trim()).filter(Boolean),
            ]),
          ).slice(0, 12),
        },
        model: generationState.result.model,
        projectRoot,
        providerName: generationState.result.providerName,
        selectedPlan,
        taskId: generationState.result.taskId,
      });
      onCreated(record);
      await appLogger.info(`角色入库完成：id=${record.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onError(message);
      setCharacterImageStatus("");
      await appLogger.error("角色入库失败", {
        errorMessage: message,
        scope: "character.create.archive",
      });
    } finally {
      onSubmitting(false);
    }
  }

  return (
    <section className="character-wizard-panel character-wizard-confirm">
      <h3>确认入库</h3>
      <p>方案：{selectedPlan.name} · {selectedPlan.focus}</p>
      <label className="character-wizard-field">
        <span>描述</span>
        <textarea onChange={(event) => setDescription(event.target.value)} rows={4} value={description} />
      </label>
      <label className="character-wizard-field">
        <span>标签（逗号分隔）</span>
        <input onChange={(event) => setTags(event.target.value)} value={tags} />
      </label>
      {creationError ? <p className="character-tool-message">{creationError}</p> : null}
      <Button className="primary-action" disabled={isCreatingCharacter} onClick={() => void handleCreate()} type="button">
        {isCreatingCharacter ? "入库中..." : "创建角色卡"}
      </Button>
    </section>
  );
}
