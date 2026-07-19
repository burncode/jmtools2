import type { WorkflowDefinition, WorkflowNode } from "./types";

export type AutoLayoutDirection = "horizontal" | "vertical";

export interface AutoLayoutOptions {
  columnGap?: number;
  direction?: AutoLayoutDirection;
  originX?: number;
  originY?: number;
  rowGap?: number;
}

const DEFAULT_COLUMN_GAP = 308;
const DEFAULT_ROW_GAP = 212;
const DEFAULT_ORIGIN_X = 80;
const DEFAULT_ORIGIN_Y = 80;

export function autoLayoutWorkflow(
  definition: WorkflowDefinition,
  targetNodeIds?: string[],
  options?: AutoLayoutOptions,
): WorkflowDefinition {
  const targetSet = new Set(targetNodeIds ?? definition.nodes.map((node) => node.id));
  const layoutNodes = definition.nodes.filter((node) => targetSet.has(node.id));

  if (layoutNodes.length === 0) {
    return definition;
  }

  const layoutIds = new Set(layoutNodes.map((node) => node.id));
  const incoming = new Map<string, Set<string>>();

  for (const node of layoutNodes) {
    incoming.set(node.id, new Set());
  }

  for (const edge of definition.edges) {
    if (!layoutIds.has(edge.fromNodeId) || !layoutIds.has(edge.toNodeId)) {
      continue;
    }

    incoming.get(edge.toNodeId)?.add(edge.fromNodeId);
  }

  const layers = assignLayers(layoutNodes, incoming);
  const positions = assignPositions(layers, options);

  return {
    ...definition,
    nodes: definition.nodes.map((node) => {
      const position = positions.get(node.id);

      if (!position) {
        return node;
      }

      return {
        ...node,
        position,
      };
    }),
  };
}

function assignLayers(nodes: WorkflowNode[], incoming: Map<string, Set<string>>) {
  const layers = new Map<string, number>();
  const queue = nodes
    .filter((node) => (incoming.get(node.id)?.size ?? 0) === 0)
    .map((node) => node.id);

  if (queue.length === 0) {
    queue.push(nodes[0]?.id ?? "");
  }

  const visited = new Set<string>();

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (!nodeId || visited.has(nodeId)) {
      continue;
    }

    visited.add(nodeId);
    const parents = incoming.get(nodeId) ?? new Set<string>();
    const layer =
      parents.size === 0
        ? 0
        : Math.max(...Array.from(parents).map((parentId) => (layers.get(parentId) ?? 0) + 1));

    layers.set(nodeId, layer);

    for (const childId of nodes.map((node) => node.id)) {
      if ((incoming.get(childId) ?? new Set()).has(nodeId) && !visited.has(childId)) {
        queue.push(childId);
      }
    }
  }

  for (const node of nodes) {
    if (!layers.has(node.id)) {
      layers.set(node.id, 0);
    }
  }

  const grouped = new Map<number, string[]>();

  for (const [nodeId, layer] of layers.entries()) {
    const bucket = grouped.get(layer) ?? [];
    bucket.push(nodeId);
    grouped.set(layer, bucket);
  }

  return grouped;
}

function assignPositions(grouped: Map<number, string[]>, options?: AutoLayoutOptions) {
  const direction = options?.direction ?? "horizontal";
  const columnGap = options?.columnGap ?? DEFAULT_COLUMN_GAP;
  const rowGap = options?.rowGap ?? DEFAULT_ROW_GAP;
  const originX = options?.originX ?? DEFAULT_ORIGIN_X;
  const originY = options?.originY ?? DEFAULT_ORIGIN_Y;
  const positions = new Map<string, { x: number; y: number }>();

  for (const [layer, nodeIds] of grouped.entries()) {
    nodeIds.forEach((nodeId, index) => {
      if (direction === "vertical") {
        positions.set(nodeId, {
          x: originX + index * columnGap,
          y: originY + layer * rowGap,
        });
        return;
      }

      positions.set(nodeId, {
        x: originX + layer * columnGap,
        y: originY + index * rowGap,
      });
    });
  }

  return positions;
}
