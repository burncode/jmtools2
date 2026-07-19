import type { CreatePhase } from "../../stores/characterWorkshopStore";
import type {
  CharacterAssetRecord,
  CharacterMasterCandidatePlan,
  CharacterPlanGenerationState,
  CharacterWorkshopDraft,
  CreateSetupSection,
} from "../../types";
import type {
  CreateArchivePostProcessState,
  PostProcessPreviewResult,
} from "../types/createArchiveTypes";
import { CreateArchivePanel } from "./CreateArchivePanel";
import { PromptPreviewPanel } from "./PromptPreviewPanel";

interface CreateAssistSidebarProps {
  analyzeReport?: PostProcessPreviewResult["analyzeReport"];
  createPhase: CreatePhase;
  creationError?: string;
  draft: CharacterWorkshopDraft;
  generationState: CharacterPlanGenerationState;
  isCreatingCharacter: boolean;
  isPreviewingPostProcess: boolean;
  onCancelFinalize: () => void;
  onCreated: (record: CharacterAssetRecord) => void;
  onDraftChange: (patch: Partial<CharacterWorkshopDraft>) => void;
  onError: (message: string | undefined) => void;
  onFocusSection: (section: CreateSetupSection) => void;
  onPreviewPostProcess: () => void;
  onSubmitting: (value: boolean) => void;
  postProcessPreviewReady: boolean;
  postProcessState: CreateArchivePostProcessState;
  projectRoot: string;
  selectedPlan?: CharacterMasterCandidatePlan;
  setCharacterImageStatus: (message: string) => void;
  setPostProcessState: (state: CreateArchivePostProcessState) => void;
}

export function CreateAssistSidebar({
  analyzeReport,
  createPhase,
  creationError,
  draft,
  generationState,
  isCreatingCharacter,
  isPreviewingPostProcess,
  onCancelFinalize,
  onCreated,
  onDraftChange,
  onError,
  onFocusSection,
  onPreviewPostProcess,
  onSubmitting,
  postProcessPreviewReady,
  postProcessState,
  projectRoot,
  selectedPlan,
  setCharacterImageStatus,
  setPostProcessState,
}: CreateAssistSidebarProps) {
  if (createPhase === "finalize" && generationState.status === "success" && selectedPlan) {
    return (
      <CreateArchivePanel
        analyzeReport={analyzeReport}
        creationError={creationError}
        draft={draft}
        generationState={generationState}
        isCreatingCharacter={isCreatingCharacter}
        isPreviewingPostProcess={isPreviewingPostProcess}
        onCancel={onCancelFinalize}
        onCreated={onCreated}
        onDraftChange={onDraftChange}
        onError={onError}
        onPreviewPostProcess={onPreviewPostProcess}
        onSubmitting={onSubmitting}
        postProcessPreviewReady={postProcessPreviewReady}
        postProcessState={postProcessState}
        projectRoot={projectRoot}
        selectedPlan={selectedPlan}
        setCharacterImageStatus={setCharacterImageStatus}
        setPostProcessState={setPostProcessState}
      />
    );
  }

  return <PromptPreviewPanel draft={draft} generationState={generationState} onFocusSection={onFocusSection} projectRoot={projectRoot} />;
}
