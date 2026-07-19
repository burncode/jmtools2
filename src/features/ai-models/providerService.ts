import {
  deleteAiModelProvider,
  deleteAiProviderModel,
  listAiProviderModels,
  listAiModelProviders,
  refreshAiProviderModels,
  saveAiProviderModel,
  saveAiModelProvider,
  testAiModelProvider,
  type AiProviderModel,
  type AiModelProvider,
} from "@/lib/tauri/commands";

export async function loadAiProviders() {
  return listAiModelProviders();
}

export async function loadAiModels(providerId?: string) {
  return listAiProviderModels(providerId);
}

export async function saveAiProvider(provider: AiModelProvider) {
  return saveAiModelProvider(provider);
}

export async function saveAiModel(model: AiProviderModel) {
  return saveAiProviderModel(model);
}

export async function removeAiProvider(providerId: string) {
  return deleteAiModelProvider(providerId);
}

export async function removeAiModel(modelId: string) {
  return deleteAiProviderModel(modelId);
}

export async function refreshProviderModels(provider: AiModelProvider) {
  return refreshAiProviderModels(provider);
}

export async function testAiProvider(provider: AiModelProvider) {
  return testAiModelProvider(provider);
}
