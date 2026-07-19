import type { Edge, Node } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";

import { getWorkflowNodeDefinition } from "./nodeCatalog";
import type {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowGroup,
  WorkflowNode,
  WorkflowNodeRun,
  WorkflowPortKind,
} from "./types";

/// 画布同步签名：仅编码影响节点/编组"视觉"的字段（折叠、强调色、父编组、编组尺寸/颜色、
/// 连线结构）。当这些字段变化时签名变化，从而驱动同步 effect 重跑；位置由 React Flow 与
/// mergeDefinitionNodes 直接维护，因此不计入签名以避免拖拽时无谓重跑。
export function computeDefinitionVisualSignature(definition: WorkflowDefinition): string {
  const nodeParts = definition.nodes.map((node) =>
    [
      node.id,
      node.kind,
      node.collapsed ? 1 : 0,
      node.accentColor ?? "",
      node.parentGroupId ?? "",
      JSON.stringify(node.params ?? {}),
    ].join(","),
  );
  const groupParts = (definition.groups ?? []).map((group) =>
    [
      group.id,
      group.collapsed ? 1 : 0,
      group.color ?? "",
      group.label,
      group.size?.width ?? "",
      group.size?.height ?? "",
    ].join(","),
  );
  const edgeParts = definition.edges.map((edge) =>
    [edge.id, edge.fromNodeId, edge.toNodeId, edge.fromPort ?? "", edge.toPort ?? "", edge.dataType ?? ""].join(","),
  );

  return `${definition.id}|n:${nodeParts.join(";")}|g:${groupParts.join(";")}|e:${edgeParts.join(";")}`;
}

export function toReactFlowNodes(definition: WorkflowDefinition, pulseNodeId: string | undefined): Node[] {
  const groups = definition.groups ?? [];
  const collapsedGroupIds = new Set(groups.filter((group) => group.collapsed).map((group) => group.id));

  const groupNodes = groups.map((group) => toReactFlowGroupNode(group));
  const workflowNodes = definition.nodes.map((node, index) =>
    toReactFlowWorkflowNode(node, index, collapsedGroupIds, pulseNodeId),
  );

  return [...groupNodes, ...workflowNodes];
}

export function mergeDefinitionNodes(
  currentNodes: Node[],
  definition: WorkflowDefinition,
  pulseNodeId: string | undefined,
): Node[] {
  const nextNodes = toReactFlowNodes(definition, pulseNodeId);
  const currentById = new Map(currentNodes.map((node) => [node.id, node]));
  let changed = currentNodes.length !== nextNodes.length;

  const mergedNodes = nextNodes.map((node) => {
    const currentNode = currentById.get(node.id);
    if (!currentNode) {
      changed = true;
      return { ...node, selected: false };
    }

    const pulseClass = pulseNodeId === node.id ? "workflow-node-focus-pulse" : undefined;
    const currentData = currentNode.data as {
      definition?: unknown;
      group?: unknown;
      node?: WorkflowNode;
      run?: WorkflowNodeRun;
    };
    const nextData = node.data as { definition?: unknown; group?: unknown; node?: WorkflowNode };

    if (
      currentNode.type === node.type &&
      currentNode.hidden === node.hidden &&
      currentNode.className === pulseClass &&
      currentData.node === nextData.node &&
      currentData.group === nextData.group &&
      currentData.definition === nextData.definition
    ) {
      return currentNode;
    }

    changed = true;
    return {
      ...node,
      className: pulseClass,
      position: currentNode.position,
      selected: currentNode.selected,
      data: {
        ...nextData,
        run: currentData.run,
      },
    };
  });

  return changed ? mergedNodes : currentNodes;
}

export function patchNodesWithRuns(
  currentNodes: Node[],
  nodeRuns: WorkflowNodeRun[],
  pulseNodeId: string | undefined,
): Node[] {
  const runById = new Map(nodeRuns.map((nodeRun) => [nodeRun.nodeId, nodeRun]));
  let changed = false;

  const nextNodes = currentNodes.map((node) => {
    if (node.type !== "workflowNode") {
      const pulseClass = pulseNodeId === node.id ? "workflow-node-focus-pulse" : undefined;
      if (node.className === pulseClass) {
        return node;
      }

      changed = true;
      return { ...node, className: pulseClass };
    }

    const nodeData = node.data as { run?: WorkflowNodeRun };
    const run = runById.get(node.id);
    const pulseClass = pulseNodeId === node.id ? "workflow-node-focus-pulse" : undefined;

    if (nodeData.run === run && node.className === pulseClass) {
      return node;
    }

    changed = true;
    return {
      ...node,
      className: pulseClass,
      data: {
        ...nodeData,
        run,
      },
    };
  });

  return changed ? nextNodes : currentNodes;
}

