import { create } from "zustand";

import type { PipelineProject } from "../features/projects/types";
import type { CharacterWorkshopIntent, WorkflowOpenIntent, WorkspacePanel, WorkspaceState } from "../features/workspace/types";

interface WorkspaceActions {
  clearCharacterWorkshopIntent: () => void;
  clearWorkflowOpenIntent: () => void;
  openCharacterWorkshop: (intent?: CharacterWorkshopIntent) => void;
  openWorkflowWithIntent: (intent: WorkflowOpenIntent) => void;
  selectAsset: (assetId: string | undefined) => void;
  setActivePanel: (panel: WorkspacePanel) => void;
  setCurrentProject: (project: PipelineProject | undefined) => void;
}

interface WorkspaceProjectState {
  currentProject?: PipelineProject;
}

export const useWorkspaceStore = create<WorkspaceState & WorkspaceProjectState & WorkspaceActions>((set) => ({
  activePanel: "dashboard",
  clearCharacterWorkshopIntent: () => set({ characterWorkshopIntent: undefined }),
  clearWorkflowOpenIntent: () => set({ workflowOpenIntent: undefined }),
  openCharacterWorkshop: (intent) =>
    set({
      activePanel: "characters",
      characterWorkshopIntent: intent,
    }),
  openWorkflowWithIntent: (intent) =>
    set({
      activePanel: "workflow",
      workflowOpenIntent: intent,
    }),
  selectAsset: (selectedAssetId) => set({ selectedAssetId }),
  setActivePanel: (activePanel) => set({ activePanel }),
  setCurrentProject: (currentProject) => set({ currentProject }),
}));
