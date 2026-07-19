import { emit } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

import type { StylePresetLibraryOpenPayload } from "./types";

const WINDOW_LABEL = "style-preset-library";

function buildLibraryUrl(payload: StylePresetLibraryOpenPayload): string {
  const params = new URLSearchParams({
    mode: payload.mode,
    nodeId: payload.nodeId ?? "",
    presetId: payload.presetId ?? "",
    projectRoot: payload.projectRoot ?? "",
    window: WINDOW_LABEL,
  });

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

export async function openStylePresetLibrary(payload: StylePresetLibraryOpenPayload): Promise<void> {
  const existing = await WebviewWindow.getByLabel(WINDOW_LABEL);

  if (existing) {
    await existing.emit("style-preset-library-open", payload);
    await existing.setFocus();
    return;
  }

  const libraryWindow = new WebviewWindow(WINDOW_LABEL, {
    center: true,
    focus: true,
    height: 800,
    title: "风格预设库",
    url: buildLibraryUrl(payload),
    width: 1200,
  });

  libraryWindow.once("tauri://error", (event) => {
    console.error("打开风格预设库失败", event);
  });
}

export async function emitStylePresetSelected(payload: { nodeId?: string; presetId: string }): Promise<void> {
  await emit("style-preset-selected", payload);
}

export function parseStylePresetLibrarySearchParams(search: string): StylePresetLibraryOpenPayload {
  const params = new URLSearchParams(search);

  return {
    mode: params.get("mode") === "edit" ? "edit" : "pick",
    nodeId: params.get("nodeId") || undefined,
    presetId: params.get("presetId") || undefined,
    projectRoot: params.get("projectRoot") || undefined,
  };
}

export function isStylePresetLibraryWindow(): boolean {
  return new URLSearchParams(window.location.search).get("window") === WINDOW_LABEL;
}
