import { getWorkflowNodeDefinition } from "./nodeCatalog";
import type { WorkflowDefinition } from "./types";
import { shouldRenderWorkflowParamField, validateWorkflowNodeParams } from "./workflowParamValidation";

export interface WorkflowRunValidationResult {
  blockingReasons: string[];
  canRun: boolean;
}

export function validateWorkflowForRun(definition: WorkflowDefinition): WorkflowRunValidationResult {
  const blockingReasons: string[] = [];

  if (definition.nodes.length === 0) {
    blockingReasons.push("工作流至少需要一个节点。");
  }

  const nodeIds = new Set(definition.nodes.map((node) => node.id));

  for (const edge of definition.edges) {
    if (!nodeIds.has(edge.fromNodeId)) {
      blockingReasons.push(`连线「${edge.id}」引用了不存在的起点节点。`);
    }

    if (!nodeIds.has(edge.toNodeId)) {
      blockingReasons.push(`连线「${edge.id}」引用了不存在的终点节点。`);
    }
  }

  for (const node of definition.nodes) {
    const nodeDefinition = getWorkflowNodeDefinition(node.kind);

    if (!nodeDefinition) {
      blockingReasons.push(`未知节点类型：${node.kind}（${node.id}）。`);
      continue;
    }

    if (nodeDefinition.status !== "available") {
      blockingReasons.push(`节点「${nodeDefinition.label}」尚未启用。`);
    }

    const visibleFields = (nodeDefinition.paramsSchema ?? []).filter((field) =>
      shouldRenderWorkflowParamField(field, node, definition),
    );
    const paramErrors = validateWorkflowNodeParams(node, visibleFields, definition);

    for (const message of Object.values(paramErrors)) {
      blockingReasons.push(`${nodeDefinition.label}（${node.id}）：${message}`);
    }
  }

  return {
    blockingReasons,
    canRun: blockingReasons.length === 0,
  };
}

export function getPrimaryRunBlockingReason(result: WorkflowRunValidationResult) {
  return result.blockingReasons[0] ?? "";
}
