import { cn } from "@/lib/utils";

import type { WorkflowPreviewAssets } from "../workflowPreviewAssets";
import { resolveCandidatePlanId } from "../workflowPreviewAssets";
import { resolvePreviewImageSrc } from "../workflowPreviewPath";

interface WorkflowCandidatePlanPickerProps {
  assets: WorkflowPreviewAssets;
  compact?: boolean;
  description?: string;
  onSelect?: (planId: string) => void;
  projectRoot: string;
  readOnly?: boolean;
  selectedPlanId: string;
  showAutoRecommend?: boolean;
  title?: string;
}

export function WorkflowCandidatePlanPicker({
  assets,
  compact = false,
  description,
  onSelect,
  projectRoot,
  readOnly = false,
  selectedPlanId,
  showAutoRecommend = true,
  title = "选择入库候选图",
}: WorkflowCandidatePlanPickerProps) {
  if (assets.kind === "empty" || assets.images.length === 0) {
    return null;
  }

  const normalizedSelected = selectedPlanId.trim();

  return (
    <div className={cn("workflow-candidate-plan-picker", compact && "is-compact")}>
      <p className="workflow-candidate-plan-picker-title">{title}</p>
      {description ? <p className="workflow-candidate-plan-picker-description">{description}</p> : null}
      <div className="workflow-candidate-plan-picker-grid">
        {!readOnly && showAutoRecommend ? (
          <button
            className={cn("workflow-candidate-plan-picker-item", !normalizedSelected && "is-active")}
            onClick={() => onSelect?.("")}
            type="button"
          >
            <span className="workflow-candidate-plan-picker-auto">自动推荐</span>
            <small>按推荐分选择 1 个方案</small>
          </button>
        ) : null}
        {assets.images.map((image, index) => {
          const planId = resolveCandidatePlanId(image, index);
          const src = resolvePreviewImageSrc(projectRoot, image);
          const isActive = normalizedSelected === planId;

          return (
            <button
              className={cn("workflow-candidate-plan-picker-item", isActive && "is-active")}
              disabled={readOnly}
              key={planId}
              onClick={() => onSelect?.(planId)}
              type="button"
            >
              {src ? <img alt="" className="workflow-candidate-plan-picker-image" src={src} /> : null}
              <span>{image.label ?? `方案 ${index + 1}`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
