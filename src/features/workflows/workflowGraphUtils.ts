import type { WorkflowEdge } from "./types";

export function collectDownstreamNodeIds(nodeId: string, edges: WorkflowEdge[]): string[] {
  const visited = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    for (const edge of edges) {
      if (edge.fromNodeId !== current || visited.has(edge.toNodeId)) {
        continue;
      }

      visited.add(edge.toNodeId);
      queue.push(edge.toNodeId);
    }
  }

  return [...visited];
}

export function buildRunFromNodeIds(nodeId: string, edges: WorkflowEdge[]): string[] {
  return [nodeId, ...collectDownstreamNodeIds(nodeId, edges)];
}
