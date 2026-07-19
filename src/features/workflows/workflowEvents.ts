import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import { appLogger } from "@/lib/logger";

import type { WorkflowNodeRun, WorkflowRun } from "./types";

export interface WorkflowRunEventPayload {
  runId: string;
  workflowId: string;
}

export interface WorkflowNodeEventPayload {
  error: string;
  nodeId: string;
  nodeKind: string;
  outputSummary: string;
  outputs?: Record<string, unknown>;
  progress?: number;
  runId: string;
  status: string;
  workflowId: string;
}

export interface WorkflowManualOption {
  label: string;
  value: string;
}

export interface WorkflowManualPreviewImage {
  absolutePath?: string;
  label?: string;
  planId: string;
  projectRelativePath?: string;
}

export interface WorkflowNodeInputRequiredPayload {
  allowMultiple: boolean;
  nodeId: string;
  nodeKind: string;
  options: WorkflowManualOption[];
  previewImages?: WorkflowManualPreviewImage[];
  prompt: string;
  runId: string;
  workflowId: string;
}

export function listenWorkflowRunStarted(listener: (payload: WorkflowRunEventPayload) => void) {
  return listen<WorkflowRunEventPayload>("workflow://run_started", (event) => {
    listener(event.payload);
  });
}

export function listenWorkflowNodeUpdate(listener: (payload: WorkflowNodeEventPayload) => void) {
  return listen<WorkflowNodeEventPayload>("workflow://node_update", (event) => {
    listener(event.payload);
  });
}

export function listenWorkflowRunFinished(listener: (payload: WorkflowRunEventPayload) => void) {
  return listen<WorkflowRunEventPayload>("workflow://run_finished", (event) => {
    listener(event.payload);
  });
}

export function listenWorkflowNodeInputRequired(
  listener: (payload: WorkflowNodeInputRequiredPayload) => void,
) {
  return listen<WorkflowNodeInputRequiredPayload>("workflow://node_input_required", (event) => {
    listener(event.payload);
  });
}

export function mergeNodeRunUpdate(run: WorkflowRun | undefined, payload: WorkflowNodeEventPayload): WorkflowRun | undefined {
  if (!run || run.id !== payload.runId) {
    return run;
  }

  const nodeRuns = run.nodeRuns.map((nodeRun) => {
    if (nodeRun.nodeId !== payload.nodeId) {
      return nodeRun;
    }

    const nextOutputs = hasPreviewOutputs(payload.outputs) ? payload.outputs : nodeRun.outputs;
    if (payload.status === "succeeded" && !hasPreviewOutputs(payload.outputs)) {
      void appLogger.warn(
        `节点 ${payload.nodeId} 已成功但事件未携带 outputs，保留已有输出用于预览。`,
      );
    }

    return {
      ...nodeRun,
      error: payload.error,
      outputSummary: payload.outputSummary,
      outputs: nextOutputs,
      progress: payload.progress ?? nodeRun.progress,
      status: payload.status as WorkflowNodeRun["status"],
    };
  });

  return {
    ...run,
    nodeRuns,
    status: payload.status === "failed" ? "running" : run.status,
  };
}

function hasPreviewOutputs(outputs: Record<string, unknown> | undefined): outputs is Record<string, unknown> {
  return Boolean(outputs && Object.keys(outputs).length > 0);
}

export async function bindWorkflowEventListeners(handlers: {
  onNodeInputRequired?: (payload: WorkflowNodeInputRequiredPayload) => void;
  onNodeUpdate: (payload: WorkflowNodeEventPayload) => void;
  onRunFinished: (payload: WorkflowRunEventPayload) => void;
  onRunStarted: (payload: WorkflowRunEventPayload) => void;
}) {
  const unlisteners: UnlistenFn[] = [];
  unlisteners.push(await listenWorkflowRunStarted(handlers.onRunStarted));
  unlisteners.push(await listenWorkflowNodeUpdate(handlers.onNodeUpdate));
  unlisteners.push(await listenWorkflowRunFinished(handlers.onRunFinished));
  if (handlers.onNodeInputRequired) {
    unlisteners.push(await listenWorkflowNodeInputRequired(handlers.onNodeInputRequired));
  }

  return () => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  };
}
