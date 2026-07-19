import type { LucideIcon } from "lucide-react";

export type WorkspacePanel =
  | "dashboard"
  | "workflow"
  | "characters"
  | "assetTools"
  | "scenes"
  | "items"
  | "vfx"
  | "ui"
  | "animation"
  | "atlas"
  | "audio"
  | "export"
  | "batch";

export interface CharacterWorkshopIntent {
  characterId?: string;
  mode?: "create" | "library" | "production";
  productionTab?: "actions";
  createPhase?: "finalize" | "generating" | "review" | "setup";
}

export interface WorkflowOpenIntent {
  characterId?: string;
  templateId?: string;
}

export interface WorkspaceState {
  activePanel: WorkspacePanel;
  characterWorkshopIntent?: CharacterWorkshopIntent;
  selectedAssetId?: string;
  workflowOpenIntent?: WorkflowOpenIntent;
}

export interface WorkspaceNavItem {
  group: "production" | "management";
  icon: LucideIcon;
  label: string;
  panel: WorkspacePanel;
}

export interface ProductionModule {
  accent: "blue" | "cyan" | "green" | "orange" | "purple" | "red";
  description: string;
  icon: LucideIcon;
  label: string;
  metric: string;
  panel: WorkspacePanel;
  status: string;
}

export interface RecentWorkItem {
  detail: string;
  module: string;
  name: string;
  status: string;
  time: string;
  type: string;
}

export interface PipelineTask {
  detail: string;
  progress: number;
  status: string;
  title: string;
}

export interface WorkspaceStat {
  label: string;
  value: string;
}
