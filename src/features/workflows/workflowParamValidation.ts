import type { WorkflowDefinition, WorkflowNode, WorkflowParamDefinition } from "./types";

import {
  shouldRenderWorkflowParamFieldForNode,
  shouldSkipWorkflowParamValidation,
} from "./workflowLayoutModes";

export function getWorkflowParamValue(node: WorkflowNode, field: WorkflowParamDefinition) {
  return node.params[field.id] ?? field.defaultValue ?? "";
}

export function validateWorkflowParam(
  node: WorkflowNode,
  field: WorkflowParamDefinition,
  definition?: WorkflowDefinition,
): string | undefined {
  if (definition && shouldSkipWorkflowParamValidation(node, field.id, definition)) {
    return undefined;
  }

  const value = getWorkflowParamValue(node, field);
  const isEmpty =
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);

  if (field.required && isEmpty) {
    return `${field.label}不能为空。`;
  }

  if (typeof value === "string" && field.validate?.pattern) {
    const pattern = new RegExp(field.validate.pattern);

    if (!pattern.test(value)) {
      return `${field.label}格式不正确。`;
    }
  }

  if (field.type === "number" && typeof value === "number") {
    if (field.min !== undefined && value < field.min) {
      return `${field.label}不能小于 ${field.min}。`;
    }

    if (field.max !== undefined && value > field.max) {
      return `${field.label}不能大于 ${field.max}。`;
    }
  }

  return undefined;
}

export function validateWorkflowNodeParams(
  node: WorkflowNode,
  fields: WorkflowParamDefinition[],
  definition?: WorkflowDefinition,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const error = validateWorkflowParam(node, field, definition);

    if (error) {
      errors[field.id] = error;
    }
  }

  return errors;
}

export function resolveParamWidget(field: WorkflowParamDefinition) {
  if (field.widget) {
    return field.widget;
  }

  if (field.id === "prompt" || field.id === "negativePrompt") {
    return "textarea" as const;
  }

  if (field.id === "path") {
    return "projectPath" as const;
  }

  if (field.id === "characterId") {
    return "characterRef" as const;
  }

  return "text" as const;
}

export function shouldRenderWorkflowParamField(
  field: WorkflowParamDefinition,
  node?: WorkflowNode,
  definition?: WorkflowDefinition,
): boolean {
  if (node && definition) {
    return shouldRenderWorkflowParamFieldForNode(node, field, definition);
  }

  if (field.advanced || field.widget === "runId") {
    return false;
  }

  if (field.id === "model" && field.widget !== "text") {
    return false;
  }

  if (field.widget === "candidatePlanPicker") {
    return false;
  }

  return true;
}
