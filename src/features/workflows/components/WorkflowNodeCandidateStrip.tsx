import { cn } from "@/lib/utils";

import type { WorkflowPreviewAssets } from "../workflowPreviewAssets";
import { resolveCandidatePlanId } from "../workflowPreviewAssets";
import { resolvePreviewImageSrc } from "../workflowPreviewPath";

interface WorkflowNodeCandidateStripProps {
  assets: WorkflowPreviewAssets;
  onSelect: (planId: string) => void;
  projectRoot: string;
  selectedPlanId: string;
}

export function WorkflowNodeCandidateStrip({
  assets,
  onSelect,
  projectRoot,
  selectedPlanId,
}: WorkflowNodeCandidateStripProps) {
  if (assets.kind === "empty" || assets.images.length === 0) {
    return null;
  }

  const normalizedSelected = selectedPlanId.trim();

  return (
    <div className="workflow-node-candidate-strip">
      <p className="workflow-node-candidate-strip-title">选择入库方案</p>
      <div className="workflow-node-candidate-strip-items">
        <button
          className={cn("workflow-node-candidate-strip-item", !normalizedSelected && "is-active")}
          onClick={() => onSelect("")}
          title="按推荐分自动选择"
          type="button"
        >
          自动
        </button>
        {assets.images.map((image, index) => {
          const planId = resolveCandidatePlanId(image, index);
          const src = resolvePreviewImageSrc(projectRoot, image);
          const isActive = normalizedSelected === planId;

          return (
            <button
              className={cn("workflow-node-candidate-strip-item", isActive && "is-active")}
              key={planId}
              onClick={() => onSelect(planId)}
              title={image.label ?? `方案 ${index + 1}`}
              type="button"
            >
              {src ? <img alt="" src={src} /> : <span>{index + 1}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
