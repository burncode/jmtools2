import { convertFileSrc } from "@tauri-apps/api/core";
import { Check, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import type { CharacterMasterCandidatePlan } from "../../types";

interface CandidateThumbnailGridProps {
  candidatePlans: CharacterMasterCandidatePlan[];
  generatingActiveIndex?: number;
  isGenerating: boolean;
  layout?: "grid" | "strip";
  onSelectPlan: (plan: CharacterMasterCandidatePlan) => void;
  readOnly?: boolean;
  selectedPlanId?: string;
  skeletonCount: number;
}

export function CandidateThumbnailGrid({
  candidatePlans,
  generatingActiveIndex,
  isGenerating,
  layout = "grid",
  onSelectPlan,
  readOnly = false,
  selectedPlanId,
  skeletonCount,
}: CandidateThumbnailGridProps) {
  if (isGenerating && candidatePlans.length === 0) {
    return (
      <div className={cn("character-candidate-thumbnail-grid", layout === "strip" && "is-strip")}>
        {Array.from({ length: skeletonCount }, (_, index) => (
          <div className="character-candidate-thumbnail-skeleton" key={`skeleton-${index}`}>
            <LoaderCircle aria-hidden="true" className="character-candidate-thumbnail-spinner" />
            <span>方案 {String.fromCharCode(65 + index)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (isGenerating && candidatePlans.length > 0) {
    return (
      <div className={cn("character-candidate-thumbnail-grid", layout === "strip" && "is-strip")}>
        {candidatePlans.map((plan, index) => {
          const isActive = generatingActiveIndex !== undefined && index === generatingActiveIndex;
          const isDone = generatingActiveIndex !== undefined && index < generatingActiveIndex;

          return (
            <div
              className={cn(
                "character-candidate-thumbnail-tile character-candidate-thumbnail-tile-generating",
                isActive && "character-candidate-thumbnail-tile-selected",
                isDone && "character-candidate-thumbnail-tile-done",
              )}
              key={plan.id}
            >
              <div className="character-candidate-thumbnail-preview">
                {isActive ? (
                  <LoaderCircle aria-hidden="true" className="character-candidate-thumbnail-spinner" />
                ) : isDone ? (
                  <Check aria-hidden="true" className="character-candidate-thumbnail-check" />
                ) : (
                  <span className="character-candidate-thumbnail-empty">排队中</span>
                )}
                {isActive ? <span className="character-candidate-thumbnail-badge">生成中</span> : null}
              </div>
              <footer className="character-candidate-thumbnail-meta">
                <strong>{plan.name}</strong>
                <small>{plan.recommendationScore ?? 90 - index * 4}%</small>
              </footer>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("character-candidate-thumbnail-grid", layout === "strip" && "is-strip")}>
      {candidatePlans.map((plan, index) => {
        const previewUrl = getImagePreviewUrl(plan.masterImage);
        const selected = plan.id === selectedPlanId;

        return (
          <button
            className={cn(
              "character-candidate-thumbnail-tile",
              selected && "character-candidate-thumbnail-tile-selected",
              readOnly && "character-candidate-thumbnail-tile-readonly",
            )}
            disabled={readOnly}
            key={plan.id}
            onClick={() => onSelectPlan(plan)}
            type="button"
          >
            <div className="character-candidate-thumbnail-preview">
              {previewUrl ? (
                <img alt="" src={previewUrl} />
              ) : (
                <span className="character-candidate-thumbnail-empty">未生成</span>
              )}
              {selected ? <Check aria-hidden="true" className="character-candidate-thumbnail-check" /> : null}
              {selected ? (
                <span className="character-candidate-thumbnail-badge">当前方案</span>
              ) : index === 0 ? (
                <span className="character-candidate-thumbnail-badge">推荐</span>
              ) : null}
            </div>
            <footer className="character-candidate-thumbnail-meta">
              <strong>{plan.name}</strong>
              <small>{plan.recommendationScore ?? 90 - index * 4}%</small>
            </footer>
          </button>
        );
      })}
    </div>
  );
}

function getImagePreviewUrl(image: CharacterMasterCandidatePlan["masterImage"]) {
  if (image?.dataUrl) {
    return image.dataUrl;
  }

  if (!image?.absolutePath) {
    return "";
  }

  return convertFileSrc(image.absolutePath);
}
