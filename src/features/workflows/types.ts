import type { BackgroundRemovalToolOptions } from "@/features/tools/types";
import type { LucideIcon } from "lucide-react";

export type WorkflowNodeKind =
  | "ai.imageGenerate"
  | "ai.negativePrompt"
  | "ai.prompt"
  | "character.analyze"
  | "character.bindToolResult"
  | "character.create"
  | "character.generateActionFrames"
  | "character.generateCandidates"
  | "character.generatePlan"
  | "character.generateViews"
  | "character.inputSeed"
  | "character.load"
  | "character.normalize"
  | "character.outfitProfile"
  | "character.removeBackground"
  | "character.styleProfile"
  | "control.consistencyLock"
  | "control.manualGate"
  | "control.referenceStrength"
  | "control.seedLock"
  | "image.input"
  | "logic.promptCompiler"
  | "logic.promptMerge"
  | "output.animationExport"
  | "output.asset"
  | "output.atlasPack"
  | "output.godotSpriteFrames"
  | "output.spriteSplit"
  | "output.spritesheet"
  | "preview.actionSequence"
  | "preview.image"
  | "tool.backgroundRemoval";

export type WorkflowPortKind = "asset" | "character" | "image" | "text" | "toolResult";

export type WorkflowNodeCategory = "ai" | "asset" | "character" | "input" | "logic" | "output" | "preview" | "tool";

export type WorkflowRunStatus = "awaiting_input" | "canceled" | "failed" | "partial" | "queued" | "running" | "succeeded";

export type WorkflowNodeRunStatus = "awaiting_input" | "canceled" | "failed" | "queued" | "running" | "skipped" | "succeeded";

export interface WorkflowValueRef {
  absolutePath?: string;
  kind: "absolutePath" | "character" | "projectRelativePath" | "toolResult";
  path?: string;
  value?: Record<PropertyKey, unknown>;
}

export interface WorkflowGroup {
  collapsed?: boolean;
  color?: string;
  id: string;
  label: string;
  position: {
    x: number;
    y: number;
  };
  size: {
    height: number;
    width: number;
  };
}

export interface WorkflowNode {
  accentColor?: string;
  collapsed?: boolean;
  id: string;
  kind: WorkflowNodeKind;
  params: Record<string, unknown>;
  parentGroupId?: string;
  position: {
    x: number;
    y: number;
  };
}

export interface WorkflowEdge {
  dataType: WorkflowPortKind;
  fromNodeId: string;
  fromPort: string;
  id: string;
  toNodeId: string;
  toPort: string;
}

export interface WorkflowDefinition {
  createdAt?: string;
  description: string;
  edges: WorkflowEdge[];
  groups?: WorkflowGroup[];
  id: string;
  name: string;
  nodes: WorkflowNode[];
  schemaVersion?: number;
  selectedTemplate?: string;
  uiState?: Record<string, unknown>;
  updatedAt?: string;
  viewport?: Record<string, unknown>;
}

export interface WorkflowRunLog {
  event: string;
  level: "error" | "info" | "warn" | string;
  message: string;
  nodeId?: string;
  timestamp: number;
}

export interface WorkflowNodeRun {
  cacheHit?: boolean;
  durationMs?: number;
  error: string;
  finishedAt?: number;
  logs?: WorkflowRunLog[];
  nodeId: string;
  nodeKind: WorkflowNodeKind;
  outputSummary?: string;
  outputs: Record<string, unknown>;
  progress?: number;
  startedAt?: number;
  status: WorkflowNodeRunStatus;
}

export interface WorkflowRun {
  error: string;
  finishedAt?: number;
  id: string;
  nodeRuns: WorkflowNodeRun[];
  startedAt: number;
  status: WorkflowRunStatus;
  workflowId: string;
  workflowName: string;
}

export interface WorkflowPortDefinition {
  id: string;
  kind: WorkflowPortKind;
  label: string;
}

export type WorkflowParamWidget =
  | "aiProviderSelect"
  | "assetRef"
  | "candidatePlanPicker"
  | "characterRef"
  | "multiSelect"
  | "projectPath"
  | "runId"
  | "slider"
  | "switch"
  | "textarea"
  | "text";

export type WorkflowParamBinding = "character" | "text";

export interface WorkflowParamDefinition {
  advanced?: boolean;
  binding?: WorkflowParamBinding;
  defaultValue?: unknown;
  description?: string;
  display?: "inline" | "inspector";
  group?: string;
  id: string;
  label: string;
  max?: number;
  min?: number;
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
  type: "boolean" | "number" | "select" | "text";
  validate?: {
    pattern?: string;
  };
  widget?: WorkflowParamWidget;
}

export interface WorkflowParamGroupDefinition {
  id: string;
  label: string;
}

export interface WorkflowNodeDefinition {
  category: WorkflowNodeCategory;
  color: "ai" | "asset" | "character" | "error" | "input" | "logic" | "output" | "preview" | "tool";
  description: string;
  helpText: string;
  icon: LucideIcon;
  inputKinds: WorkflowPortKind[];
  inputs: WorkflowPortDefinition[];
  kind: WorkflowNodeKind;
  label: string;
  layer?: "asset" | "control" | "io" | "semantic";
  outputKinds: WorkflowPortKind[];
  outputs: WorkflowPortDefinition[];
  paramGroups?: WorkflowParamGroupDefinition[];
  paramsSchema: WorkflowParamDefinition[];
  status: "available" | "planned";
}

export interface WorkflowTemplate {
  definition: WorkflowDefinition;
  description: string;
  id: string;
  label: string;
}

export type WorkflowNodeParams =
  | BackgroundRemovalToolOptions
  | {
      characterId?: string;
      path?: string;
      sourceKind?: "absolutePath" | "projectRelativePath";
      viewId?: string;
    };
