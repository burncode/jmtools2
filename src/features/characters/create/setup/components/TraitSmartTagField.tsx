import { AppTagInput } from "@/components/shared";

import type { CharacterWorkshopDraft } from "../../../types";
import { TraitQuickChip } from "../../components/studio/TraitQuickChip";
import { traitQuickChipsByEntityType } from "./traitQuickChips";
import { addTraitTag, applyTraitTagsChange } from "../utils/syncTraitTags";

interface TraitSmartTagFieldProps {
  draft: CharacterWorkshopDraft;
  onDraftChange: (patch: Partial<CharacterWorkshopDraft>) => void;
}

export function TraitSmartTagField({ draft, onDraftChange }: TraitSmartTagFieldProps) {
  const quickChips = traitQuickChipsByEntityType[draft.identity.entityType];

  function handleTagsChange(tags: string[]) {
    onDraftChange(applyTraitTagsChange(draft, tags));
  }

  function handleQuickChip(label: string) {
    const patch = addTraitTag(draft, label);
    if (patch) {
      onDraftChange(patch);
    }
  }

  return (
    <div className="character-config-trait-field">
      <div className="character-config-trait-chips">
        {quickChips.map((chip) => (
          <TraitQuickChip
            key={`${chip.category}-${chip.label}`}
            label={chip.label}
            onClick={() => handleQuickChip(chip.label)}
          />
        ))}
      </div>
      <AppTagInput
        maxTags={16}
        onValueChange={handleTagsChange}
        placeholder="输入特征后按 Enter，如：道袍、长剑…"
        showAddButton={false}
        value={draft.featureTags}
      />
    </div>
  );
}
