import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from "./types";

export type WorkflowLayoutMode =
  | "grouped"
  | "horizontal"
  | "vertical"
  | "compact"
  | "currentGroup";

export interface WorkflowLayoutModeOption {
  description: string;
  id: WorkflowLayoutMode;
  label: string;
}

export const WORKFLOW_LAYOUT_MODE_OPTIONS: WorkflowLayoutModeOption[] = [
  {
    description: "按编组排列各阶段，组内水平 DAG。",
    id: "grouped",
    label: "编组流水线",
  },
  {
    description: "全部节点从左到右分层排列。",
    id: "horizontal",
    label: "水平 DAG",
  },
  {
    description: "全部节点从上到下分层排列。",
    id: "vertical",
    label: "垂直 DAG",
  },
  {
    description: "更小间距的水平 DAG。",
    id: "compact",
    label: "紧凑",
  },
  {
    description: "仅重排当前编组内的节点。",
    id: "currentGroup",
    label: "当前编组",
  },
];

export function hasIncomingWorkflowEdge(
  edges: WorkflowEdge[],
  nodeId: string,
  portId: string,
): boolean {
  return edges.some((edge) => edge.toNodeId === nodeId && edge.toPort === portId);
}

export function isCharacterInputConnected(definition: WorkflowDefinition, nodeId: string): boolean {
  return hasIncomingWorkflowEdge(definition.edges, nodeId, "character");
}

export function shouldSkipWorkflowParamValidation(
  node: WorkflowNode,
  fieldId: string,
  definition: WorkflowDefinition,
): boolean {
  if (fieldId === "characterId" && isCharacterInputConnected(definition, node.id)) {
    return true;
  }

  if (fieldId === "viewId" && isCharacterInputConnected(definition, node.id)) {
    return true;
  }

  return false;
}

export function shouldRenderWorkflowParamFieldForNode(
  node: WorkflowNode,
  field: { advanced?: boolean; id: string; widget?: string },
  definition: WorkflowDefinition,
): boolean {
  if (field.advanced || field.widget === "runId") {
    return false;
  }

  if (field.id === "model" && field.widget !== "text") {
    return false;
  }

  if (field.widget === "candidatePlanPicker") {
    return false;
  }

  if ((field.id === "characterId" || field.id === "viewId") && isCharacterInputConnected(definition, node.id)) {
    return false;
  }

  return true;
}

export function resolveUpstreamCharacterLabel(
  definition: WorkflowDefinition,
  nodeId: string,
  selectedRun?: { nodeRuns: Array<{ nodeId: string; outputs?: Record<string, unknown> }> },
): string | undefined {
  const edge = definition.edges.find((item) => item.toNodeId === nodeId && item.toPort === "character");
  if (!edge || !selectedRun) {
    return undefined;
  }

  const upstreamRun = selectedRun.nodeRuns.find((nodeRun) => nodeRun.nodeId === edge.fromNodeId);
  const character = upstreamRun?.outputs?.character;
  if (!character || typeof character !== "object") {
    return undefined;
  }

  const record = character as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : undefined;
  const displayName = typeof record.displayName === "string" ? record.displayName : undefined;

  if (displayName && id) {
    return `${displayName}（${id}）`;
  }

  return id ?? displayName;
}
