import type { AiModelProvider } from "@/lib/tauri/commands";

import { getPreset } from "./providerPresets";

export function createProviderFromPreset(presetValue: string): AiModelProvider {
  const preset = getPreset(presetValue);
  const timestamp = 0;

  return {
    apiBase: preset.apiBase,
    apiKey: "",
    createdAt: timestamp,
    id: `${preset.value}-${Date.now()}`,
    imageModel: preset.imageModel,
    isDefault: false,
    name: preset.label,
    preset: preset.value,
    providerType: preset.providerType,
    textModel: preset.textModel,
    updatedAt: timestamp,
  };
}
