import { PanelSection } from "@/components/shared";

import type { CharacterWorkshopDraft } from "../../../types";
import { AdaptiveTraitEditor } from "../components/AdaptiveTraitEditor";
import { OptionalResourcePicker } from "../components/OptionalResourcePicker";

interface AppearanceTraitsTabProps {
  draft: CharacterWorkshopDraft;
  onDraftChange: (draft: Partial<CharacterWorkshopDraft>) => void;
}

export function AppearanceTraitsTab({ draft, onDraftChange }: AppearanceTraitsTabProps) {
  return (
    <div className="character-setup-tab-panel">
      <PanelSection
        description="用特征 chips 描述外观，不再强制固定装备槽。道士、Boss、史莱姆均可自由组合。"
        title="外观特征"
      >
        <AdaptiveTraitEditor draft={draft} entityType={draft.identity.entityType} onDraftChange={onDraftChange} />
        <OptionalResourcePicker draft={draft} entityType={draft.identity.entityType} onDraftChange={onDraftChange} />
      </PanelSection>
    </div>
  );
}
