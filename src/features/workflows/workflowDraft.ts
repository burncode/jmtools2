import type { WorkflowDefinition } from "./types";

const DRAFT_KEY_PREFIX = "jmtools.workflow.draft.v1";

export interface WorkflowDraftRecord {
  definition: WorkflowDefinition;
  savedAt: number;
}

export function getWorkflowDraftKey(projectId: string, workflowId: string) {
  return `${DRAFT_KEY_PREFIX}.${projectId}.${workflowId}`;
}

export function readWorkflowDraft(projectId: string, workflowId: string): WorkflowDraftRecord | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getWorkflowDraftKey(projectId, workflowId));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as WorkflowDraftRecord;

    if (!parsed.definition || typeof parsed.savedAt !== "number") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeWorkflowDraft(projectId: string, definition: WorkflowDefinition) {
  if (typeof window === "undefined") {
    return;
  }

  const record: WorkflowDraftRecord = {
    definition: structuredClone(definition),
    savedAt: Date.now(),
  };

  window.localStorage.setItem(getWorkflowDraftKey(projectId, definition.id), JSON.stringify(record));
}

export function clearWorkflowDraft(projectId: string, workflowId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getWorkflowDraftKey(projectId, workflowId));
}

export function shouldOfferDraftRecovery(
  savedDefinition: WorkflowDefinition | undefined,
  draft: WorkflowDraftRecord | null,
) {
  if (!draft) {
    return false;
  }

  if (!savedDefinition) {
    return true;
  }

  const savedAt = Date.parse(savedDefinition.updatedAt ?? savedDefinition.createdAt ?? "");

  if (!Number.isFinite(savedAt)) {
    return draft.savedAt > 0;
  }

  return draft.savedAt > savedAt;
}
