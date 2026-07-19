import type {
  BackendEvaluationStatus,
  LocalDiffusionRuntimeStatus,
  LocalHardwareProbeResult,
  LocalInferenceSettings,
  LocalLoraStatus,
  LocalModelProfileStatus,
} from "@/lib/tauri/localModels";

export interface LocalModelsPanelSnapshot {
  evaluations: BackendEvaluationStatus[];
  hardware: LocalHardwareProbeResult | null;
  loadedAt: number;
  loras: LocalLoraStatus[];
  profiles: LocalModelProfileStatus[];
  runtimeRootDirectory: string;
  runtimes: LocalDiffusionRuntimeStatus[];
  settings: LocalInferenceSettings;
}

export const PANEL_CACHE_TTL_MS = 120_000;

let snapshot: LocalModelsPanelSnapshot | null = null;

export function getLocalModelsPanelSnapshot() {
  return snapshot;
}

export function setLocalModelsPanelSnapshot(next: LocalModelsPanelSnapshot) {
  snapshot = next;
}

export function clearLocalModelsPanelSnapshot() {
  snapshot = null;
}

export function isLocalModelsPanelCacheFresh() {
  if (!snapshot) {
    return false;
  }
  return Date.now() - snapshot.loadedAt < PANEL_CACHE_TTL_MS;
}
