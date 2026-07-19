import type { CharacterMasterCandidatePlan } from "../../types";
import { CandidateThumbnailGrid } from "./CandidateThumbnailGrid";

interface CreateCandidateStripProps {
  candidatePlans: CharacterMasterCandidatePlan[];
  generatingActiveIndex?: number;
  isGenerating?: boolean;
  onSelectPlan?: (plan: CharacterMasterCandidatePlan) => void;
  planBrief?: string;
  planFocus?: string;
  readOnly?: boolean;
  selectedPlanId?: string;
  skeletonCount?: number;
  stripHint?: string;
}

export function CreateCandidateStrip({
  candidatePlans,
  generatingActiveIndex,
  isGenerating = false,
  onSelectPlan,
  planBrief,
  planFocus,
  readOnly = false,
  selectedPlanId,
  skeletonCount = 0,
  stripHint,
}: CreateCandidateStripProps) {
  return (
    <footer className="create-review-candidate-strip">
      {planFocus || planBrief ? (
        <div className="create-review-plan-brief">
          {planFocus ? <strong>{planFocus}</strong> : null}
          {planBrief ? <p>{planBrief}</p> : null}
        </div>
      ) : null}

      <section aria-label="方案缩略图" className="create-review-candidate-strip-header">
        <strong>方案缩略图</strong>
        <small>{stripHint ?? (readOnly ? "当前入库方案" : "点击切换预览")}</small>
      </section>

      <CandidateThumbnailGrid
        candidatePlans={candidatePlans}
        generatingActiveIndex={generatingActiveIndex}
        isGenerating={isGenerating}
        layout="strip"
        onSelectPlan={readOnly ? () => undefined : onSelectPlan ?? (() => undefined)}
        readOnly={readOnly}
        selectedPlanId={selectedPlanId}
        skeletonCount={skeletonCount}
      />
    </footer>
  );
}
