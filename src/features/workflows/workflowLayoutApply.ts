import type { AutoLayoutOptions } from "./workflowAutoLayout";
import type { WorkflowDefinition } from "./types";

import { autoLayoutGroupedWorkflow, layoutSingleWorkflowGroup } from "./workflowGroupLayout";
import { autoLayoutWorkflow } from "./workflowAutoLayout";
import type { WorkflowLayoutMode } from "./workflowLayoutModes";

const COMPACT_LAYOUT_OPTIONS: AutoLayoutOptions = {
  columnGap: 220,
  direction: "horizontal",
  originX: 80,
  originY: 80,
  rowGap: 160,
};

const VERTICAL_LAYOUT_OPTIONS: AutoLayoutOptions = {
  direction: "vertical",
};

export function applyWorkflowLayoutMode(
  definition: WorkflowDefinition,
  mode: WorkflowLayoutMode,
  options?: {
    selectedGroupId?: string;
    selectedNodeIds?: string[];
  },
): WorkflowDefinition {
  const selectedNodeIds = options?.selectedNodeIds?.filter((nodeId) =>
    definition.nodes.some((node) => node.id === nodeId),
  );

  switch (mode) {
    case "grouped":
      return autoLayoutGroupedWorkflow(definition);
    case "horizontal":
      return autoLayoutWorkflow(
        definition,
        selectedNodeIds && selectedNodeIds.length > 0 ? selectedNodeIds : undefined,
      );
    case "vertical":
      return autoLayoutWorkflow(
        definition,
        selectedNodeIds && selectedNodeIds.length > 0 ? selectedNodeIds : undefined,
        VERTICAL_LAYOUT_OPTIONS,
      );
    case "compact":
      return autoLayoutWorkflow(
        definition,
        selectedNodeIds && selectedNodeIds.length > 0 ? selectedNodeIds : undefined,
        COMPACT_LAYOUT_OPTIONS,
      );
    case "currentGroup": {
      const groupId = options?.selectedGroupId;
      if (!groupId) {
        return definition;
      }

      return layoutSingleWorkflowGroup(definition, groupId);
    }
    default:
      return definition;
  }
}
