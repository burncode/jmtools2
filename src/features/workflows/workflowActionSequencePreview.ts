import type { WorkflowPreviewImage } from "./workflowPreviewAssets";

export interface ActionSequenceTrackPreview {
  frames: WorkflowPreviewImage[];
  id: string;
  label: string;
}

export interface ActionSequencePreviewAssets {
  kind: "empty" | "sequence";
  tracks: ActionSequenceTrackPreview[];
}

function readImagePath(value: unknown): WorkflowPreviewImage | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const absolutePath = typeof record.absolutePath === "string" ? record.absolutePath : undefined;
  const dataUrl = typeof record.dataUrl === "string" && record.dataUrl.trim() ? record.dataUrl.trim() : undefined;
  const projectRelativePath =
    typeof record.projectRelativePath === "string"
      ? record.projectRelativePath
      : typeof record.path === "string"
        ? record.path
        : undefined;

  if (!absolutePath && !projectRelativePath && !dataUrl) {
    return undefined;
  }

  return {
    absolutePath,
    dataUrl,
    id: typeof record.id === "string" ? record.id : undefined,
    projectRelativePath,
  };
}

function readFrameImage(value: unknown, label: string): WorkflowPreviewImage | undefined {
  const image = readImagePath(value);
  if (!image) {
    return undefined;
  }

  return {
    ...image,
    label,
  };
}

function matchesActionTrack(trackId: string, actionId: string) {
  return trackId === actionId || trackId.startsWith(`${actionId}-`);
}

function matchesViewKind(trackId: string, actionId: string, viewKind: string) {
  if (viewKind === "auto") {
    return true;
  }

  return trackId === `${actionId}-${viewKind}` || trackId.endsWith(`-${viewKind}`);
}

export function resolveActionSequencePreviewAssets(
  outputs: Record<string, unknown> | undefined,
  params: Record<string, unknown>,
): ActionSequencePreviewAssets {
  const character = outputs?.character;
  if (!character || typeof character !== "object") {
    return { kind: "empty", tracks: [] };
  }

  const actionId = String(params.actionId ?? "idle").trim() || "idle";
  const viewKind = String(params.viewKind ?? "auto").trim() || "auto";
  const actions = Array.isArray((character as Record<string, unknown>).actions)
    ? ((character as Record<string, unknown>).actions as unknown[]).filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object",
      )
    : [];

  const tracks = actions
    .filter((action) => {
      const id = typeof action.id === "string" ? action.id : "";
      return id && matchesActionTrack(id, actionId) && matchesViewKind(id, actionId, viewKind);
    })
    .map((action) => {
      const id = typeof action.id === "string" ? action.id : "action";
      const label = typeof action.label === "string" ? action.label : id;
      const framesRaw = Array.isArray(action.frames) ? action.frames : [];
      const frames = framesRaw
        .filter((frame): frame is Record<string, unknown> => Boolean(frame) && typeof frame === "object")
        .map((frame, index) => {
          const frameLabel = typeof frame.label === "string" ? frame.label : `${label} ${index + 1}`;
          return readFrameImage(frame.image, frameLabel);
        })
        .filter((item): item is WorkflowPreviewImage => Boolean(item));

      return { frames, id, label };
    })
    .filter((track) => track.frames.length > 0);

  if (tracks.length === 0) {
    return { kind: "empty", tracks: [] };
  }

  return {
    kind: "sequence",
    tracks,
  };
}
