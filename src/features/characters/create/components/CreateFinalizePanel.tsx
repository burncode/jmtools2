import { ConfirmStep } from "../steps/ConfirmStep";
import type {
  CharacterAssetRecord,
  CharacterMasterCandidatePlan,
  CharacterMasterPlanGenerationResult,
  CharacterWorkshopDraft,
} from "../../types";

interface CreateFinalizePanelProps {
  creationError?: string;
  draft: CharacterWorkshopDraft;
  generationState: { result: CharacterMasterPlanGenerationResult; status: "success" };
  isCreatingCharacter: boolean;
  onCancel: () => void;
  onCreated: (record: CharacterAssetRecord) => void;
  onError: (message: string | undefined) => void;
  onSubmitting: (value: boolean) => void;
  projectRoot: string;
  selectedPlan: CharacterMasterCandidatePlan;
  setCharacterImageStatus: (message: string) => void;
}

export function CreateFinalizePanel(props: CreateFinalizePanelProps) {
  return (
    <section aria-label="入库确认" className="character-create-finalize-panel">
      <header>
        <strong>确认入库</strong>
        <button className="character-create-finalize-cancel" onClick={props.onCancel} type="button">
          返回选图
        </button>
      </header>
      <ConfirmStep {...props} />
    </section>
  );
}
