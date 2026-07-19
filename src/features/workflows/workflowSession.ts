const lastWorkflowIdStorageKey = "jmtools.workflow.last-id.v1";

function readStorageMap(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(lastWorkflowIdStorageKey);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStorageMap(map: Record<string, string>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(lastWorkflowIdStorageKey, JSON.stringify(map));
}

export function readLastWorkflowId(projectKey: string): string | undefined {
  const workflowId = readStorageMap()[projectKey]?.trim();
  return workflowId || undefined;
}

export function writeLastWorkflowId(projectKey: string, workflowId: string) {
  const trimmed = workflowId.trim();
  if (!trimmed) {
    return;
  }

  const map = readStorageMap();
  map[projectKey] = trimmed;
  writeStorageMap(map);
}
