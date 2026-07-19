import { Sparkles } from "lucide-react";

import { CanvasPanel } from "@/components/shared/CanvasPanel";
import { EmptyState } from "@/components/shared/EmptyState";

import { entityTypeLabels, roleLabels } from "../../archetypes/defaults";
import type { CharacterWorkshopDraft } from "../../types";
import { CreatePreviewStage } from "./studio/CreatePreviewStage";

interface CreateIdlePreviewProps {
  draft: CharacterWorkshopDraft;
  message?: string;
}

export function CreateIdlePreview({
  draft,
  message = "调整左侧设定后点击「生成母版」，进度将显示在预览画布中。",
}: CreateIdlePreviewProps) {
  const sizeLabel = draft.size === "自定义" ? `${draft.customWidth}×${draft.customHeight}` : draft.size;
  const directionLabel =
    draft.direction === "eight" ? "八方向" : draft.direction === "four" ? "四方向" : "单视图";
  const entityLabel = entityTypeLabels[draft.identity.entityType];
  const roleLabel = roleLabels[draft.identity.role];

  return (
    <div aria-label="创建预览占位" className="character-create-idle-preview">
      <CanvasPanel label="方案预览" title="方案预览">
        <CreatePreviewStage>
          <EmptyState description={message} icon={Sparkles} title="等待生成母版">
            <div className="character-create-idle-summary">
              {draft.palette.length > 0 ? (
                <div aria-label="色板预览" className="character-create-idle-palette">
                  {draft.palette.map((color, index) => (
                    <span key={`${color}-${index}`} style={{ backgroundColor: color }} title={color} />
                  ))}
                </div>
              ) : null}
              <p className="character-create-idle-spec">
                {entityLabel} · {roleLabel} · {sizeLabel} · {directionLabel}
              </p>
            </div>
          </EmptyState>
        </CreatePreviewStage>
      </CanvasPanel>
    </div>
  );
}
