import { emit } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export interface CharacterMotionPresetLibraryOpenPayload {
  characterId: string;
  existingActionIds: string[];
  projectRoot: string;
}

export interface CharacterMotionPresetSelectedPayload {
  actionId: string;
  characterId: string;
  defaultFrames: number;
  label: string;
  motionPrompt: string;
  projectRoot: string;
}

const WINDOW_LABEL = "character-motion-preset-library";

function buildLibraryUrl(payload: CharacterMotionPresetLibraryOpenPayload): string {
  const params = new URLSearchParams({
    characterId: payload.characterId,
    existingActionIds: payload.existingActionIds.join(","),
    projectRoot: payload.projectRoot,
    window: WINDOW_LABEL,
  });

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

export async function openCharacterMotionPresetLibrary(
  payload: CharacterMotionPresetLibraryOpenPayload,
): Promise<void> {
  const existing = await WebviewWindow.getByLabel(WINDOW_LABEL);

  if (existing) {
    await existing.emit("character-motion-preset-library-open", payload);
    await existing.setFocus();
    return;
  }

  const libraryWindow = new WebviewWindow(WINDOW_LABEL, {
    center: true,
    focus: true,
    height: 720,
    title: "添加动作",
    url: buildLibraryUrl(payload),
    width: 960,
  });

  libraryWindow.once("tauri://error", (event) => {
    console.error("打开动作预设库失败", event);
  });
}

export async function emitCharacterMotionPresetSelected(
  payload: CharacterMotionPresetSelectedPayload,
): Promise<void> {
  await emit("character-motion-preset-selected", payload);
}

export function parseCharacterMotionPresetLibrarySearchParams(
  search: string,
): CharacterMotionPresetLibraryOpenPayload {
  const params = new URLSearchParams(search);
  const existingRaw = params.get("existingActionIds") ?? "";

  return {
    characterId: params.get("characterId") ?? "",
    existingActionIds: existingRaw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    projectRoot: params.get("projectRoot") ?? "",
  };
}

export function isCharacterMotionPresetLibraryWindow(): boolean {
  return new URLSearchParams(window.location.search).get("window") === WINDOW_LABEL;
}
