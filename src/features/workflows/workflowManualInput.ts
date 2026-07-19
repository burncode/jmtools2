import type { WorkflowAwaitingInputContext } from "@/lib/tauri/commands";
import { getWorkflowAwaitingInput } from "@/lib/tauri/commands";

import type { WorkflowNodeInputRequiredPayload } from "./workflowEvents";
import type { PendingManualInput } from "./workflowStore";
import type { WorkflowRun } from "./types";

export function toPendingManualInput(
  payload: WorkflowNodeInputRequiredPayload | WorkflowAwaitingInputContext,
): PendingManualInput {
  return {
    allowMultiple: payload.allowMultiple,
    nodeId: payload.nodeId,
    nodeKind: payload.nodeKind,
    options: payload.options,
    previewImages: payload.previewImages,
    prompt: payload.prompt,
    runId: payload.runId,
  };
}

export async function syncPendingManualInputFromRun(
  projectRoot: string,
  workflowId: string,
): Promise<PendingManualInput | undefined> {
  const context = await getWorkflowAwaitingInput(projectRoot, workflowId);
  return context ? toPendingManualInput(context) : undefined;
}

export function pickPreferredWorkflowRun(
  runs: WorkflowRun[],
  workflowId: string,
): WorkflowRun | undefined {
  const scopedRuns = runs.filter((run) => run.workflowId === workflowId);
  if (scopedRuns.length === 0) {
    return undefined;
  }

  return (
    scopedRuns.find((run) => run.status === "awaiting_input") ??
    scopedRuns[0]
  );
}
