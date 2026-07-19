import { getWorkflowNodeDefinition } from "./nodeCatalog";
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode, WorkflowPortKind } from "./types";

const PORT_COMPATIBILITY: Record<WorkflowPortKind, WorkflowPortKind[]> = {
  asset: ["asset", "character", "image", "toolResult"],
  character: ["character", "asset"],
  image: ["image", "toolResult", "asset"],
  text: ["text"],
  toolResult: ["toolResult", "image", "asset"],
};

export function arePortsCompatible(sourceKind: WorkflowPortKind, targetKind: WorkflowPortKind) {
  if (sourceKind === targetKind) {
    return true;
  }

  return PORT_COMPATIBILITY[sourceKind]?.includes(targetKind) ?? false;
}

export function getPortKind(
  nodes: WorkflowNode[],
  nodeId: string,
  portId: string | null | undefined,
  direction: "source" | "target",
): WorkflowPortKind | undefined {
  const node = nodes.find((item) => item.id === nodeId);
  const definition = node ? getWorkflowNodeDefinition(node.kind) : undefined;
  const ports = direction === "source" ? definition?.outputs : definition?.inputs;
  const port = ports?.find((item) => item.id === portId) ?? ports?.[0];

  return port?.kind;
}

export function isDuplicateEdge(edges: WorkflowEdge[], source: string, target: string, targetHandle: string | null) {
  return edges.some(
    (edge) =>
      edge.fromNodeId === source &&
      edge.toNodeId === target &&
      edge.toPort === (targetHandle ?? "input"),
  );
}

export function isValidWorkflowConnection(
  definition: WorkflowDefinition,
  source: string,
  target: string,
  sourceHandle: string | null | undefined,
  targetHandle: string | null | undefined,
) {
  if (source === target) {
    return false;
  }

  if (isDuplicateEdge(definition.edges, source, target, targetHandle ?? null)) {
    return false;
  }

  const sourceKind = getPortKind(definition.nodes, source, sourceHandle, "source");
  const targetKind = getPortKind(definition.nodes, target, targetHandle, "target");

  if (!sourceKind || !targetKind) {
    return false;
  }

  return arePortsCompatible(sourceKind, targetKind);
}
