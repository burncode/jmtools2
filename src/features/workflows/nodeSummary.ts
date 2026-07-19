import type { WorkflowNode, WorkflowNodeDefinition } from "./types";
import { getStyleProfileNodeSummary } from "./styleProfileNodeSummary";

export function getWorkflowNodeParamSummary(node: WorkflowNode, definition?: WorkflowNodeDefinition) {
  if (!definition) {
    return "未配置节点";
  }

  if (node.kind === "character.styleProfile") {
    return getStyleProfileNodeSummary(node);
  }

  if (!definition.paramsSchema.length) {
    return definition.description.length > 36 ? `${definition.description.slice(0, 36)}…` : definition.description;
  }

  const primaryField =
    definition.paramsSchema.find((field) => {
      const value = node.params[field.id];
      return value !== undefined && value !== "";
    }) ?? definition.paramsSchema[0];

  const rawValue = node.params[primaryField.id];

  if (rawValue === undefined || rawValue === "") {
    return `未设置${primaryField.label}`;
  }

  if (primaryField.type === "select" && primaryField.options) {
    const matchedOption = primaryField.options.find((option) => option.value === rawValue);
    return matchedOption ? `${primaryField.label}：${matchedOption.label}` : `${primaryField.label}：${String(rawValue)}`;
  }

  if (primaryField.type === "boolean") {
    return `${primaryField.label}：${rawValue ? "是" : "否"}`;
  }

  const textValue = String(rawValue);
  const truncatedValue = textValue.length > 28 ? `${textValue.slice(0, 28)}…` : textValue;

  return `${primaryField.label}：${truncatedValue}`;
}
