import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";

import { getWorkflowNodeParamSummary } from "./nodeSummary";
import { StyleProfileNodeSummary } from "./styleProfileNodeSummary";
import type { WorkflowNode, WorkflowNodeDefinition, WorkflowNodeRun } from "./types";
import { getWorkflowNodeRunStatusLabel } from "./workflowLabels";
import { resolveEffectiveNodeStatus } from "./workflowRunStatus";
import { getWorkflowNodeShortId } from "./workflowNodeColors";
import { WorkflowNodeInlinePreview } from "./WorkflowNodeInlinePreview";
import { WorkflowNodeProgress } from "./WorkflowNodeProgress";
import { WorkflowNodeToolbar } from "./WorkflowNodeToolbar";
import { resolveActionSequencePreviewAssets } from "./workflowActionSequencePreview";
import { WorkflowNodeActionSequencePreview } from "./components/WorkflowNodeActionSequencePreview";
import { resolveNodePreviewAssets, isImagePreviewCapableKind, resolveUpstreamCandidateAssets } from "./workflowPreviewAssets";
import { WorkflowNodeCandidateStrip } from "./components/WorkflowNodeCandidateStrip";
import { WorkflowNodeInlineFields } from "./components/WorkflowNodeInlineFields";
import { useWorkflowStore } from "./workflowStore";

export interface WorkflowNodeCardData extends Record<string, unknown> {
  definition?: WorkflowNodeDefinition;
  node: WorkflowNode;
  run?: WorkflowNodeRun;
}

