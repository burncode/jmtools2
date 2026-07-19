import type { NodeProps } from "@xyflow/react";
import { NodeResizer } from "@xyflow/react";

import type { WorkflowGroup } from "./types";
import { WorkflowGroupToolbar } from "./WorkflowGroupToolbar";
import { useWorkflowStore } from "./workflowStore";

export interface WorkflowGroupNodeData extends Record<string, unknown> {
  group: WorkflowGroup;
}

export function WorkflowGroupNode({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowGroupNodeData;
  const { group } = nodeData;
  const patchWorkflowGroup = useWorkflowStore((state) => state.patchWorkflowGroup);

  return (
    <>
      <WorkflowGroupToolbar group={group} selected={selected} />
      <NodeResizer
        handleClassName="workflow-group-resizer-handle"
        lineClassName="workflow-group-resizer-line"
        minHeight={120}
        minWidth={180}
        onResizeEnd={(_, params) => {
          patchWorkflowGroup(group.id, {
            size: {
              height: Math.round(params.height),
              width: Math.round(params.width),
            },
          });
        }}
      />
      <article
        className="workflow-group-node"
        data-collapsed={group.collapsed ? "true" : "false"}
        data-selected={selected}
        style={group.color ? { ["--workflow-group-accent" as string]: group.color } : undefined}
      >
        <header className="workflow-group-node-header">
          <strong className="workflow-type-section">{group.label}</strong>
        </header>
        {!group.collapsed ? <div aria-hidden="true" className="workflow-group-node-body" /> : null}
      </article>
    </>
  );
}