export function patchEdgesWithRuns(
  currentEdges: Edge[],
  workflowEdges: WorkflowEdge[],
  nodes: WorkflowNode[],
  nodeRuns: WorkflowNodeRun[],
): Edge[] {
  if (
    currentEdges.length !== workflowEdges.length ||
    workflowEdges.some((edge) => !currentEdges.some((currentEdge) => currentEdge.id === edge.id))
  ) {
    return toReactFlowEdges(workflowEdges, nodes, nodeRuns);
  }

  const runningNodeIds = new Set(nodeRuns.filter((nodeRun) => nodeRun.status === "running").map((nodeRun) => nodeRun.nodeId));
  const failedNodeIds = new Set(
    nodeRuns.filter((nodeRun) => nodeRun.status === "failed" || Boolean(nodeRun.error)).map((nodeRun) => nodeRun.nodeId),
  );
  const succeededNodeIds = new Set(
    nodeRuns.filter((nodeRun) => nodeRun.status === "succeeded").map((nodeRun) => nodeRun.nodeId),
  );

  let changed = false;

  const nextEdges = currentEdges.map((edge) => {
    const workflowEdge = workflowEdges.find((item) => item.id === edge.id);
    if (!workflowEdge) {
      return edge;
    }

    const animated = runningNodeIds.has(workflowEdge.fromNodeId) || runningNodeIds.has(workflowEdge.toNodeId);
    const dataType = inferConnectionDataType(nodes, workflowEdge.fromNodeId, edge.sourceHandle ?? null);
    const runStateClass = resolveEdgeRunStateClass(workflowEdge, runningNodeIds, failedNodeIds, succeededNodeIds);
    const className = `workflow-flow-edge workflow-flow-edge-${workflowEdge.dataType ?? dataType}${runStateClass ? ` ${runStateClass}` : ""}`;

    if (edge.animated === animated && edge.className === className) {
      return edge;
    }

    changed = true;
    return {
      ...edge,
      animated,
      className,
    };
  });

  return changed ? nextEdges : currentEdges;
}

function toReactFlowGroupNode(group: WorkflowGroup): Node {
  return {
    data: {
      group,
    },
    draggable: true,
    id: group.id,
    position: normalizeGroupPosition(group),
    selectable: true,
    style: {
      height: group.size.height,
      width: group.size.width,
      zIndex: 0,
    },
    type: "workflowGroup",
  } satisfies Node;
}

function toReactFlowWorkflowNode(
  node: WorkflowNode,
  index: number,
  collapsedGroupIds: Set<string>,
  pulseNodeId: string | undefined,
): Node {
  const nodeDefinition = getWorkflowNodeDefinition(node.kind);
  const hidden = Boolean(node.parentGroupId && collapsedGroupIds.has(node.parentGroupId));

  return {
    className: pulseNodeId === node.id ? "workflow-node-focus-pulse" : undefined,
    data: {
      definition: nodeDefinition,
      node,
      run: undefined,
    },
    extent: node.parentGroupId ? "parent" : undefined,
    hidden,
    id: node.id,
    parentId: node.parentGroupId,
    position: normalizeNodePosition(node, index),
    type: "workflowNode",
    zIndex: node.parentGroupId ? 1 : undefined,
  } satisfies Node;
}

