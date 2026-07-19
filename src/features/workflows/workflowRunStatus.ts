import type { WorkflowEdge, WorkflowNodeRun, WorkflowNodeRunStatus, WorkflowRunStatus } from "./types";

export type WorkflowNodeDisplayStatus = WorkflowNodeRunStatus | "waiting_upstream";

function buildUpstreamMap(edges: WorkflowEdge[]) {
  const upstreamByNode = new Map<string, string[]>();

  for (const edge of edges) {
    const upstream = upstreamByNode.get(edge.toNodeId) ?? [];
    upstream.push(edge.fromNodeId);
    upstreamByNode.set(edge.toNodeId, upstream);
  }

  return upstreamByNode;
}

function hasUnfinishedTransitiveUpstream(
  nodeId: string,
  nodeRuns: WorkflowNodeRun[],
  edges: WorkflowEdge[],
): boolean {
  const runById = new Map(nodeRuns.map((run) => [run.nodeId, run]));
  const upstreamByNode = buildUpstreamMap(edges);
  const visited = new Set<string>();
  const queue = [...(upstreamByNode.get(nodeId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const upstreamRun = runById.get(current);
    if (!upstreamRun) {
      return true;
    }

    if (upstreamRun.status === "queued" || upstreamRun.status === "running") {
      return true;
    }

    for (const parentId of upstreamByNode.get(current) ?? []) {
      queue.push(parentId);
    }
  }

  return false;
}

export function resolveEffectiveNodeStatus(
  nodeId: string,
  nodeRuns: WorkflowNodeRun[],
  edges: WorkflowEdge[],
  runStatus: WorkflowRunStatus,
): WorkflowNodeDisplayStatus {
  const nodeRun = nodeRuns.find((run) => run.nodeId === nodeId);
  const rawStatus = nodeRun?.status ?? "queued";

  if (runStatus !== "running") {
    return rawStatus;
  }

  if (rawStatus === "failed" || rawStatus === "canceled" || rawStatus === "skipped" || rawStatus === "running") {
    return rawStatus;
  }

  if (rawStatus === "succeeded" && hasUnfinishedTransitiveUpstream(nodeId, nodeRuns, edges)) {
    return "waiting_upstream";
  }

  return rawStatus;
}
