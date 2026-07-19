import type { AiModelProvider, AiProviderModel, AiProviderModelKind, AiProviderRemoteModel } from "@/lib/tauri/commands";

import { saveAiProviderModel } from "@/lib/tauri/commands";

function normalizeModelIdPart(value: string) {
  return value.trim().replace(/[ /\\:]/g, "_");
}

export function isTextSelectableModelKind(kind: AiProviderModelKind) {
  return kind === "text" || kind === "vision" || kind === "embedding" || kind === "rerank";
}

export function isImageSelectableModelKind(kind: AiProviderModelKind) {
  return kind === "image" || kind === "image-edit";
}

export function summarizeRemoteModels(models: AiProviderRemoteModel[]) {
  const counts = {
    audio: 0,
    embedding: 0,
    image: 0,
    "image-edit": 0,
    rerank: 0,
    text: 0,
    vision: 0,
  } satisfies Record<AiProviderModelKind, number>;

  for (const model of models) {
    counts[model.modelKind] += 1;
  }

  return counts;
}

export function resolveModelKindForBucket(
  name: string,
  bucket: "image" | "text",
  remote?: AiProviderRemoteModel,
): AiProviderModelKind {
  if (remote?.name === name) {
    if (bucket === "text" && isTextSelectableModelKind(remote.modelKind)) {
      return remote.modelKind;
    }

    if (bucket === "image" && isImageSelectableModelKind(remote.modelKind)) {
      return remote.modelKind;
    }
  }

  return bucket;
}

export function buildRemoteModelRefreshMessage(models: AiProviderRemoteModel[]) {
  if (models.length === 0) {
    return "服务已响应，但没有返回可用模型。";
  }

  const counts = summarizeRemoteModels(models);
  const textCount = counts.text + counts.vision + counts.embedding + counts.rerank;
  const imageCount = counts.image + counts["image-edit"];
  const detail = [
    textCount > 0 ? `文本类 ${textCount}` : null,
    imageCount > 0 ? `图像类 ${imageCount}` : null,
    counts.audio > 0 ? `音频 ${counts.audio}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return `已刷新 ${models.length} 个模型（${detail}）。请在下拉中搜索并点击「添加」，保存后才会写入模型列表。`;
}

export function dedupeRemoteModelsByName(models: AiProviderRemoteModel[]) {
  const byName = new Map<string, AiProviderRemoteModel>();

  for (const model of models) {
    const name = model.name.trim();
    if (!name) {
      continue;
    }

    byName.set(name, { ...model, name });
  }

  return [...byName.values()];
}

export function remoteModelToProviderModel(
  provider: AiModelProvider,
  remote: AiProviderRemoteModel,
  existingModel?: AiProviderModel,
): AiProviderModel {
  const isTextLike = isTextSelectableModelKind(remote.modelKind);
  const isImageLike = isImageSelectableModelKind(remote.modelKind);
  const imageDefault = !isImageLike ? 0 : provider.preset === "local-diffusion" ? 512 : 1024;

  return {
    contextLength: existingModel?.contextLength ?? (isTextLike ? 128000 : 0),
    createdAt: existingModel?.createdAt ?? 0,
    defaultHeight: existingModel?.defaultHeight ?? remote?.defaultHeight ?? imageDefault,
    defaultTemperature: existingModel?.defaultTemperature ?? 0,
    defaultWidth: existingModel?.defaultWidth ?? remote?.defaultWidth ?? imageDefault,
    displayName: existingModel?.displayName || remote.displayName || remote.name,
    id:
      existingModel?.id ??
      `${provider.id}::${remote.modelKind}::${normalizeModelIdPart(remote.name)}`,
    isDefault: existingModel?.isDefault ?? false,
    isEnabled: existingModel?.isEnabled ?? true,
    maxOutputTokens: existingModel?.maxOutputTokens ?? 0,
    modelKind: remote.modelKind,
    name: remote.name,
    providerId: provider.id,
    updatedAt: existingModel?.updatedAt ?? 0,
  };
}

export async function importRemoteProviderModels(
  provider: AiModelProvider,
  remoteModels: AiProviderRemoteModel[],
  existingModels: AiProviderModel[] = [],
) {
  // 保留给按需导入场景；刷新列表时不应调用此函数。
  const uniqueRemoteModels = dedupeRemoteModelsByName(remoteModels);

  if (uniqueRemoteModels.length === 0) {
    return;
  }

  const existingByName = new Map(existingModels.map((model) => [model.name, model]));
  const defaultKinds = new Set(existingModels.filter((model) => model.isDefault).map((model) => model.modelKind));

  for (const remote of uniqueRemoteModels) {
    const existingModel = existingByName.get(remote.name);
    const nextModel = remoteModelToProviderModel(provider, remote, existingModel);

    if (!existingModel && !defaultKinds.has(remote.modelKind)) {
      nextModel.isDefault = true;
      defaultKinds.add(remote.modelKind);
    }

    const savedModel = await saveAiProviderModel(nextModel);
    existingByName.set(savedModel.name, savedModel);
  }
}
