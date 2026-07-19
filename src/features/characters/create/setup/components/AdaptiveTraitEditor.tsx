import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect, InspectorField } from "@/components/shared";

import { appearanceTraitCategoryLabels } from "../../../characterFixtures";
import type { AppearanceTrait, AppearanceTraitCategory, CharacterEntityType, CharacterWorkshopDraft } from "../../../types";
import { TraitQuickChip } from "../../components/studio/TraitQuickChip";
import { createAppearanceTrait, traitQuickChipsByEntityType } from "./traitQuickChips";

interface AdaptiveTraitEditorProps {
  draft: CharacterWorkshopDraft;
  entityType: CharacterEntityType;
  onDraftChange: (draft: Partial<CharacterWorkshopDraft>) => void;
}

const categoryOptions = Object.entries(appearanceTraitCategoryLabels).map(([value, label]) => ({
  label,
  value,
}));

export function AdaptiveTraitEditor({ draft, entityType, onDraftChange }: AdaptiveTraitEditorProps) {
  const [draftCategory, setDraftCategory] = useState<AppearanceTraitCategory>("costume");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const quickChips = traitQuickChipsByEntityType[entityType];

  function addTrait(trait: AppearanceTrait) {
    onDraftChange({
      appearanceTraits: [...draft.appearanceTraits.filter((item) => item.id !== trait.id), trait].slice(0, 24),
      featureTags: Array.from(new Set([...draft.featureTags, trait.label])).slice(0, 16),
    });
  }

  function removeTrait(id: string) {
    onDraftChange({
      appearanceTraits: draft.appearanceTraits.filter((item) => item.id !== id),
    });
  }

  function handleAddCustomTrait() {
    const label = draftLabel.trim();
    if (!label) {
      return;
    }

    addTrait(
      createAppearanceTrait({
        category: draftCategory,
        label,
        prompt: draftPrompt.trim() || undefined,
      }),
    );
    setDraftLabel("");
    setDraftPrompt("");
  }

  return (
    <div className="character-trait-editor">
      <section className="character-concept-section">
        <header>
          <strong>快捷特征</strong>
          <span>{entityType}</span>
        </header>
        <div className="character-concept-tag-row">
          {quickChips.map((chip) => (
            <TraitQuickChip
              key={`${chip.category}-${chip.label}`}
              label={chip.label}
              onClick={() =>
                addTrait(
                  createAppearanceTrait({
                    category: chip.category,
                    label: chip.label,
                    prompt: chip.prompt,
                  }),
                )
              }
            />
          ))}
        </div>
      </section>

      <section className="character-concept-section">
        <header>
          <strong>特征列表</strong>
          <span>{draft.appearanceTraits.length} 项</span>
        </header>
        {draft.appearanceTraits.length === 0 ? (
          <p className="character-setup-hint">添加外观特征可让生成更稳定；也可仅依赖详细描述。</p>
        ) : (
          <div className="character-trait-list">
            {draft.appearanceTraits.map((trait) => (
              <article className="character-trait-item" key={trait.id}>
                <div className="character-trait-item-head">
                  <Badge variant="secondary">{appearanceTraitCategoryLabels[trait.category]}</Badge>
                  <strong>{trait.label}</strong>
                  <Button aria-label={`移除 ${trait.label}`} onClick={() => removeTrait(trait.id)} size="icon-sm" type="button" variant="ghost">
                    <Trash2 aria-hidden="true" size={14} />
                  </Button>
                </div>
                <p>{trait.prompt}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="character-concept-section">
        <header>
          <strong>自定义特征</strong>
        </header>
        <div className="character-trait-form">
          <InspectorField label="类别">
            <AppSelect
              ariaLabel="特征类别"
              onValueChange={(value) => setDraftCategory(value as AppearanceTraitCategory)}
              options={categoryOptions}
              value={draftCategory}
            />
          </InspectorField>
          <InspectorField label="名称">
            <Input onChange={(event) => setDraftLabel(event.target.value)} placeholder="例如：道袍、岩甲、光晕" value={draftLabel} />
          </InspectorField>
          <InspectorField label="Prompt 片段">
            <Input
              onChange={(event) => setDraftPrompt(event.target.value)}
              placeholder="英文或双语描述，用于编译 Prompt"
              value={draftPrompt}
            />
          </InspectorField>
          <Button
            className="app-trait-add-button"
            disabled={!draftLabel.trim()}
            onClick={handleAddCustomTrait}
            type="button"
            variant="outline"
          >
            <Plus aria-hidden="true" />
            添加特征
          </Button>
        </div>
      </section>
    </div>
  );
}
