import { NodeToolbar, Position } from "@xyflow/react";
import { ChevronDown, ChevronRight, FolderOutput, LayoutTemplate, Pencil, Play, Ungroup } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type { WorkflowGroup } from "./types";
import { runWorkflowGroup } from "./workflowCanvasCallbacks";
import { ungroup } from "./workflowGrouping";
import { applyWorkflowLayoutMode } from "./workflowLayoutApply";
import { WORKFLOW_LAYOUT_MODE_OPTIONS } from "./workflowLayoutModes";
import { useWorkflowStore } from "./workflowStore";

interface WorkflowGroupToolbarProps {
  group: WorkflowGroup;
  selected: boolean;
}

export function WorkflowGroupToolbar({ group, selected }: WorkflowGroupToolbarProps) {
  const patchWorkflowGroup = useWorkflowStore((state) => state.patchWorkflowGroup);
  const updateCurrentWorkflow = useWorkflowStore((state) => state.updateCurrentWorkflow);
  const currentWorkflow = useWorkflowStore((state) => state.currentWorkflow);
  const [renameOpen, setRenameOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [draftLabel, setDraftLabel] = useState(group.label);

  function toggleCollapsed() {
    patchWorkflowGroup(group.id, { collapsed: !group.collapsed });
  }

  function handleUngroup() {
    if (!currentWorkflow) {
      return;
    }

    updateCurrentWorkflow(ungroup(currentWorkflow, group.id));
  }

  function handleRenameConfirm() {
    const nextLabel = draftLabel.trim();

    if (nextLabel) {
      patchWorkflowGroup(group.id, { label: nextLabel });
    }

    setRenameOpen(false);
  }

  function handleLayout(mode: (typeof WORKFLOW_LAYOUT_MODE_OPTIONS)[number]["id"]) {
    if (!currentWorkflow) {
      return;
    }

    updateCurrentWorkflow(
      applyWorkflowLayoutMode(currentWorkflow, mode, {
        selectedGroupId: group.id,
      }),
    );
    setLayoutOpen(false);
  }

  return (
    <NodeToolbar align="center" className="workflow-node-toolbar workflow-group-toolbar" isVisible={selected} offset={8} position={Position.Top}>
      <Button
        aria-label="运行编组"
        className="workflow-node-toolbar-button workflow-group-toolbar-run"
        onClick={() => runWorkflowGroup(group.id)}
        size="icon-sm"
        title="运行编组"
        type="button"
        variant="ghost"
      >
        <Play aria-hidden="true" />
      </Button>

      <Popover onOpenChange={setLayoutOpen} open={layoutOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-label="自动排布"
            className="workflow-node-toolbar-button"
            size="icon-sm"
            title="自动排布"
            type="button"
            variant="ghost"
          >
            <LayoutTemplate aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" className="workflow-group-layout-popover" side="top">
          <p className="workflow-node-color-popover-title">自动排布</p>
          <div className="workflow-group-layout-options">
            {WORKFLOW_LAYOUT_MODE_OPTIONS.map((option) => (
              <button
                className="workflow-group-layout-option"
                key={option.id}
                onClick={() => handleLayout(option.id)}
                type="button"
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover onOpenChange={setRenameOpen} open={renameOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-label="重命名编组"
            className="workflow-node-toolbar-button"
            onClick={() => setDraftLabel(group.label)}
            size="icon-sm"
            title="重命名"
            type="button"
            variant="ghost"
          >
            <Pencil aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" className="workflow-group-rename-popover" side="top">
          <p className="workflow-node-color-popover-title">编组名称</p>
          <Input onChange={(event) => setDraftLabel(event.target.value)} value={draftLabel} />
          <div className="workflow-group-rename-actions">
            <Button onClick={() => setRenameOpen(false)} size="sm" type="button" variant="ghost">
              取消
            </Button>
            <Button onClick={handleRenameConfirm} size="sm" type="button">
              确定
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        aria-label={group.collapsed ? "展开编组" : "折叠编组"}
        className="workflow-node-toolbar-button"
        onClick={toggleCollapsed}
        size="icon-sm"
        title={group.collapsed ? "展开" : "折叠"}
        type="button"
        variant="ghost"
      >
        {group.collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </Button>

      <Button
        aria-label="解组"
        className="workflow-node-toolbar-button"
        onClick={handleUngroup}
        size="icon-sm"
        title="解组"
        type="button"
        variant="ghost"
      >
        <Ungroup aria-hidden="true" />
      </Button>

      <span aria-hidden="true" className="workflow-group-toolbar-icon">
        <FolderOutput />
      </span>
    </NodeToolbar>
  );
}
