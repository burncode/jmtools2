import type { WorkflowDefinition, WorkflowGroup, WorkflowNode } from "./types";

import { autoLayoutWorkflow } from "./workflowAutoLayout";

export const LAYOUT_NODE_WIDTH = 260;
export const LAYOUT_NODE_HEIGHT = 180;
export const LAYOUT_NODE_GAP_X = 48;
export const LAYOUT_NODE_GAP_Y = 32;
export const LAYOUT_GROUP_PADDING = 48;
export const LAYOUT_GROUP_HEADER = 40;
export const LAYOUT_GROUP_GAP_X = 64;
export const LAYOUT_GROUP_GAP_Y = 48;
export const LAYOUT_ORIGIN_X = 40;
export const LAYOUT_ORIGIN_Y = 40;

export function fitGroupToChildren(group: WorkflowGroup, memberNodes: WorkflowNode[]): WorkflowGroup {
  if (memberNodes.length === 0) {
    return group;
  }

  const minX = Math.min(...memberNodes.map((node) => node.position.x));
  const minY = Math.min(...memberNodes.map((node) => node.position.y));
  const maxX = Math.max(...memberNodes.map((node) => node.position.x + LAYOUT_NODE_WIDTH));
  const maxY = Math.max(...memberNodes.map((node) => node.position.y + LAYOUT_NODE_HEIGHT));

  return {
    ...group,
    size: {
      height: Math.max(240, Math.round(maxY - minY + LAYOUT_GROUP_HEADER + LAYOUT_GROUP_PADDING * 2)),
      width: Math.max(320, Math.round(maxX - minX + LAYOUT_GROUP_PADDING * 2)),
    },
  };
}

function layoutGroupMembers(
  definition: WorkflowDefinition,
  group: WorkflowGroup,
  layoutOptions?: import("./workflowAutoLayout").AutoLayoutOptions,
): { group: WorkflowGroup; nodes: WorkflowNode[] } {
  const memberIds = new Set(definition.nodes.filter((node) => node.parentGroupId === group.id).map((node) => node.id));

  if (memberIds.size === 0) {
    return { group, nodes: definition.nodes };
  }

  const memberNodes = definition.nodes.filter((node) => memberIds.has(node.id));
  const memberEdges = definition.edges.filter(
    (edge) => memberIds.has(edge.fromNodeId) && memberIds.has(edge.toNodeId),
  );
  const subDefinition: WorkflowDefinition = {
    ...definition,
    edges: memberEdges,
    nodes: memberNodes,
  };
  const laidOut = autoLayoutWorkflow(subDefinition, [...memberIds], layoutOptions);
  const laidOutMembers = laidOut.nodes.filter((node) => memberIds.has(node.id));

  const minX = Math.min(...laidOutMembers.map((node) => node.position.x));
  const minY = Math.min(...laidOutMembers.map((node) => node.position.y));
  const offsetX = LAYOUT_GROUP_PADDING;
  const offsetY = LAYOUT_GROUP_HEADER + LAYOUT_GROUP_PADDING;

  const positionedMembers = laidOutMembers.map((node) => ({
    ...node,
    position: {
      x: Math.round(node.position.x - minX + offsetX),
      y: Math.round(node.position.y - minY + offsetY),
    },
  }));

  const positionedMap = new Map(positionedMembers.map((node) => [node.id, node]));
  const nextNodes = definition.nodes.map((node) => positionedMap.get(node.id) ?? node);
  const fittedGroup = fitGroupToChildren(group, positionedMembers);

  return { group: fittedGroup, nodes: nextNodes };
}

function arrangeGroups(groups: WorkflowGroup[]): WorkflowGroup[] {
  let cursorX = LAYOUT_ORIGIN_X;
  let cursorY = LAYOUT_ORIGIN_Y;
  let rowHeight = 0;

  return groups.map((group) => {
    if (cursorX > LAYOUT_ORIGIN_X && cursorX + group.size.width > 2800) {
      cursorX = LAYOUT_ORIGIN_X;
      cursorY += rowHeight + LAYOUT_GROUP_GAP_Y;
      rowHeight = 0;
    }

    const positionedGroup = {
      ...group,
      position: { x: cursorX, y: cursorY },
    };

    cursorX += group.size.width + LAYOUT_GROUP_GAP_X;
    rowHeight = Math.max(rowHeight, group.size.height);
    return positionedGroup;
  });
}

export function layoutSingleWorkflowGroup(definition: WorkflowDefinition, groupId: string): WorkflowDefinition {
  const group = (definition.groups ?? []).find((item) => item.id === groupId);
  if (!group) {
    return definition;
  }

  const result = layoutGroupMembers(definition, group);
  const nextGroups = (definition.groups ?? []).map((item) => (item.id === groupId ? result.group : item));

  return {
    ...definition,
    groups: nextGroups,
    nodes: result.nodes,
  };
}

export function autoLayoutGroupedWorkflow(definition: WorkflowDefinition): WorkflowDefinition {
  const groups = definition.groups ?? [];

  if (groups.length === 0) {
    return autoLayoutWorkflow(definition);
  }

  let nextNodes = definition.nodes;
  let nextGroups: WorkflowGroup[] = [];

  for (const group of groups) {
    const result = layoutGroupMembers({ ...definition, nodes: nextNodes }, group);
    nextNodes = result.nodes;
    nextGroups.push(result.group);
  }

  const ungroupedIds = nextNodes.filter((node) => !node.parentGroupId).map((node) => node.id);
  if (ungroupedIds.length > 0) {
    const laidOut = autoLayoutWorkflow(
      {
        ...definition,
        nodes: nextNodes.filter((node) => ungroupedIds.includes(node.id)),
      },
      ungroupedIds,
    );
    const laidOutMap = new Map(laidOut.nodes.map((node) => [node.id, node]));
    nextNodes = nextNodes.map((node) => laidOutMap.get(node.id) ?? node);
  }

  nextGroups = arrangeGroups(nextGroups);

  return {
    ...definition,
    groups: nextGroups,
    nodes: nextNodes,
  };
}

export function applyWorkflowGroupedLayout(definition: WorkflowDefinition): WorkflowDefinition {
  return autoLayoutGroupedWorkflow(definition);
}
