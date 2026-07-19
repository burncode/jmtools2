import type { CharacterMasterCandidatePlan, CharacterPlanGenerationState } from "../../types";
import { CandidateThumbnailGrid } from "./CandidateThumbnailGrid";

interface CreateCandidateFilmProps {
  generationState: CharacterPlanGenerationState;
  onSelectPlan: (plan: CharacterMasterCandidatePlan) => void;
  selectedPlanId?: string;
}

export function CreateCandidateFilm({ generationState, onSelectPlan, selectedPlanId }: CreateCandidateFilmProps) {
  const isGenerating = generationState.status === "generating";
  const candidatePlans =
    generationState.status === "success" ? generationState.result.plan.candidatePlans : [];
  const skeletonCount =
    generationState.status === "generating" && generationState.candidateTotal
      ? generationState.candidateTotal
      : generationState.status === "generating"
        ? 4
        : 0;

  if (!isGenerating && candidatePlans.length === 0) {
    return (
      <section aria-label="候选方案" className="character-create-candidate-film character-create-candidate-film-empty">
        <header>
          <strong>候选方案</strong>
          <small>生成完成后在此对比选择</small>
        </header>
      </section>
    );
  }

  return (
    <section aria-label="候选方案" className="character-create-candidate-film">
      <header>
        <strong>候选方案（{isGenerating ? skeletonCount : candidatePlans.length}）</strong>
        <small>{isGenerating ? "正在逐张生成..." : "点击切换大图预览"}</small>
      </header>

      <CandidateThumbnailGrid
        candidatePlans={candidatePlans}
        isGenerating={isGenerating}
        onSelectPlan={onSelectPlan}
        selectedPlanId={selectedPlanId}
        skeletonCount={skeletonCount}
      />
    </section>
  );
}
