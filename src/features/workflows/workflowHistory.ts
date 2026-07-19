import type { WorkflowDefinition } from "./types";

const MAX_HISTORY = 50;

export function cloneWorkflowDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  return structuredClone(definition);
}

export function pushHistorySnapshot(past: WorkflowDefinition[], snapshot: WorkflowDefinition) {
  return [...past, cloneWorkflowDefinition(snapshot)].slice(-MAX_HISTORY);
}

export function popUndo(
  current: WorkflowDefinition,
  past: WorkflowDefinition[],
  future: WorkflowDefinition[],
) {
  if (past.length === 0) {
    return null;
  }

  const previous = past[past.length - 1];
  const nextPast = past.slice(0, -1);
  const nextFuture = [cloneWorkflowDefinition(current), ...future].slice(0, MAX_HISTORY);

  return {
    future: nextFuture,
    past: nextPast,
    workflow: cloneWorkflowDefinition(previous),
  };
}

export function popRedo(
  current: WorkflowDefinition,
  past: WorkflowDefinition[],
  future: WorkflowDefinition[],
) {
  if (future.length === 0) {
    return null;
  }

  const [nextWorkflow, ...nextFuture] = future;
  const nextPast = pushHistorySnapshot(past, current);

  return {
    future: nextFuture,
    past: nextPast,
    workflow: cloneWorkflowDefinition(nextWorkflow),
  };
}
