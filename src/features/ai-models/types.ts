import type { AiModelProvider, AiModelProviderType, AiProviderModel, AiProviderModelKind } from "@/lib/tauri/commands";

export type { AiModelProvider, AiModelProviderType, AiProviderModel, AiProviderModelKind };

export interface AiProviderPreset {
  apiBase: string;
  imageModel: string;
  label: string;
  needsApiKey: boolean;
  providerType: AiModelProviderType;
  textModel: string;
  value: string;
}

export interface AiProviderTypeOption {
  label: string;
  value: AiModelProviderType;
}
