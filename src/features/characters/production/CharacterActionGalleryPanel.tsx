import { Badge } from "@/components/ui/badge";

import type { CharacterActionTrack, CharacterAssetRecord } from "../types";

interface CharacterActionGalleryPanelProps {
  onSelectAction?: (actionId: string) => void;
  record: CharacterAssetRecord;
}

function getQualityVariant(score?: number): "default" | "secondary" | "destructive" | "outline" {
  if (score === undefined) {
    return "outline";
  }
  if (score >= 85) {
    return "secondary";
  }
  if (score >= 70) {
    return "default";
  }
  return "destructive";
}

function ActionGalleryRow({
  action,
  onSelect,
}: {
  action: CharacterActionTrack;
  onSelect?: (actionId: string) => void;
}) {
  return (
    <button
      className="character-action-gallery-row"
      onClick={() => onSelect?.(action.id)}
      type="button"
    >
      <span className="character-action-gallery-row-label">{action.label}</span>
      <span className="character-action-gallery-row-meta">
        {action.frames?.length ? `${action.frames.length} 帧` : "未生成"}
        {action.qualityGrade ? ` · ${action.qualityGrade}` : ""}
      </span>
      <Badge variant={getQualityVariant(action.qualityScore)}>
        {action.qualityScore !== undefined ? `${action.qualityScore} 分` : "待 QC"}
      </Badge>
    </button>
  );
}

export function CharacterActionGalleryPanel({ onSelectAction, record }: CharacterActionGalleryPanelProps) {
  const actions = record.actions ?? [];

  if (actions.length === 0) {
    return <p className="character-action-gallery-empty">暂无动作轨道，请先在「动作」Tab 生成。</p>;
  }

  return (
    <section aria-label="动作 QC 会话" className="character-action-gallery">
      <header>
        <strong>动作 QC 会话</strong>
        <span>{actions.length} 条轨道</span>
      </header>
      <div className="character-action-gallery-list" role="list">
        {actions.map((action) => (
          <ActionGalleryRow action={action} key={action.id} onSelect={onSelectAction} />
        ))}
      </div>
    </section>
  );
}