function normalizeGroupPosition(group: WorkflowGroup) {
  const x = Number(group.position?.x);
  const y = Number(group.position?.y);

  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

function normalizeNodePosition(node: WorkflowNode, index: number) {
  const x = Number(node.position?.x);
  const y = Number(node.position?.y);

  return {
    x: Number.isFinite(x) ? x : 120 + index * 220,
    y: Number.isFinite(y) ? y : 120,
  };
}

export function toReactFlowEdges(edges: WorkflowEdge[], nodes: WorkflowNode[], nodeRuns: WorkflowNodeRun[]): Edge[] {
  const runningNodeIds = new Set(nodeRuns.filter((nodeRun) => nodeRun.status === "running").map((nodeRun) => nodeRun.nodeId));
  const failedNodeIds = new Set(
    nodeRuns.filter((nodeRun) => nodeRun.status === "failed" || Boolean(nodeRun.error)).map((nodeRun) => nodeRun.nodeId),
  );
  const succeededNodeIds = new Set(
    nodeRuns.filter((nodeRun) => nodeRun.status === "succeeded").map((nodeRun) => nodeRun.nodeId),
  );

  return edges.map((edge) => {
    const sourceHandle = normalizePortId(nodes, edge.fromNodeId, edge.fromPort, "source");
    const targetHandle = normalizePortId(nodes, edge.toNodeId, edge.toPort, "target");
    const dataType = inferConnectionDataType(nodes, edge.fromNodeId, sourceHandle);
    const runStateClass = resolveEdgeRunStateClass(edge, runningNodeIds, failedNodeIds, succeededNodeIds);

    return {
      animated: runningNodeIds.has(edge.fromNodeId) || runningNodeIds.has(edge.toNodeId),
      className: `workflow-flow-edge workflow-flow-edge-${edge.dataType ?? dataType}${runStateClass ? ` ${runStateClass}` : ""}`,
      id: edge.id,
      markerEnd: { type: MarkerType.ArrowClosed },
      source: edge.fromNodeId,
      sourceHandle,
      target: edge.toNodeId,
      targetHandle,
    };
  });
}

function resolveEdgeRunStateClass(
  edge: WorkflowEdge,
  runningNodeIds: Set<string>,
  failedNodeIds: Set<string>,
  succeededNodeIds: Set<string>,
) {
  if (runningNodeIds.has(edge.fromNodeId) || runningNodeIds.has(edge.toNodeId)) {
    return "workflow-flow-edge-running";
  }

  if (failedNodeIds.has(edge.toNodeId) || failedNodeIds.has(edge.fromNodeId)) {
    return "workflow-flow-edge-failed";
  }

  if (succeededNodeIds.has(edge.fromNodeId) && succeededNodeIds.has(edge.toNodeId)) {
    return "workflow-flow-edge-succeeded";
  }

  return "";
}

export function clientToFlowPosition(
  clientX: number,
  clientY: number,
  bounds: DOMRect,
  viewport: { x: number; y: number; zoom: number },
) {
  return {
    x: (clientX - bounds.left - viewport.x) / viewport.zoom,
    y: (clientY - bounds.top - viewport.y) / viewport.zoom,
  };
}

export function inferConnectionDataType(
  nodes: WorkflowNode[],
  sourceNodeId: string,
  sourcePortId: string | null,
): WorkflowPortKind {
  const sourceNode = nodes.find((node) => node.id === sourceNodeId);
  const definition = sourceNode ? getWorkflowNodeDefinition(sourceNode.kind) : undefined;
  const output = definition?.outputs.find((port) => port.id === sourcePortId);

  return output?.kind ?? "asset";
}

function normalizePortId(
  nodes: WorkflowNode[],
  nodeId: string,
  portId: string | undefined,
  direction: "source" | "target",
) {
  const node = nodes.find((item) => item.id === nodeId);
  const definition = node ? getWorkflowNodeDefinition(node.kind) : undefined;
  const ports = direction === "source" ? definition?.outputs : definition?.inputs;

  if (!ports?.length) {
    return null;
  }

  if (portId && ports.some((port) => port.id === portId)) {
    return portId;
  }

  return ports[0]?.id ?? null;
}

export function getMiniMapNodeColor(node: Node) {
  if (node.type === "workflowGroup") {
    return "#334155";
  }

  const data = node.data as { definition?: { color?: string } };
  const colors = {
    ai: "#3b82f6",
    asset: "#6b7280",
    character: "#22c55e",
    error: "#ef4444",
    input: "#06b6d4",
    logic: "#a855f7",
    output: "#f97316",
    preview: "#8b5cf6",
    tool: "#eab308",
  } as const;

  return colors[data.definition?.color as keyof typeof colors] ?? "#8b5cf6";
}

export function snapCoordinate(value: number, enabled: boolean) {
  const rounded = Math.round(value);

  if (!enabled) {
    return rounded;
  }

  return Math.round(rounded / 16) * 16;
}

export function readViewport(viewport: Record<string, unknown> | undefined) {
  const x = Number(viewport?.x);
  const y = Number(viewport?.y);
  const zoom = Number(viewport?.zoom);

  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    zoom: Number.isFinite(zoom) ? zoom : 1,
  };
}

export function viewportMatches(
  left: { x: number; y: number; zoom: number },
  right: { x: number; y: number; zoom: number },
) {
  return (
    Math.abs(left.x - right.x) < 0.5 &&
    Math.abs(left.y - right.y) < 0.5 &&
    Math.abs(left.zoom - right.zoom) < 0.001
  );
}
