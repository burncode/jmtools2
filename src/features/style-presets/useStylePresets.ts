import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  deleteStylePreset,
  listStylePresets,
  saveStylePreset,
  type SaveStylePresetInput,
} from "@/lib/tauri/commands";

import { STYLE_PRESETS, toStylePresetDefinition } from "../workflows/stylePresets";
import type { StylePresetRecord } from "./types";

interface StylePresetsSnapshot {
  error: string | null;
  loading: boolean;
  presets: StylePresetRecord[];
}

let sharedSnapshot: StylePresetsSnapshot = {
  error: null,
  loading: true,
  presets: [],
};

let refreshPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emitSnapshotChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return sharedSnapshot;
}

async function refreshSharedPresets() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    sharedSnapshot = { ...sharedSnapshot, loading: true, error: null };
    emitSnapshotChange();

    try {
      const records = await listStylePresets();
      sharedSnapshot = {
        error: null,
        loading: false,
        presets: records,
      };
    } catch (nextError) {
      sharedSnapshot = {
        error: nextError instanceof Error ? nextError.message : String(nextError),
        loading: false,
        presets: STYLE_PRESETS.map((preset) => ({
          ...toStylePresetDefinition(preset),
          tags: [],
        })),
      };
    } finally {
      refreshPromise = null;
      emitSnapshotChange();
    }
  })();

  return refreshPromise;
}

export function getSharedStylePresets(): StylePresetRecord[] {
  return sharedSnapshot.presets;
}

export function useStylePresets() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const refresh = useCallback(async () => {
    await refreshSharedPresets();
  }, []);

  useEffect(() => {
    if (snapshot.loading && snapshot.presets.length === 0) {
      void refreshSharedPresets();
    }
  }, [snapshot.loading, snapshot.presets.length]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen("style-preset-saved", () => {
      void refreshSharedPresets();
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  const save = useCallback(
    async (input: SaveStylePresetInput) => {
      const saved = await saveStylePreset(input);
      await refreshSharedPresets();
      return saved;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await deleteStylePreset(id);
    await refreshSharedPresets();
  }, []);

  return {
    error: snapshot.error,
    loading: snapshot.loading,
    presets: snapshot.presets,
    refresh,
    remove,
    save,
  };
}

export function getFeaturedPresets(presets: StylePresetRecord[], limit = 4): StylePresetRecord[] {
  const builtins = presets.filter((preset) => preset.isBuiltin);
  if (builtins.length >= limit) {
    return builtins.slice(0, limit);
  }

  return presets.slice(0, limit);
}

export function findStylePreset(presets: StylePresetRecord[], presetId: string): StylePresetRecord | undefined {
  return presets.find((preset) => preset.id === presetId);
}
