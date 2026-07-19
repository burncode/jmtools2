import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CharacterPlanGenerationState, CharacterWorkshopDraft, CreateSetupSection } from "@/features/characters/types";
import { emptyCharacterDraft, normalizeCharacterWorkshopDraft } from "@/features/characters/archetypes/defaults";

export const idleCreateGenerationSession: CharacterPlanGenerationState = {
  message: "调整设定后点击「生成母版」，进度将显示在预览画布中。",
  status: "idle",
};

export type CharacterWorkshopMode = "library" | "create" | "production";

export type CreatePhase = "finalize" | "generating" | "review" | "setup";

/** 生产工作室仅保留动作主工作区；历史 Tab 值迁移为 actions。 */
export type ProductionTab = "actions";

export function normalizeProductionTab(_tab?: string): ProductionTab {
  return "actions";
}

const PERSIST_VERSION = 4;

interface CharacterWorkshopState {
  createActiveTaskId?: string;
  createDraft: CharacterWorkshopDraft;
  createGenerationSession: CharacterPlanGenerationState;
  createPhase: CreatePhase;
  createSelectedPlanId?: string;
  createSetupFocusSection: CreateSetupSection | null;
  mode: CharacterWorkshopMode;
  productionTab: ProductionTab;
  projectRoot?: string;
  selectedCharacterId?: string;
}

interface CharacterWorkshopActions {
  openCreate: () => void;
  openLibrary: () => void;
  openProduction: (characterId: string, tab?: string) => void;
  resetCreateDraft: () => void;
  resetCreateGenerationSession: () => void;
  setCreateActiveTaskId: (taskId: string | undefined) => void;
  setCreateDraft: (draft: Partial<CharacterWorkshopDraft>) => void;
  setCreateGenerationSession: (
    session:
      | CharacterPlanGenerationState
      | ((current: CharacterPlanGenerationState) => CharacterPlanGenerationState),
  ) => void;
  setCreatePhase: (phase: CreatePhase) => void;
  setCreateSelectedPlanId: (planId: string | undefined) => void;
  setCreateSetupFocusSection: (section: CreateSetupSection | null) => void;
  setMode: (mode: CharacterWorkshopMode) => void;
  setProductionTab: (tab: ProductionTab) => void;
  setProjectRoot: (projectRoot: string) => void;
  setSelectedCharacterId: (characterId: string | undefined) => void;
}

function stripDraftForPersist(draft: CharacterWorkshopDraft): CharacterWorkshopDraft {
  return normalizeCharacterWorkshopDraft({
    ...draft,
    referenceImages: draft.referenceImages.map((image) => ({
      ...image,
      dataUrl: "",
    })),
  });
}

function resetCreateFlowState(): Pick<
  CharacterWorkshopState,
  "createActiveTaskId" | "createGenerationSession" | "createPhase" | "createSelectedPlanId" | "createSetupFocusSection"
> {
  return {
    createActiveTaskId: undefined,
    createGenerationSession: idleCreateGenerationSession,
    createPhase: "setup",
    createSelectedPlanId: undefined,
    createSetupFocusSection: null,
  };
}

export const useCharacterWorkshopStore = create<CharacterWorkshopState & CharacterWorkshopActions>()(
  persist(
    (set) => ({
      ...resetCreateFlowState(),
      createDraft: emptyCharacterDraft,
      mode: "library",
      productionTab: "actions",
      openCreate: () =>
        set({
          createDraft: emptyCharacterDraft,
          mode: "create",
          ...resetCreateFlowState(),
        }),
      openLibrary: () =>
        set({
          mode: "library",
          ...resetCreateFlowState(),
        }),
      openProduction: (characterId, tab) =>
        set({
          mode: "production",
          productionTab: normalizeProductionTab(tab),
          selectedCharacterId: characterId,
          ...resetCreateFlowState(),
        }),
      resetCreateDraft: () =>
        set({
          createDraft: emptyCharacterDraft,
          ...resetCreateFlowState(),
        }),
      resetCreateGenerationSession: () => set(resetCreateFlowState()),
      setCreateActiveTaskId: (taskId) => set({ createActiveTaskId: taskId }),
      setCreateDraft: (draft) =>
        set((state) => ({
          createDraft: normalizeCharacterWorkshopDraft({ ...state.createDraft, ...draft }),
        })),
      setCreateGenerationSession: (session) =>
        set((state) => ({
          createGenerationSession: typeof session === "function" ? session(state.createGenerationSession) : session,
        })),
      setCreatePhase: (phase) => set({ createPhase: phase }),
      setCreateSelectedPlanId: (planId) => set({ createSelectedPlanId: planId }),
      setCreateSetupFocusSection: (section) => set({ createSetupFocusSection: section }),
      setMode: (mode) => set({ mode }),
      setProductionTab: () => set({ productionTab: "actions" }),
      setProjectRoot: (projectRoot) =>
        set((state) => {
          if (state.projectRoot === projectRoot) {
            return { projectRoot };
          }

          return {
            mode: "library",
            projectRoot,
            selectedCharacterId: undefined,
            ...resetCreateFlowState(),
          };
        }),
      setSelectedCharacterId: (characterId) => set({ selectedCharacterId: characterId }),
    }),
    {
      name: "jmtools.character.workshop",
      version: PERSIST_VERSION,
      migrate: (persistedState, version) => {
        const persisted = persistedState as Partial<CharacterWorkshopState> | undefined;

        if (version < PERSIST_VERSION && persisted) {
          return {
            createDraft: persisted.createDraft ?? emptyCharacterDraft,
            productionTab: "actions" as ProductionTab,
            projectRoot: persisted.projectRoot,
            selectedCharacterId: persisted.selectedCharacterId,
          };
        }

        return persistedState as {
          createDraft: CharacterWorkshopDraft;
          productionTab: ProductionTab;
          projectRoot?: string;
          selectedCharacterId?: string;
        };
      },
      partialize: (state) => ({
        createDraft: stripDraftForPersist(state.createDraft),
        productionTab: state.productionTab,
        projectRoot: state.projectRoot,
        selectedCharacterId: state.selectedCharacterId,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CharacterWorkshopState> | undefined;
        const persistedProjectRoot = persisted?.projectRoot;
        const selectedCharacterId =
          persistedProjectRoot && persistedProjectRoot === currentState.projectRoot
            ? (persisted?.selectedCharacterId ?? currentState.selectedCharacterId)
            : currentState.selectedCharacterId;

        return {
          ...currentState,
          createDraft: normalizeCharacterWorkshopDraft({
            ...currentState.createDraft,
            ...(persisted?.createDraft ?? {}),
          }),
          mode: "library",
          productionTab: "actions",
          projectRoot: persistedProjectRoot ?? currentState.projectRoot,
          selectedCharacterId,
          ...resetCreateFlowState(),
        };
      },
    },
  ),
);

export const createPhaseLabels: Record<CreatePhase, string> = {
  finalize: "入库",
  generating: "生成中",
  review: "选择母版",
  setup: "设定",
};

export const productionTabLabels: Record<ProductionTab, string> = {
  actions: "动作",
};
