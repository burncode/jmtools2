import { useMemo } from "react";

import { InspectorPanel } from "@/components/shared/InspectorPanel";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { CharacterWorkshopDraft, CreateSetupSection } from "../../types";
import { validateCreateDraft } from "../validation/validateCreateDraft";
import { CharacterConfigPanel } from "./CharacterConfigPanel";
import { SetupProgressSidebar } from "./SetupProgressSidebar";

interface ConceptSetupStepProps {
  draft: CharacterWorkshopDraft;
  focusSection?: CreateSetupSection | null;
  layout?: "studio" | "wizard";
  onClearFocusSection?: () => void;
  onDraftChange: (draft: Partial<CharacterWorkshopDraft>) => void;
  projectRoot: string;
}

const mainSetupSections: CreateSetupSection[] = ["preset", "concept", "output", "advanced"];

export function ConceptSetupStep({
  draft,
  focusSection,
  layout = "wizard",
  onClearFocusSection,
  onDraftChange,
  projectRoot,
}: ConceptSetupStepProps) {
  const validation = useMemo(() => validateCreateDraft(draft), [draft]);
  const isStudio = layout === "studio";
  const completeCount = mainSetupSections.filter((section) => validation.sectionStatuses[section] === "complete").length;

  const panel = (
    <CharacterConfigPanel
      draft={draft}
      focusSection={focusSection}
      onClearFocusSection={onClearFocusSection}
      onDraftChange={onDraftChange}
      projectRoot={projectRoot}
      validation={validation}
    />
  );

  if (isStudio) {
    return (
      <InspectorPanel
        className="character-concept-setup-inspector"
        description={`${completeCount}/4 完成`}
        label="角色设定"
        title="角色设定"
      >
        <ScrollArea className="character-create-setup-tab-scroll app-scroll-ghost">
          <div className="character-setup-tab-panel character-config-panel-scroll">{panel}</div>
        </ScrollArea>
      </InspectorPanel>
    );
  }

  return (
    <section aria-label="角色设定" className="character-concept-setup-step">
      <header className="character-panel-title character-settings-title">
        <div>
          <p className="panel-label">概念 · 角色设定</p>
          <h3>自上而下完成设定后再进入方案确认</h3>
        </div>
      </header>

      <div className="character-concept-setup-layout">
        {panel}
        <SetupProgressSidebar draft={draft} validation={validation} />
      </div>
    </section>
  );
}

export { validateCreateDraft };
