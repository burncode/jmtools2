import type { PostProcessPreviewImages } from "../types/createArchiveTypes";
import { CreateGeneratingCanvas } from "./CreateGeneratingCanvas";
import { CreateIdlePreview } from "./CreateIdlePreview";
import { CreateReviewCanvas } from "./CreateReviewCanvas";
import type { CharacterMasterCandidatePlan, CharacterPlanGenerationState, CharacterWorkshopDraft } from "../../types";
import type { CreatePhase } from "../../stores/characterWorkshopStore";

interface CreateCenterPanelProps {
  candidatePlans: CharacterMasterCandidatePlan[];
  createPhase: CreatePhase;
  draft: CharacterWorkshopDraft;
  generationState: CharacterPlanGenerationState;
  idleMessage?: string;
  imageSourceMode: "original" | "processed";
  isPlanSelectionLocked?: boolean;
  onImageSourceModeChange: (mode: "original" | "processed") => void;
  onSelectPlan: (plan: CharacterMasterCandidatePlan) => void;
  planSummary?: string;
  previewImages?: PostProcessPreviewImages;
  selectedPlan?: CharacterMasterCandidatePlan;
}

export function CreateCenterPanel({
  candidatePlans,
  createPhase,
  draft,
  generationState,
  idleMessage,
  imageSourceMode,
  isPlanSelectionLocked = false,
  onImageSourceModeChange,
  onSelectPlan,
  planSummary,
  previewImages,
  selectedPlan,
}: CreateCenterPanelProps) {
  if (createPhase === "generating" && generationState.status === "generating") {
    const pendingPlans =
      generationState.pendingPlan?.candidatePlans ??
      [];
    const skeletonCount = Number.parseInt(draft.generationCount, 10) || pendingPlans.length || 2;

    return (
      <CreateGeneratingCanvas
        candidateIndex={generationState.candidateIndex}
        candidatePlans={pendingPlans}
        candidateTotal={generationState.candidateTotal ?? skeletonCount}
        message={generationState.message}
        phase={generationState.phase}
        skeletonCount={skeletonCount}
        startedAt={generationState.startedAt}
      />
    );
  }

  if (
    (createPhase === "review" || createPhase === "finalize") &&
    generationState.status === "success" &&
    selectedPlan
  ) {
    return (
      <CreateReviewCanvas
        candidatePlans={candidatePlans}
        createPhase={createPhase}
        draft={draft}
        imageSourceMode={imageSourceMode}
        isPlanSelectionLocked={isPlanSelectionLocked}
        onImageSourceModeChange={onImageSourceModeChange}
        onSelectPlan={onSelectPlan}
        planSummary={planSummary}
        previewImages={previewImages}
        selectedPlan={selectedPlan}
      />
    );
  }

  return (
    <div className="create-studio-center create-studio-center-idle">
      <CreateIdlePreview draft={draft} message={idleMessage} />
    </div>
  );
}
