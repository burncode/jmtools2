import type { WorkflowDefinition } from "./types";

export function createBlankWorkflow(): WorkflowDefinition {
  return {
    description: "新的本地节点工作流。",
    edges: [],
    id: `workflow-${Date.now()}`,
    name: "未命名工作流",
    nodes: [],
    schemaVersion: 1,
    uiState: { logOpen: false },
  };
}
