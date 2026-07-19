import { entityTypeLabels, roleLabels } from "../../archetypes/defaults";
import type { CharacterMasterCandidatePlan, CharacterWorkshopDraft } from "../../types";

interface CreateArchiveMetaSectionProps {
  draft: CharacterWorkshopDraft;
  selectedPlan: CharacterMasterCandidatePlan;
}

function resolveSizeLabel(draft: CharacterWorkshopDraft) {
  if (draft.size === "自定义") {
    return `${draft.customWidth}×${draft.customHeight}`;
  }

  return draft.size;
}

export function CreateArchiveMetaSection({ draft, selectedPlan }: CreateArchiveMetaSectionProps) {
  const entityLabel = entityTypeLabels[draft.identity.entityType];
  const roleLabel = roleLabels[draft.identity.role];
  const createdAt = new Date().toLocaleString("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });

  const rows = [
    { label: "方案", value: selectedPlan.name },
    { label: "类型", value: `${entityLabel} · ${roleLabel}` },
    { label: "风格", value: draft.style || "未设定" },
    { label: "适用场景", value: selectedPlan.focus || "通用" },
    { label: "创建时间", value: createdAt },
    { label: "分辨率", value: resolveSizeLabel(draft) },
    { label: "格式", value: "PNG" },
  ];

  return (
    <section aria-label="资源详情摘要" className="create-archive-meta">
      {rows.map((row) => (
        <div className="create-archive-meta-row" key={row.label}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </section>
  );
}
