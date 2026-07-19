import { NodeToolbar, Position } from "@xyflow/react";
import { ChevronDown, ChevronRight, Palette } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useWorkflowStore } from "./workflowStore";
import { WORKFLOW_NODE_COLOR_PRESETS } from "./workflowNodeColors";

interface WorkflowNodeToolbarProps {
  accentColor?: string;
  collapsed: boolean;
  nodeId: string;
  selected: boolean;
}

export function WorkflowNodeToolbar({ accentColor, collapsed, nodeId, selected }: WorkflowNodeToolbarProps) {
  const patchWorkflowNode = useWorkflowStore((state) => state.patchWorkflowNode);
  const [colorOpen, setColorOpen] = useState(false);

  function toggleCollapsed() {
    patchWorkflowNode(nodeId, { collapsed: !collapsed });
  }

  function setAccentColor(accentColor: string) {
    patchWorkflowNode(nodeId, { accentColor: accentColor || undefined });
  }

  return (
    <NodeToolbar align="center" className="workflow-node-toolbar" isVisible={selected} offset={8} position={Position.Top}>
      <Button
        aria-label={collapsed ? "展开节点" : "折叠节点"}
        className="workflow-node-toolbar-button"
        onClick={toggleCollapsed}
        size="icon-sm"
        title={collapsed ? "展开" : "折叠"}
        type="button"
        variant="ghost"
      >
        {collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </Button>

      <Popover onOpenChange={setColorOpen} open={colorOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-label="节点颜色"
            className="workflow-node-toolbar-button"
            size="icon-sm"
            title="节点颜色"
            type="button"
            variant="ghost"
          >
            <Palette aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        {colorOpen ? (
          <PopoverContent align="center" className="workflow-node-color-popover" side="top">
            <p className="workflow-node-color-popover-title">节点颜色</p>
            <div className="workflow-node-color-grid">
              {WORKFLOW_NODE_COLOR_PRESETS.map((preset) => (
                <button
                  aria-label={preset.label}
                  className="workflow-node-color-swatch"
                  data-active={preset.value === (accentColor ?? "") ? "true" : "false"}
                  key={preset.id}
                  onClick={() => setAccentColor(preset.value)}
                  style={preset.value ? { backgroundColor: preset.value } : undefined}
                  title={preset.label}
                  type="button"
                >
                  {preset.value ? null : <span className="workflow-node-color-default">默认</span>}
                </button>
              ))}
            </div>
          </PopoverContent>
        ) : null}
      </Popover>
    </NodeToolbar>
  );
}
