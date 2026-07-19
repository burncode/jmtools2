export type LocalModelsActiveTaskKind =
  | "lora-download"
  | "model-download"
  | "model-import"
  | "runtime-download"
  | "runtime-import"
  | "test";

export interface LocalModelsActiveTask {
  kind: LocalModelsActiveTaskKind;
  label: string;
  loraId?: string;
  profileId?: string;
  startedAt: number;
  state?: "running" | "paused";
}
