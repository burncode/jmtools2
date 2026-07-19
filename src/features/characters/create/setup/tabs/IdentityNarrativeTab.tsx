import { Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppTagInput, InspectorField, PanelSection } from "@/components/shared";
import { getAppSettings, optimizeCharacterDescription } from "@/lib/tauri/commands";

import { classOccupationSuggestions, raceSpeciesSuggestions } from "../../../characterFixtures";
import type { CharacterWorkshopDraft } from "../../../types";

interface IdentityNarrativeTabProps {
  draft: CharacterWorkshopDraft;
  onDraftChange: (draft: Partial<CharacterWorkshopDraft>) => void;
}

export function IdentityNarrativeTab({ draft, onDraftChange }: IdentityNarrativeTabProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string>();

  function patchIdentity(field: Partial<CharacterWorkshopDraft["identity"]>) {
    onDraftChange({
      identity: {
        ...draft.identity,
        ...field,
      },
    });
  }

  async function handleOptimizeDescription() {
    if (!draft.description.trim()) {
      setOptimizeError("请先填写角色描述。");
      return;
    }

    setIsOptimizing(true);
    setOptimizeError(undefined);

    try {
      const settings = await getAppSettings();
      const providerId = settings.aiTextProviderId.trim();
      const model = settings.aiTextModel.trim();
      if (!providerId || !model) {
        throw new Error("请先在设置中为「文本生成」绑定服务商和模型。");
      }

      const optimized = await optimizeCharacterDescription({
        classOrOccupation: draft.identity.classOrOccupation,
        description: draft.description,
        entityType: draft.identity.entityType,
        model,
        providerId,
        role: draft.identity.role,
      });

      onDraftChange({ description: optimized.slice(0, 300) });
    } catch (error) {
      setOptimizeError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsOptimizing(false);
    }
  }

  return (
    <div className="character-setup-tab-panel">
      <PanelSection description="名称与叙事是生成母版的核心输入" title="角色身份">
        <label className="field-group">
          <span>角色名称 *</span>
          <div className="field-with-count">
            <Input maxLength={20} onChange={(event) => onDraftChange({ name: event.target.value })} value={draft.name} />
            <small>{draft.name.length} / 20</small>
          </div>
        </label>

        <InspectorField label="种族 / 物种">
          <Input
            list="race-species-suggestions"
            onChange={(event) => patchIdentity({ raceOrSpecies: event.target.value })}
            placeholder="人类、妖兽、魔龙、史莱姆..."
            value={draft.identity.raceOrSpecies}
          />
          <datalist id="race-species-suggestions">
            {raceSpeciesSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </InspectorField>

        <InspectorField label="职业 / 定位">
          <Input
            list="class-occupation-suggestions"
            onChange={(event) => patchIdentity({ classOrOccupation: event.target.value })}
            placeholder="道士、剑修、守门 Boss、杂兵..."
            value={draft.identity.classOrOccupation}
          />
          <datalist id="class-occupation-suggestions">
            {classOccupationSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </InspectorField>

        <div className="field-group">
          <span className="field-label-row">
            <span>角色描述 *</span>
            <Button
              className="inline-ai-action"
              disabled={isOptimizing}
              onClick={() => void handleOptimizeDescription()}
              type="button"
              variant="outline"
            >
              <Sparkles aria-hidden="true" size={13} />
              {isOptimizing ? "优化中..." : "AI 优化"}
            </Button>
          </span>
          <Textarea
            className="character-description-input"
            maxLength={300}
            onChange={(event) => onDraftChange({ description: event.target.value })}
            placeholder="描述角色的外观、气质、装备与用途，例如：清修道士，身着道袍，手持拂尘..."
            value={draft.description}
          />
          <small>{draft.description.length} / 300</small>
          {optimizeError ? <p className="field-error-text">{optimizeError}</p> : null}
        </div>

        <InspectorField label="叙事标签">
          <AppTagInput
            onValueChange={(narrativeTags) => patchIdentity({ narrativeTags })}
            placeholder="修仙、邪修、可对话..."
            value={draft.identity.narrativeTags}
          />
        </InspectorField>
      </PanelSection>
    </div>
  );
}
