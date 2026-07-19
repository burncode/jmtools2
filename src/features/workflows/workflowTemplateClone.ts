import type { WorkflowDefinition, WorkflowTemplate } from "./types";

const templateDefinitionCache = new Map<string, WorkflowDefinition>();

export function cloneWorkflowTemplateDefinition(template: WorkflowTemplate): WorkflowDefinition {
  let cachedDefinition = templateDefinitionCache.get(template.id);

  if (!cachedDefinition) {
    cachedDefinition = structuredClone(template.definition);
    templateDefinitionCache.set(template.id, cachedDefinition);
  }

  return structuredClone(cachedDefinition);
}