export function WorkflowNodeCard({ data, id, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeCardData;
  const { definition, node, run } = nodeData;
  const patchWorkflowNode = useWorkflowStore((state) => state.patchWorkflowNode);
  const projectRoot = useWorkflowStore((state) => state.projectRoot);
  const currentWorkflow = useWorkflowStore((state) => state.currentWorkflow);
  const selectedRun = useWorkflowStore((state) => state.selectedRun);
  const status = useMemo(() => {
    if (!currentWorkflow || !selectedRun) {
      return run?.status ?? "queued";
    }

    return resolveEffectiveNodeStatus(node.id, selectedRun.nodeRuns, currentWorkflow.edges, selectedRun.status);
  }, [currentWorkflow, node.id, run?.status, selectedRun]);
  const rawStatus = run?.status ?? "queued";
  const collapsed = Boolean(node.collapsed);
  const summary = getWorkflowNodeParamSummary(node, definition);
  const isStyleProfileNode = node.kind === "character.styleProfile";
  const inputs = definition?.inputs ?? [];
  const outputs = definition?.outputs ?? [];
  const customAccentColor = node.accentColor?.trim() || undefined;
  const isActionSequenceNode = node.kind === "preview.actionSequence";
  const previewAssets = useMemo(
    () => resolveNodePreviewAssets(run?.outputs as Record<string, unknown> | undefined, node.kind),
    [node.kind, run?.outputs],
  );
  const actionSequenceAssets = useMemo(
    () =>
      isActionSequenceNode
        ? resolveActionSequencePreviewAssets(run?.outputs as Record<string, unknown> | undefined, node.params)
        : null,
    [isActionSequenceNode, node.params, run?.outputs],
  );
  const showInlinePreview =
    !collapsed &&
    !run?.error &&
    rawStatus === "succeeded" &&
    !isActionSequenceNode &&
    previewAssets.kind !== "empty";
  const showPreviewPlaceholder =
    !collapsed &&
    !run?.error &&
    rawStatus === "succeeded" &&
    !isActionSequenceNode &&
    previewAssets.kind === "empty" &&
    isImagePreviewCapableKind(node.kind);
  const showActionSequencePreview =
    !collapsed &&
    !run?.error &&
    rawStatus === "succeeded" &&
    isActionSequenceNode &&
    actionSequenceAssets?.kind === "sequence";
  const showActionSequencePlaceholder =
    !collapsed &&
    !run?.error &&
    rawStatus === "succeeded" &&
    isActionSequenceNode &&
    actionSequenceAssets?.kind === "empty";
  const upstreamCandidateAssets = useMemo(
    () =>
      node.kind === "character.create" && currentWorkflow
        ? resolveUpstreamCandidateAssets(currentWorkflow, node.id, selectedRun)
        : { images: [], kind: "empty" as const },
    [currentWorkflow, node.id, node.kind, selectedRun],
  );
  const showCandidateStrip =
    !collapsed &&
    node.kind === "character.create" &&
    upstreamCandidateAssets.kind !== "empty";

  function patchNodeParam(key: string, value: unknown) {
    patchWorkflowNode(node.id, {
      params: {
        ...node.params,
        [key]: value,
      },
    });
  }

  function selectCandidatePlan(planId: string) {
    patchNodeParam("selectedPlanId", planId);
  }

  function toggleCollapsed() {
    patchWorkflowNode(node.id, { collapsed: !collapsed });
  }

  return (
    <>
      <WorkflowNodeToolbar accentColor={node.accentColor} collapsed={collapsed} nodeId={id} selected={selected} />
      <article
        className="workflow-node-card"
        data-collapsed={collapsed ? "true" : "false"}
        data-has-custom-accent={customAccentColor ? "true" : "false"}
        data-selected={selected}
        data-status={status}
        style={customAccentColor ? { ["--workflow-node-accent" as string]: customAccentColor } : undefined}
      >
        <header className="workflow-node-card-header" title={node.id}>
          <div className="workflow-node-card-header-main">
            <Button
              aria-label={collapsed ? "展开节点" : "折叠节点"}
              className="workflow-node-collapse-button"
              onClick={toggleCollapsed}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              {collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            </Button>
            <strong className="workflow-type-section">{definition?.label ?? node.kind}</strong>
          </div>
          <span className="workflow-node-status-badge" data-status={status}>
            <span aria-hidden="true" className="workflow-node-status-dot" />
            {getWorkflowNodeRunStatusLabel(status)}
          </span>
        </header>

        {collapsed ? (
          <div className="workflow-node-card-collapsed-handles">
            {inputs.map((port) => (
              <Handle id={port.id} key={port.id} position={Position.Left} type="target" />
            ))}
            {outputs.map((port) => (
              <Handle id={port.id} key={port.id} position={Position.Right} type="source" />
            ))}
          </div>
        ) : null}

        {!collapsed && (inputs.length || outputs.length) ? (
          <div className="workflow-node-card-ports">
            {inputs.map((port) => (
              <div className="workflow-node-port workflow-node-port-input" data-port-kind={port.kind} key={port.id} title={port.kind}>
                <Handle id={port.id} position={Position.Left} type="target" />
                <span className="workflow-type-caption">{port.label}</span>
              </div>
            ))}
            {outputs.map((port) => (
              <div className="workflow-node-port workflow-node-port-output" data-port-kind={port.kind} key={port.id} title={port.kind}>
                <span className="workflow-type-caption">{port.label}</span>
                <Handle id={port.id} position={Position.Right} type="source" />
              </div>
            ))}
          </div>
        ) : null}

        {!collapsed && !run?.error && isStyleProfileNode ? <StyleProfileNodeSummary node={node} /> : null}

        {!collapsed && definition?.paramsSchema.some((field) => field.display === "inline") ? (
          <WorkflowNodeInlineFields definition={definition} node={node} onParamChange={patchNodeParam} />
        ) : null}

        {showCandidateStrip ? (
          <WorkflowNodeCandidateStrip
            assets={upstreamCandidateAssets}
            onSelect={selectCandidatePlan}
            projectRoot={projectRoot}
            selectedPlanId={String(node.params.selectedPlanId ?? "")}
          />
        ) : null}

        {showActionSequencePreview && actionSequenceAssets ? (
          <WorkflowNodeActionSequencePreview assets={actionSequenceAssets} projectRoot={projectRoot} />
        ) : null}

        {showActionSequencePlaceholder ? (
          <p className="workflow-node-inline-preview-empty">暂无动作帧预览</p>
        ) : null}

        {showInlinePreview ? (
          <WorkflowNodeInlinePreview assets={previewAssets} projectRoot={projectRoot} />
        ) : null}

        {showPreviewPlaceholder ? (
          <p className="workflow-node-inline-preview-empty">暂无预览</p>
        ) : null}

        {!collapsed && !run?.error && !isStyleProfileNode && summary && !showInlinePreview && !showActionSequencePreview ? (
          <p className="workflow-node-card-summary workflow-type-caption">{summary}</p>
        ) : null}

        {!collapsed && run?.error ? (
          <div className="workflow-node-card-error-banner" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>{run.error}</span>
          </div>
        ) : null}
        {!collapsed ? <WorkflowNodeProgress progress={run?.progress} status={status} /> : null}
        {!collapsed && !run?.error && run?.outputSummary && !showInlinePreview && !showActionSequencePreview ? (
          <p className="workflow-node-card-footnote workflow-type-body">{run.outputSummary}</p>
        ) : null}

        <footer className="workflow-node-card-id-badge">{getWorkflowNodeShortId(node.id)}</footer>
      </article>
    </>
  );
}
