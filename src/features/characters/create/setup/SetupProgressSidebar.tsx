import { Badge } from "@/components/ui/badge";

import { entityTypeLabels, roleLabels } from "../../archetypes/defaults";
import type { CreateDraftValidationResult } from "../validation/validateCreateDraft";
import type { CharacterWorkshopDraft, CreateSetupSection } from "../../types";
import { DraftVisualPreview } from "../components/DraftVisualPreview";

interface SetupProgressSidebarProps {
  draft: CharacterWorkshopDraft;
  validation: CreateDraftValidationResult;
}

const progressSections: Array<[CreateSetupSection, string]> = [
  ["preset", "起始预设"],
  ["concept", "概念与特征"],
  ["output", "产出规格"],
  ["advanced", "高级生成选项"],
];

export function SetupProgressSidebar({ draft, validation }: SetupProgressSidebarProps) {
  const completedCount = progressSections.filter(([section]) => validation.sectionStatuses[section] === "complete").length;

  return (
    <aside aria-label="设定进度" className="character-setup-progress-sidebar">
      <header>
        <strong>设定进度</strong>
        <Badge variant="secondary">{completedCount}/4</Badge>
      </header>

      <DraftVisualPreview compact draft={draft} />

      <ul className="character-setup-progress-list">
        {progressSections.map(([section, label]) => (
          <li data-status={validation.sectionStatuses[section]} key={section}>
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <div className="character-setup-progress-summary">
        <strong>{draft.name.trim() || "未命名角色"}</strong>
        <p>
          {entityTypeLabels[draft.identity.entityType]} · {roleLabels[draft.identity.role]}
        </p>
        <p>{draft.featureTags.length} 个特征标签</p>
      </div>

      {validation.warningIssues.length > 0 ? (
        <div className="character-setup-progress-warnings">
          {validation.warningIssues.slice(0, 3).map((issue) => (
            <p key={issue.field}>{issue.message}</p>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
