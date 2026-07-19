import type { WorkflowNodeDefinition } from "./types";

export function buildDefaultNodeParams(definition: WorkflowNodeDefinition | undefined) {
  if (!definition) {
    return {};
  }

  return Object.fromEntries(
    definition.paramsSchema.map((param) => {
      if (param.defaultValue !== undefined) {
        return [param.id, param.defaultValue];
      }

      switch (param.type) {
        case "boolean":
          return [param.id, false];
        case "number":
          return [param.id, param.min ?? 0];
        case "select":
          return [param.id, param.options?.[0]?.value ?? ""];
        default:
          return [param.id, ""];
      }
    }),
  );
}
