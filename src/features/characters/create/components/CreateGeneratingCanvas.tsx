import { CanvasPanel } from "@/components/shared";

import { GenerationProgressOverlay } from "../../components/GenerationProgressOverlay";
import type { CharacterMasterCandidatePlan, CharacterPlanGenerationPhase } from "../../types";
import { CreateCandidateStrip } from "./CreateCandidateStrip";

interface CreateGeneratingCanvasProps {
  candidateIndex?: number;
  candidatePlans: CharacterMasterCandidatePlan[];
  candidateTotal?: number;
  message?: string;
  phase: CharacterPlanGenerationPhase;
  skeletonCount: number;
  startedAt: number;
}

export function CreateGeneratingCanvas({
  candidateIndex,
  candidatePlans,
  candidateTotal,
  message,
  phase,
  skeletonCount,
  startedAt,
}: CreateGeneratingCanvasProps) {
  const activePlanId =
    candidatePlans.length > 0 && candidateIndex !== undefined && candidateIndex > 0
      ? candidatePlans[Math.min(candidateIndex - 1, candidatePlans.length - 1)]?.id
      : candidatePlans[0]?.id;

  return (
    <div className="create-studio-center create-studio-center-generating subpixel-antialiased">
      <CanvasPanel
        className="create-generating-canvas-panel"
        footer={
          <CreateCandidateStrip
            candidatePlans={candidatePlans}
            generatingActiveIndex={
              phase === "candidates" && candidateIndex !== undefined
                ? Math.min(candidateIndex, Math.max(candidatePlans.length - 1, 0))
                : undefined
            }
            isGenerating
            readOnly
            selectedPlanId={activePlanId}
            skeletonCount={skeletonCount}
            stripHint={
              phase === "plan"
                ? "正在编译母版方案，候选位已预留"
                : `正在生成候选图 ${candidateIndex ?? 0}/${candidateTotal ?? (candidatePlans.length || skeletonCount)}`
            }
          />
        }
        label="方案预览"
        title="生成中"
      >
        <div className="create-generating-canvas-stage create-generating-breathe-bg">
          <div aria-hidden="true" className="create-generating-breathe-orbit">
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="create-generating-progress-overlay">
            <GenerationProgressOverlay
              candidateIndex={candidateIndex}
              candidateTotal={candidateTotal}
              message={message}
              phase={phase}
              startedAt={startedAt}
            />
          </div>
        </div>
      </CanvasPanel>
    </div>
  );
}
