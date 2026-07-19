import { buildDefaultNodeParams } from "./nodeDefaults";
import { getWorkflowNodeDefinition } from "./nodeCatalog";
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode, WorkflowNodeKind } from "./types";

export interface WorkflowClipboardPayload {
  edges: WorkflowEdge[];
  nodes: WorkflowNode[];
}

export function copyWorkflowSelection(definition: WorkflowDefinition, nodeIds: string[]): WorkflowClipboardPayload | null {
  const selectedIds = new Set(nodeIds);

  if (selectedIds.size === 0) {
    return null;
  }

  const nodes = definition.nodes.filter((node) => selectedIds.has(node.id));
  const edges = definition.edges.filter(
    (edge) => selectedIds.has(edge.fromNodeId) && selectedIds.has(edge.toNodeId),
  );

  return {
    edges: structuredClone(edges),
    nodes: structuredClone(nodes),
  };
}

export function pasteWorkflowClipboard(
  definition: WorkflowDefinition,
  clipboard: WorkflowClipboardPayload,
  options?: {
    anchor?: { x: number; y: number };
    offset?: { x: number; y: number };
  },
): WorkflowDefinition {
  const offset = options?.offset ?? { x: 40, y: 40 };
  const anchor = options?.anchor;
  const minPosition = anchor
    ? {
        x: Math.min(...clipboard.nodes.map((node) => node.position.x)),
        y: Math.min(...clipboard.nodes.map((node) => node.position.y)),
      }
    : undefined;
  const idMap = new Map<string, string>();
  const timestamp = Date.now();

  const nextNodes = clipboard.nodes.map((node, index) => {
    const nextId = `${node.kind.replace(".", "-")}-${timestamp}-${index}`;
    idMap.set(node.id, nextId);

    return {
      ...node,
      id: nextId,
      parentGroupId: undefined,
      position: anchor && minPosition
        ? {
            x: anchor.x + (node.position.x - minPosition.x),
            y: anchor.y + (node.position.y - minPosition.y),
          }
        : {
            x: node.position.x + offset.x,
            y: node.position.y + offset.y,
          },
    };
  });

  const nextEdges = clipboard.edges
    .map((edge, index) => {
      const fromNodeId = idMap.get(edge.fromNodeId);
      const toNodeId = idMap.get(edge.toNodeId);

      if (!fromNodeId || !toNodeId) {
        return null;
      }

      return {
        ...edge,
        fromNodeId,
        id: `edge-${fromNodeId}-${toNodeId}-${timestamp}-${index}`,
        toNodeId,
      } satisfies WorkflowEdge;
    })
    .filter((edge): edge is WorkflowEdge => edge !== null);

  return {
    ...definition,
    edges: [...definition.edges, ...nextEdges],
    nodes: [...definition.nodes, ...nextNodes],
  };
}

export function duplicateWorkflowNodes(
  definition: WorkflowDefinition,
  nodeIds: string[],
  offset = { x: 40, y: 40 },
): WorkflowDefinition | null {
  const clipboard = copyWorkflowSelection(definition, nodeIds);

  if (!clipboard) {
    return null;
  }

  return pasteWorkflowClipboard(definition, clipboard, { offset });
}

export function createWorkflowNode(kind: WorkflowNodeKind, index: number): WorkflowNode {
  const descriptor = getWorkflowNodeDefinition(kind);

  return {
    id: `${kind.replace(".", "-")}-${Date.now()}-${index}`,
    kind,
    params: buildDefaultNodeParams(descriptor),
    position: {
      x: 160 + index * 40,
      y: 120 + index * 30,
    },
  };
}
