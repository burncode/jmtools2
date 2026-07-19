import type { WorkflowDefinition, WorkflowGroup, WorkflowNode } from "./types";

import {
  LAYOUT_GROUP_HEADER,
  LAYOUT_GROUP_PADDING,
  LAYOUT_NODE_HEIGHT,
  LAYOUT_NODE_WIDTH,
} from "./workflowGroupLayout";

const GROUP_PADDING = LAYOUT_GROUP_PADDING;
const GROUP_HEADER_HEIGHT = LAYOUT_GROUP_HEADER;
const DEFAULT_GROUP_WIDTH = 320;
const DEFAULT_GROUP_HEIGHT = 240;

export function getGroupMemberIds(definition: WorkflowDefinition, groupId: string) {
  return definition.nodes.filter((node) => node.parentGroupId === groupId).map((node) => node.id);
}

export function createGroupFromSelection(definition: WorkflowDefinition, nodeIds: string[]): WorkflowDefinition {
  const uniqueIds = [...new Set(nodeIds)].filter((nodeId) => {
    const node = definition.nodes.find((item) => item.id === nodeId);
    return node && !node.parentGroupId;
  });

  if (uniqueIds.length < 2) {
    return definition;
  }

  const selectedNodes = definition.nodes.filter((node) => uniqueIds.includes(node.id));
  const bounds = computeAbsoluteBounds(definition, selectedNodes);
  const groupId = `group-${Date.now()}`;
  const groupPosition = {
    x: Math.round(bounds.minX - GROUP_PADDING),
    y: Math.round(bounds.minY - GROUP_PADDING - GROUP_HEADER_HEIGHT),
  };
  const group: WorkflowGroup = {
    collapsed: false,
    id: groupId,
    label: "编组",
    position: groupPosition,
    size: {
      height: Math.max(DEFAULT_GROUP_HEIGHT, Math.round(bounds.height + GROUP_PADDING * 2 + GROUP_HEADER_HEIGHT)),
      width: Math.max(DEFAULT_GROUP_WIDTH, Math.round(bounds.width + GROUP_PADDING * 2)),
    },
  };

  const nextNodes = definition.nodes.map((node) => {
    if (!uniqueIds.includes(node.id)) {
      return node;
    }

    const absolute = getAbsoluteNodePosition(definition, node);

    return {
      ...node,
      parentGroupId: groupId,
      position: {
        x: Math.round(absolute.x - groupPosition.x),
        y: Math.round(absolute.y - groupPosition.y),
      },
    };
  });

  return {
    ...definition,
    groups: [...(definition.groups ?? []), group],
    nodes: nextNodes,
  };
}

export function ungroup(definition: WorkflowDefinition, groupId: string): WorkflowDefinition {
  const group = definition.groups?.find((item) => item.id === groupId);

  if (!group) {
    return definition;
  }

  const nextNodes = definition.nodes.map((node) => {
    if (node.parentGroupId !== groupId) {
      return node;
    }

    const absolute = {
      x: Math.round(group.position.x + node.position.x),
      y: Math.round(group.position.y + node.position.y),
    };

    const { parentGroupId: _removed, ...rest } = node;

    return {
      ...rest,
      position: absolute,
    };
  });

  return {
    ...definition,
    groups: (definition.groups ?? []).filter((item) => item.id !== groupId),
    nodes: nextNodes,
  };
}

export function topologicalOrderWithinGroup(definition: WorkflowDefinition, groupId: string) {
  const memberIds = new Set(getGroupMemberIds(definition, groupId));
  const memberNodes = definition.nodes.filter((node) => memberIds.has(node.id));
  const memberEdges = definition.edges.filter(
    (edge) => memberIds.has(edge.fromNodeId) && memberIds.has(edge.toNodeId),
  );

  const indegrees = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const node of memberNodes) {
    indegrees.set(node.id, 0);
    outgoing.set(node.id, []);
  }

  for (const edge of memberEdges) {
    indegrees.set(edge.toNodeId, (indegrees.get(edge.toNodeId) ?? 0) + 1);
    outgoing.get(edge.fromNodeId)?.push(edge.toNodeId);
  }

  const queue = memberNodes
    .filter((node) => (indegrees.get(node.id) ?? 0) === 0)
    .map((node) => node.id);
  const order: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (!nodeId) {
      break;
    }

    order.push(nodeId);

    for (const nextNodeId of outgoing.get(nodeId) ?? []) {
      const nextIndegree = (indegrees.get(nextNodeId) ?? 0) - 1;
      indegrees.set(nextNodeId, nextIndegree);

      if (nextIndegree === 0) {
        queue.push(nextNodeId);
      }
    }
  }

  if (order.length !== memberNodes.length) {
    return memberNodes.map((node) => node.id);
  }

  return order;
}

function computeAbsoluteBounds(definition: WorkflowDefinition, nodes: WorkflowNode[]) {
  const positions = nodes.map((node) => getAbsoluteNodePosition(definition, node));
  const minX = Math.min(...positions.map((position) => position.x));
  const minY = Math.min(...positions.map((position) => position.y));
  const maxX = Math.max(...positions.map((position) => position.x + LAYOUT_NODE_WIDTH));
  const maxY = Math.max(...positions.map((position) => position.y + LAYOUT_NODE_HEIGHT));

  return {
    height: maxY - minY,
    maxX,
    maxY,
    minX,
    minY,
    width: maxX - minX,
  };
}

function getAbsoluteNodePosition(definition: WorkflowDefinition, node: WorkflowNode) {
  if (!node.parentGroupId) {
    return node.position;
  }

  const parentGroup = definition.groups?.find((group) => group.id === node.parentGroupId);

  if (!parentGroup) {
    return node.position;
  }

  return {
    x: parentGroup.position.x + node.position.x,
    y: parentGroup.position.y + node.position.y,
  };
}
