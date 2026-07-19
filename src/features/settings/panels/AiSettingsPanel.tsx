import {
  BrainCircuit,
  CheckCircle2,
  Cloud,
  Cpu,
  Download,
  Eraser,
  LoaderCircle,
  Image,
  MessageSquareText,
  Music,
  Pencil,
  Palette,
  Plus,
  Search,
  ServerCog,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AiModelProvider, AiProviderModel, AppSettings, BackgroundRemovalModelStatus, BackgroundRemovalRuntimeStatus } from "@/lib/tauri/commands";
import {
  listBackgroundRemovalModels,
  testBackgroundRemovalRuntime,
  warmupBackgroundRemovalModel,
} from "@/lib/tauri/commands";
import { generatePipelineText } from "@/features/ai-models/generationService";
import { listLocalModelProfiles } from "@/lib/tauri/localModels";
import {
  loadAiModels,
  loadAiProviders,
  removeAiModel,
  removeAiProvider,
  saveAiModel,
  saveAiProvider,
  testAiProvider,
} from "@/features/ai-models/providerService";
import { isImageSelectableModelKind, isTextSelectableModelKind, resolveModelKindForBucket } from "@/features/ai-models/providerModelImport";
import type { AiProviderModelKind, AiProviderRemoteModel } from "@/lib/tauri/commands";

import { AiProviderDialog, type ProviderModelNames } from "../components/AiProviderDialog";
import { SettingsModal } from "../components/SettingsModal";
import { SettingsCheckboxRow, SettingsField, SettingsSelect } from "../components/SettingsControls";
import {
  backgroundRemovalCleanupStrengthOptions,
  backgroundRemovalEngineOptions,
  backgroundRemovalModelOptions,
} from "../settingsOptions";
import type { SettingsPanelProps } from "./types";

type ModelKind = "audio" | "image" | "image-edit" | "text";

const pipelineBindings = [
  { field: "aiTextModel", icon: MessageSquareText, kind: "text", label: "文本生成", providerField: "aiTextProviderId" },
  { field: "aiCharacterModel", icon: Sparkles, kind: "image", label: "角色生成（文生图）", providerField: "aiCharacterProviderId" },
  { field: "aiCharacterEditModel", icon: SlidersHorizontal, kind: "image-edit", label: "角色图像编辑（img2img）", providerField: "aiCharacterEditProviderId" },
  { field: "aiSceneModel", icon: Image, kind: "image", label: "场景/地图生成", providerField: "aiSceneProviderId" },
  { field: "aiVfxModel", icon: Wand2, kind: "image", label: "特效生成", providerField: "aiVfxProviderId" },
  { field: "aiUiModel", icon: Palette, kind: "image", label: "UI 资源生成", providerField: "aiUiProviderId" },
  { field: "aiAnimationModel", icon: BrainCircuit, kind: "text", label: "动画辅助", providerField: "aiAnimationProviderId" },
  { field: "aiAudioModel", icon: Music, kind: "audio", label: "音乐/音效", providerField: "aiAudioProviderId" },
] as const satisfies readonly {
  field: keyof Pick<
    AppSettings,
    | "aiAnimationModel"
    | "aiAudioModel"
    | "aiCharacterEditModel"
    | "aiCharacterModel"
    | "aiSceneModel"
    | "aiTextModel"
    | "aiUiModel"
    | "aiVfxModel"
  >;
  icon: typeof Sparkles;
  kind: ModelKind;
  label: string;
  providerField: keyof Pick<
    AppSettings,
    | "aiAnimationProviderId"
    | "aiAudioProviderId"
    | "aiCharacterEditProviderId"
    | "aiCharacterProviderId"
    | "aiSceneProviderId"
    | "aiTextProviderId"
    | "aiUiProviderId"
    | "aiVfxProviderId"
  >;
}[];

const providerTypeLabels = {
  custom: "自定义服务",
  domestic: "国内服务",
  foreign: "国外服务",
  local: "本地服务",
} as const;

const modelKindLabels = {
  audio: "Audio",
  embedding: "Embedding",
  image: "Image",
  "image-edit": "Image Edit",
  rerank: "Rerank",
  text: "Chat",
  vision: "Vision",
} as const;

const modelKindIconMap = {
  audio: Music,
  embedding: BrainCircuit,
  image: Image,
  "image-edit": SlidersHorizontal,
  rerank: BrainCircuit,
  text: MessageSquareText,
  vision: Image,
} as const;

function normalizeModelIdPart(value: string) {
  return value.trim().replace(/[ /\\:]/g, "_");
}

function defaultImageDimension(provider: AiModelProvider, isImageLike: boolean) {
  if (!isImageLike) {
    return 0;
  }

  if (provider.preset === "local-diffusion") {
    return 512;
  }

  return 1024;
}

function createProviderModel(
  provider: AiModelProvider,
  modelName: string,
  modelKind: AiProviderModelKind,
  existingModel?: AiProviderModel,
  remote?: AiProviderRemoteModel,
): AiProviderModel {
  const isTextLike = isTextSelectableModelKind(modelKind);
  const isImageLike = isImageSelectableModelKind(modelKind);
  const imageDefault = defaultImageDimension(provider, isImageLike);

  return {
    contextLength: existingModel?.contextLength ?? (isTextLike ? 128000 : 0),
    createdAt: existingModel?.createdAt ?? 0,
    defaultHeight:
      existingModel?.defaultHeight ??
      remote?.defaultHeight ??
      imageDefault,
    defaultTemperature: existingModel?.defaultTemperature ?? 0,
    defaultWidth:
      existingModel?.defaultWidth ??
      remote?.defaultWidth ??
      imageDefault,
    displayName: existingModel?.displayName || remote?.displayName || modelName,
    id: existingModel?.id ?? `${provider.id}::${modelKind}::${normalizeModelIdPart(modelName)}`,
    isDefault: existingModel?.isDefault ?? true,
    isEnabled: existingModel?.isEnabled ?? true,
    maxOutputTokens: existingModel?.maxOutputTokens ?? 0,
    modelKind,
    name: modelName,
    providerId: provider.id,
    updatedAt: existingModel?.updatedAt ?? 0,
  };
}

function getProviderIcon(provider: AiModelProvider) {
  if (provider.providerType === "local") {
    return Cpu;
  }

  return provider.providerType === "custom" ? ServerCog : Cloud;
}

function getProviderModelOptions(provider: AiModelProvider | undefined, models: AiProviderModel[], kind: ModelKind) {
  if (!provider) {
    return [{ label: "未选择", value: "" }];
  }

  const matchingModels = models
    .filter((model) => model.providerId === provider.id && model.isEnabled)
    .filter((model) => {
      if (kind === "audio") {
        return model.modelKind === "audio";
      }

      if (kind === "text") {
        return model.modelKind === "text" || model.modelKind === "vision" || model.modelKind === "embedding" || model.modelKind === "rerank";
      }

      // 图像编辑绑定同时列出 image-edit 与普通 image 模型，避免历史登记为 image 的编辑模型被过滤掉。
      if (kind === "image-edit") {
        return model.modelKind === "image-edit" || model.modelKind === "image";
      }

      return model.modelKind === kind;
    });

  if (matchingModels.length > 0) {
    return matchingModels.map((model) => ({ label: model.displayName || model.name, value: model.name }));
  }

  const legacyModels = [kind === "text" ? provider.textModel : provider.imageModel, provider.textModel, provider.imageModel]
    .map((model) => model.trim())
    .filter((model, index, modelList) => model && modelList.indexOf(model) === index);

  if (kind === "audio" && legacyModels.length === 0) {
    return [{ label: "无可用模型", value: "" }];
  }

  return legacyModels.length > 0
    ? legacyModels.map((model) => ({ label: model, value: model }))
    : [{ label: "无可用模型", value: "" }];
}

function getModelCapabilities(model: AiProviderModel) {
  if (model.modelKind === "image") {
    return ["图像生成", "素材草图"];
  }

  if (model.modelKind === "image-edit") {
    return ["图像编辑", "img2img"];
  }

  if (model.name.includes("coder")) {
    return ["代码", "补全"];
  }

  if (model.name.includes("reason")) {
    return ["推理", "逻辑"];
  }

  if (model.modelKind === "vision") {
    return ["视觉", "图像理解"];
  }

  if (model.modelKind === "audio") {
    return ["音频", "转换"];
  }

  return ["文本", "对话", "代码"];
}

function formatContextLength(model: AiProviderModel) {
  if (model.contextLength <= 0) {
    return "-";
  }

  if (model.contextLength >= 1000) {
    return `${Math.round(model.contextLength / 1000)}K`;
  }

  return String(model.contextLength);
}

function toNumber(value: string) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function clampNumber(value: string, min: number, max: number, fallback: number) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsedValue));
}

function ModelParameterDialog({
  model,
  onClose,
  onSave,
}: {
  model: AiProviderModel;
  onClose: () => void;
  onSave: (model: AiProviderModel) => void;
}) {
  const [draftModel, setDraftModel] = useState(model);

  function updateModel(nextModel: Partial<AiProviderModel>) {
    setDraftModel((currentModel) => ({ ...currentModel, ...nextModel }));
  }

  return (
    <SettingsModal
      ariaLabel="模型参数设置"
      className="settings-model-param-modal"
      footer={
        <>
          <Button onClick={onClose} type="button" variant="outline">
            取消
          </Button>
          <Button onClick={() => onSave(draftModel)} type="button">
            保存参数
          </Button>
        </>
      }
      header={
        <>
          <div>
            <span className="settings-kicker">模型参数</span>
            <h3>{model.displayName || model.name}</h3>
            <p>配置该模型在生成流水线中的默认参数。</p>
          </div>
          <Button aria-label="关闭" onClick={onClose} size="icon" type="button" variant="ghost">
            <X />
          </Button>
        </>
      }
      onClose={onClose}
    >
          <SettingsField label="显示名称">
            <Input onChange={(event) => updateModel({ displayName: event.target.value })} value={draftModel.displayName} />
          </SettingsField>
          <SettingsField description="文本、视觉模型常用。未知可填 0。" label="上下文长度">
            <Input onChange={(event) => updateModel({ contextLength: toNumber(event.target.value) })} type="number" value={draftModel.contextLength} />
          </SettingsField>
          <SettingsField description="生成文本时的最大输出 token。" label="最大输出">
            <Input onChange={(event) => updateModel({ maxOutputTokens: toNumber(event.target.value) })} type="number" value={draftModel.maxOutputTokens} />
          </SettingsField>
          <SettingsField description="0 表示使用服务商默认值。" label="默认温度">
            <Input onChange={(event) => updateModel({ defaultTemperature: toNumber(event.target.value) })} step="0.1" type="number" value={draftModel.defaultTemperature} />
          </SettingsField>
          <div className="settings-modal-grid">
            <SettingsField label="默认宽度">
              <Input onChange={(event) => updateModel({ defaultWidth: toNumber(event.target.value) })} type="number" value={draftModel.defaultWidth} />
            </SettingsField>
            <SettingsField label="默认高度">
              <Input onChange={(event) => updateModel({ defaultHeight: toNumber(event.target.value) })} type="number" value={draftModel.defaultHeight} />
            </SettingsField>
          </div>
          <SettingsCheckboxRow checked={draftModel.isEnabled} label="启用模型" onChange={(isEnabled) => updateModel({ isEnabled })} />
          <SettingsCheckboxRow checked={draftModel.isDefault} label="设为同类型默认模型" onChange={(isDefault) => updateModel({ isDefault })} />
    </SettingsModal>
  );
}

export function AiSettingsPanel({ settings, updateSettings }: SettingsPanelProps) {
  const [providers, setProviders] = useState<AiModelProvider[]>([]);
  const [models, setModels] = useState<AiProviderModel[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [editingProvider, setEditingProvider] = useState<AiModelProvider | undefined>();
  const [editingModel, setEditingModel] = useState<AiProviderModel | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingProviderData, setIsLoadingProviderData] = useState(true);
  const [modelSearch, setModelSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState("请先添加 AI 服务提供商。");
  const [trialModel, setTrialModel] = useState("");
  const [trialPrompt, setTrialPrompt] = useState("请用一句话说明 JMTools 的 AI 连接是否正常。");
  const [trialResult, setTrialResult] = useState("运行后会在这里显示模型返回内容。");
  const [isRunningTrial, setIsRunningTrial] = useState(false);
  const [backgroundModelStatuses, setBackgroundModelStatuses] = useState<BackgroundRemovalModelStatus[]>([]);
  const [backgroundRuntimeStatus, setBackgroundRuntimeStatus] = useState<BackgroundRemovalRuntimeStatus | undefined>();
  const [backgroundToolMessage, setBackgroundToolMessage] = useState("快速纯色背景无需模型；AI 语义去背景需要本机 rembg 命令行运行器。");
  const [isCheckingBackgroundRuntime, setIsCheckingBackgroundRuntime] = useState(false);
  const [isWarmingBackgroundModel, setIsWarmingBackgroundModel] = useState(false);
  const [localProfileReadyById, setLocalProfileReadyById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;

    loadAiProviders()
      .then(async (loadedProviders) => {
        const loadedModels = await loadAiModels();

        if (isMounted) {
          setProviders(loadedProviders);
          setModels(loadedModels);
          setSelectedProviderId((currentProviderId) => currentProviderId || loadedProviders[0]?.id || "");
          setStatusMessage(loadedProviders.length > 0 ? "已读取 AI 服务提供商。" : "请先添加 AI 服务提供商。");
          setIsLoadingProviderData(false);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setStatusMessage(error instanceof Error ? error.message : String(error));
          setIsLoadingProviderData(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? providers[0];
  const providerModels = useMemo(
    () => models.filter((model) => model.providerId === selectedProvider?.id),
    [models, selectedProvider?.id],
  );
  const filteredProviderModels = useMemo(() => {
    const keyword = modelSearch.trim().toLowerCase();

    if (!keyword) {
      return providerModels;
    }

    return providerModels.filter((model) => `${model.name} ${model.displayName} ${model.modelKind}`.toLowerCase().includes(keyword));
  }, [modelSearch, providerModels]);
  const trialTextModelOptions = useMemo(
    () => getProviderModelOptions(selectedProvider, models, "text").filter((option) => option.value),
    [models, selectedProvider],
  );

  useEffect(() => {
    if (trialTextModelOptions.some((option) => option.value === trialModel)) {
      return;
    }

    setTrialModel(trialTextModelOptions[0]?.value ?? "");
  }, [trialModel, trialTextModelOptions]);

  useEffect(() => {
    void refreshBackgroundModelStatuses();
  }, []);

  useEffect(() => {
    if (selectedProvider?.preset !== "local-diffusion") {
      setLocalProfileReadyById({});
      return;
    }

    void listLocalModelProfiles()
      .then((rows) => {
        setLocalProfileReadyById(Object.fromEntries(rows.map((row) => [row.profile.id, row.ready])));
      })
      .catch(() => {
        setLocalProfileReadyById({});
      });
  }, [models, selectedProvider?.id, selectedProvider?.preset]);

  async function refreshBackgroundModelStatuses() {
    try {
      const statuses = await listBackgroundRemovalModels();

      setBackgroundModelStatuses(statuses);
    } catch (error) {
      setBackgroundToolMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function reloadProviderData(nextSelectedProviderId?: string) {
    const nextProviders = await loadAiProviders();
    const nextModels = await loadAiModels();
    const fallbackProviderId = nextSelectedProviderId || selectedProviderId || nextProviders[0]?.id || "";

    setProviders(nextProviders);
    setModels(nextModels);
    setSelectedProviderId(fallbackProviderId);
  }

  async function syncProviderModels(
    provider: AiModelProvider,
    modelNames: ProviderModelNames,
    remoteModels: AiProviderRemoteModel[] = [],
  ) {
    const currentModels = models.filter((model) => model.providerId === provider.id);
    const remoteByName = new Map(remoteModels.map((model) => [model.name, model]));
    const nextEntries = new Map<string, AiProviderModelKind>();

    for (const name of modelNames.text) {
      nextEntries.set(name, resolveModelKindForBucket(name, "text", remoteByName.get(name)));
    }

    for (const name of modelNames.image) {
      if (!nextEntries.has(name)) {
        nextEntries.set(name, resolveModelKindForBucket(name, "image", remoteByName.get(name)));
      }
    }

    await Promise.all(
      [...nextEntries.entries()].map(([name, kind]) => {
        const existingModel = currentModels.find((item) => item.name === name);

        return saveAiModel(createProviderModel(provider, name, kind, existingModel, remoteByName.get(name)));
      }),
    );

    await Promise.all(
      currentModels
        .filter((model) => !nextEntries.has(model.name))
        .map((model) => removeAiModel(model.id)),
    );
  }

  async function handleSaveProvider(
    provider: AiModelProvider,
    modelNames: ProviderModelNames,
    remoteModels: AiProviderRemoteModel[] = [],
  ) {
    const savedProvider = await saveAiProvider(provider);

    await syncProviderModels(savedProvider, modelNames, remoteModels);
    await reloadProviderData(savedProvider.id);

    setIsDialogOpen(false);
    setEditingProvider(undefined);
    setStatusMessage(`已保存服务提供商：${savedProvider.name}`);
  }

  async function handleDeleteProvider(providerId: string) {
    await removeAiProvider(providerId);
    await reloadProviderData("");
    setStatusMessage("已删除 AI 服务提供商。");
  }

  async function handleToggleModel(model: AiProviderModel) {
    const savedModel = await saveAiModel({ ...model, isEnabled: !model.isEnabled });

    setModels((currentModels) => currentModels.map((item) => (item.id === savedModel.id ? savedModel : item)));
  }

  async function handleSetDefaultModel(model: AiProviderModel) {
    const savedModel = await saveAiModel({ ...model, isDefault: true });

    setModels((currentModels) =>
      currentModels.map((item) => {
        if (item.providerId === savedModel.providerId && item.modelKind === savedModel.modelKind) {
          return { ...item, isDefault: item.id === savedModel.id };
        }

        return item;
      }),
    );
  }

  async function handleSaveModelParameters(model: AiProviderModel) {
    const savedModel = await saveAiModel(model);

    setModels((currentModels) =>
      currentModels.map((item) => {
        if (item.providerId === savedModel.providerId && item.modelKind === savedModel.modelKind && savedModel.isDefault) {
          return { ...item, isDefault: item.id === savedModel.id };
        }

        return item.id === savedModel.id ? savedModel : item;
      }),
    );
    setEditingModel(undefined);
    setStatusMessage(`已保存模型参数：${savedModel.displayName || savedModel.name}`);
  }

  function handleCreateProvider() {
    setEditingProvider(undefined);
    setIsDialogOpen(true);
  }

  function handleEditProvider(provider: AiModelProvider) {
    setEditingProvider(provider);
    setIsDialogOpen(true);
  }

  function updateBindingProvider(providerField: (typeof pipelineBindings)[number]["providerField"], providerId: string) {
    const provider = providers.find((item) => item.id === providerId);

    updateSettings({ [providerField]: providerId });

    for (const binding of pipelineBindings) {
      if (binding.providerField === providerField) {
        if (!provider) {
          updateSettings({ [binding.field]: "" });
          return;
        }

        const modelOptions = getProviderModelOptions(provider, models, binding.kind);
        const firstModelValue = modelOptions.find((option) => option.value)?.value ?? "";

        updateSettings({ [binding.field]: firstModelValue });
      }
    }
  }

  async function handleRunAiTrial() {
    if (!selectedProvider) {
      setTrialResult("请先添加并选择一个 AI 服务商。");
      return;
    }

    const prompt = trialPrompt.trim();

    if (!prompt) {
      setTrialResult("请输入要发送给模型的提示词。");
      return;
    }

    setIsRunningTrial(true);
    setTrialResult("正在请求模型，请稍候...");

    try {
      const result = await generatePipelineText({
        maxTokens: 512,
        model: trialModel,
        prompt,
        providerId: selectedProvider.id,
        systemPrompt: "你是 JMTools 的 AI 连接验证助手。回答要简洁，使用简体中文。",
        temperature: 0.3,
      });

      setTrialResult(result.content);
      setStatusMessage(`试运行完成：${result.providerName} / ${result.model}`);
    } catch (error) {
      setTrialResult(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRunningTrial(false);
    }
  }

  async function handleCheckBackgroundRuntime() {
    setIsCheckingBackgroundRuntime(true);

    try {
      const status = await testBackgroundRemovalRuntime({
        executablePath: settings.backgroundRemovalExecutablePath,
      });

      setBackgroundRuntimeStatus(status);
      setBackgroundToolMessage(status.available ? `已检测到 rembg：${status.version || "版本未知"}。运行器：${status.command}` : status.detail);
    } finally {
      setIsCheckingBackgroundRuntime(false);
    }
  }

  async function handleWarmupBackgroundModel() {
    setIsWarmingBackgroundModel(true);
    setBackgroundToolMessage("正在预热模型。若模型未下载，rembg 会在这一步完成首次下载...");

    try {
      const result = await warmupBackgroundRemovalModel({
        executablePath: settings.backgroundRemovalExecutablePath,
        model: settings.backgroundRemovalModel,
        modelPath: settings.backgroundRemovalModelPath,
      });

      setBackgroundRuntimeStatus(result.runtime);
      setBackgroundToolMessage(`${result.message} 模型路径：${result.modelPath}`);
      await refreshBackgroundModelStatuses();
    } catch (error) {
      setBackgroundToolMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWarmingBackgroundModel(false);
    }
  }

  async function handleSelectBackgroundRuntime() {
    const selectedPath = await open({
      directory: false,
      multiple: false,
      title: "选择 rembg 运行器",
    });

    if (typeof selectedPath === "string") {
      updateSettings({ backgroundRemovalExecutablePath: selectedPath });
      setBackgroundToolMessage("已选择 rembg 运行器路径，保存设置后会作为默认运行器使用。");
    }
  }

  if (isLoadingProviderData) {
    return (
      <section className="ai-model-settings-shell">
        <div className="ai-provider-management">
          <aside className="ai-provider-sidebar">
            <header>
              <strong>服务商列表</strong>
              <Button disabled size="sm" type="button" variant="outline">
                <Plus aria-hidden="true" />
                添加服务商
              </Button>
            </header>
            <div className="ai-provider-empty-state ai-provider-loading-state">
              <ServerCog aria-hidden="true" />
              <strong>正在读取 AI 服务商</strong>
              <span>正在加载服务商、模型和用途绑定配置。</span>
            </div>
          </aside>
          <div className="ai-provider-detail ai-provider-loading-panel">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>
    );
  }

  if (!selectedProvider) {
    return (
      <section className="ai-model-settings-shell">
        <div className="ai-provider-management">
          <aside className="ai-provider-sidebar">
            <header>
              <strong>服务商列表</strong>
              <Button onClick={handleCreateProvider} size="sm" type="button" variant="outline">
                <Plus aria-hidden="true" />
                添加服务商
              </Button>
            </header>
            <div className="ai-provider-empty-state">
              <ServerCog aria-hidden="true" />
              <strong>还没有添加 AI 服务商</strong>
              <span>先添加服务商和模型，再绑定到生成流水线。</span>
            </div>
          </aside>
        </div>
        {isDialogOpen ? (
          <AiProviderDialog
            onClose={() => {
              setIsDialogOpen(false);
              setEditingProvider(undefined);
            }}
            onSave={(provider, modelNames) => void handleSaveProvider(provider, modelNames)}
          />
        ) : null}
      </section>
    );
  }

  const ProviderIcon = getProviderIcon(selectedProvider);

  return (
    <section className="ai-model-settings-shell" aria-label="AI 模型设置">
      <div className="ai-provider-management">
        <aside className="ai-provider-sidebar">
          <header>
            <strong>服务商列表</strong>
            <Button onClick={handleCreateProvider} size="sm" type="button" variant="outline">
              <Plus aria-hidden="true" />
              添加服务商
            </Button>
          </header>
          <div className="ai-provider-nav-list">
            {providers.map((provider) => {
              const Icon = getProviderIcon(provider);
              const isActive = provider.id === selectedProvider.id;
              const modelCount = models.filter((model) => model.providerId === provider.id).length;

              return (
                <button className="ai-provider-nav-item" data-active={isActive} key={provider.id} onClick={() => setSelectedProviderId(provider.id)} type="button">
                  <span className="ai-provider-nav-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{provider.name}</strong>
                    <small>{modelCount} 个模型</small>
                  </span>
                  <i aria-hidden="true" data-online={provider.apiBase ? "true" : "false"} />
                </button>
              );
            })}
          </div>
        </aside>

        <div className="ai-provider-detail">
          <header className="ai-provider-detail-header">
            <div className="ai-provider-title-lockup">
              <span className="ai-provider-detail-icon">
                <ProviderIcon aria-hidden="true" />
              </span>
              <div>
                <div className="ai-provider-heading-line">
                  <h3>{selectedProvider.name}</h3>
                  <span className="ai-provider-badge">{selectedProvider.isDefault ? "默认服务商" : providerTypeLabels[selectedProvider.providerType]}</span>
                </div>
                <p>{selectedProvider.apiBase}</p>
              </div>
            </div>
            <div className="ai-provider-actions">
              <Button onClick={() => void testAiProvider(selectedProvider).then((result) => setStatusMessage(result.message))} type="button" variant="outline">
                <CheckCircle2 aria-hidden="true" />
                测试连接
              </Button>
              <Button onClick={() => handleEditProvider(selectedProvider)} type="button" variant="outline">
                <Pencil aria-hidden="true" />
                编辑
              </Button>
              <Button aria-label="删除服务商" onClick={() => void handleDeleteProvider(selectedProvider.id)} size="icon" type="button" variant="outline">
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </header>

          <section className="ai-model-table-card">
            <header className="ai-model-table-toolbar">
              <div>
                <strong>模型列表</strong>
                <span>共 {providerModels.length} 个模型</span>
              </div>
              <label className="ai-model-search">
                <Search aria-hidden="true" />
                <input onChange={(event) => setModelSearch(event.target.value)} placeholder="搜索模型..." value={modelSearch} />
              </label>
            </header>

            <div className="ai-model-table">
              <div className="ai-model-table-head">
                <span>模型名称</span>
                <span>类型</span>
                <span>状态</span>
                <span>默认</span>
                <span>操作</span>
              </div>
              {filteredProviderModels.length > 0 ? (
                filteredProviderModels.map((model) => {
                  const ModelIcon = modelKindIconMap[model.modelKind];

                  return (
                    <article className="ai-model-table-row" key={model.id}>
                      <div className="ai-model-name-cell">
                        <ModelIcon aria-hidden="true" />
                        <span className="ai-model-name-stack">
                          <span className="ai-model-name-line">
                            <strong>{model.displayName || model.name}</strong>
                            {model.isDefault ? <small>推荐</small> : null}
                            {selectedProvider.preset === "local-diffusion" ? (
                              <Badge variant={localProfileReadyById[model.name] ? "secondary" : "outline"}>
                                {localProfileReadyById[model.name] ? "已就绪" : "未就绪"}
                              </Badge>
                            ) : null}
                          </span>
                          <span className="ai-model-name-meta">
                            {formatContextLength(model)} · {getModelCapabilities(model).join(" / ")}
                          </span>
                        </span>
                      </div>
                      <span>{modelKindLabels[model.modelKind]}</span>
                      <button className="ai-model-status" data-enabled={model.isEnabled ? "true" : "false"} onClick={() => void handleToggleModel(model)} type="button">
                        {model.isEnabled ? "已启用" : "已禁用"}
                      </button>
                      <button aria-label="设为默认模型" className="ai-model-default-button" data-active={model.isDefault ? "true" : "false"} onClick={() => void handleSetDefaultModel(model)} type="button">
                        <Star aria-hidden="true" />
                      </button>
                      <Button onClick={() => setEditingModel(model)} size="sm" type="button" variant="ghost">
                        参数
                      </Button>
                    </article>
                  );
                })
              ) : (
                <div className="ai-model-table-empty">没有匹配的模型。可以编辑服务商，在模型标签中添加更多模型。</div>
              )}
            </div>
          </section>
        </div>
      </div>

      <section className="ai-binding-card">
        <header>
          <div>
            <strong>模型用途绑定</strong>
            <span>为不同生产模块选择默认服务商和模型。</span>
          </div>
          <small>{statusMessage}</small>
        </header>
        <div className="pipeline-binding-list" data-disabled={providers.length === 0}>
          {pipelineBindings.map((binding) => {
            const Icon = binding.icon;
            const value = settings[binding.field];
            const providerId = settings[binding.providerField];
            const selectedBindingProvider = providers.find((provider) => provider.id === providerId);
            const providerOptions = [
              { label: "未选择", value: "" },
              ...providers.map((provider) => ({
                label: provider.name,
                value: provider.id,
              })),
            ];
            const modelOptions = getProviderModelOptions(selectedBindingProvider, models, binding.kind);
            const selectedModelValue = modelOptions.some((option) => option.value === value) ? value : "";

            return (
              <div className="pipeline-binding-row" key={binding.field}>
                <Icon aria-hidden="true" />
                <span>{binding.label}</span>
                <SettingsSelect
                  disabled={providers.length === 0}
                  label="服务商"
                  onChange={(nextProviderId) => updateBindingProvider(binding.providerField, nextProviderId)}
                  options={providerOptions.length > 0 ? providerOptions : [{ label: "请先添加服务商", value: "" }]}
                  value={selectedBindingProvider?.id ?? ""}
                />
                <SettingsSelect
                  disabled={providers.length === 0}
                  label="模型"
                  onChange={(nextModel) => updateSettings({ [binding.field]: nextModel })}
                  options={modelOptions}
                  value={selectedModelValue}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="ai-trial-card">
        <header>
          <div>
            <strong>AI 试运行</strong>
            <span>使用当前服务商和文本模型发送一次真实请求，验证生成链路是否可用。</span>
          </div>
          <Button disabled={isRunningTrial || !selectedProvider || !trialModel} onClick={() => void handleRunAiTrial()} type="button">
            {isRunningTrial ? <LoaderCircle aria-hidden="true" className="ai-trial-spinner" /> : <Sparkles aria-hidden="true" />}
            {isRunningTrial ? "运行中" : "运行测试"}
          </Button>
        </header>
        <div className="ai-trial-layout">
          <div className="ai-trial-input-panel">
            <div className="ai-trial-controls">
              <SettingsSelect
                disabled={trialTextModelOptions.length === 0}
                label="文本模型"
                onChange={setTrialModel}
                options={trialTextModelOptions.length > 0 ? trialTextModelOptions : [{ label: "无可用文本模型", value: "" }]}
                value={trialModel}
              />
            </div>
            <label className="ai-trial-prompt">
              <span>提示词</span>
              <Textarea onChange={(event) => setTrialPrompt(event.target.value)} value={trialPrompt} />
            </label>
          </div>
          <div className="ai-trial-result-panel">
            <div>
              <strong>模型返回</strong>
              <span>{selectedProvider.name} · {trialModel || "未选择模型"}</span>
            </div>
            <pre>{trialResult}</pre>
          </div>
        </div>
      </section>

      <section className="ai-local-tool-card">
        <header>
          <div>
            <strong>本地 AI 工具</strong>
            <span>配置去背景工具的默认算法和参数。快速纯色背景内置可用，AI 语义去背景会调用本机 rembg 命令行运行器。</span>
          </div>
          <div className="ai-local-tool-actions">
            <Button disabled={isCheckingBackgroundRuntime} onClick={() => void handleCheckBackgroundRuntime()} size="sm" type="button" variant="outline">
              <CheckCircle2 aria-hidden="true" />
              {isCheckingBackgroundRuntime ? "检测中" : "检测运行器"}
            </Button>
            <Button disabled={isWarmingBackgroundModel || settings.backgroundRemovalEngine !== "rembg"} onClick={() => void handleWarmupBackgroundModel()} size="sm" type="button" variant="outline">
              <Download aria-hidden="true" />
              {isWarmingBackgroundModel ? "预热中" : "预热/下载模型"}
            </Button>
          </div>
        </header>
        <div className="ai-local-tool-status">
          <Eraser aria-hidden="true" />
          <span>{backgroundToolMessage}</span>
          {backgroundRuntimeStatus ? (
            <strong data-ok={backgroundRuntimeStatus.available ? "true" : "false"}>
              {backgroundRuntimeStatus.available ? "运行器可用" : "运行器不可用"}
            </strong>
          ) : null}
        </div>
        <div className="ai-local-tool-grid">
          <SettingsSelect
            label="默认去背景算法"
            onChange={(backgroundRemovalEngine) => updateSettings({ backgroundRemovalEngine })}
            options={backgroundRemovalEngineOptions}
            value={settings.backgroundRemovalEngine}
          />
          <SettingsField description="留空时调用系统 PATH 中的 rembg；填写路径后会优先调用指定运行器，后续 sidecar 也会走这里。" label="rembg 运行器">
            <div className="ai-local-runtime-path">
              <Input
                disabled={settings.backgroundRemovalEngine !== "rembg"}
                onChange={(event) => updateSettings({ backgroundRemovalExecutablePath: event.target.value })}
                placeholder="留空使用系统 rembg，或选择 rembg.exe"
                value={settings.backgroundRemovalExecutablePath}
              />
              <Button disabled={settings.backgroundRemovalEngine !== "rembg"} onClick={() => void handleSelectBackgroundRuntime()} type="button" variant="outline">
                选择
              </Button>
            </div>
          </SettingsField>
          <SettingsSelect
            disabled={settings.backgroundRemovalEngine !== "rembg"}
            label="语义去背景模型"
            onChange={(backgroundRemovalModel) => updateSettings({ backgroundRemovalModel })}
            options={backgroundRemovalModelOptions}
            value={settings.backgroundRemovalModel}
          />
          <SettingsField description="快速纯色背景算法使用。数值越高越容易清理残留，也更可能误伤角色边缘。" label="默认容差">
            <Input
              max={96}
              min={4}
              onChange={(event) =>
                updateSettings({
                  backgroundRemovalTolerance: clampNumber(event.target.value, 4, 96, 34),
                })
              }
              type="number"
              value={settings.backgroundRemovalTolerance}
            />
          </SettingsField>
          <SettingsField description="快速纯色背景算法使用。控制半透明过渡范围，降低硬边和白边。" label="边缘柔化">
            <Input
              max={96}
              min={0}
              onChange={(event) =>
                updateSettings({
                  backgroundRemovalEdgeSoftness: clampNumber(event.target.value, 0, 96, 24),
                })
              }
              type="number"
              value={settings.backgroundRemovalEdgeSoftness}
            />
          </SettingsField>
          <SettingsSelect
            disabled={settings.backgroundRemovalEngine !== "chroma"}
            label="碎点清理"
            onChange={(backgroundRemovalCleanupStrength) => updateSettings({ backgroundRemovalCleanupStrength })}
            options={backgroundRemovalCleanupStrengthOptions}
            value={settings.backgroundRemovalCleanupStrength}
          />
          <SettingsField description="快速纯色背景算法使用。小孔洞会被填回前景；设为 0 可关闭填洞。" label="孔洞填补上限">
            <Input
              disabled={settings.backgroundRemovalEngine !== "chroma"}
              max={4096}
              min={0}
              onChange={(event) =>
                updateSettings({
                  backgroundRemovalHoleFillMaxPixels: clampNumber(event.target.value, 0, 4096, 128),
                })
              }
              type="number"
              value={settings.backgroundRemovalHoleFillMaxPixels}
            />
          </SettingsField>
          <SettingsField description="快速纯色背景算法使用。压低半透明边缘沾染的白底、绿幕或噪声色。" label="残色抑制">
            <Input
              disabled={settings.backgroundRemovalEngine !== "chroma"}
              max={100}
              min={0}
              onChange={(event) =>
                updateSettings({
                  backgroundRemovalSpillSuppression: clampNumber(event.target.value, 0, 100, 45),
                })
              }
              type="number"
              value={settings.backgroundRemovalSpillSuppression}
            />
          </SettingsField>
          <SettingsField description="rembg alpha matting 前景阈值，后续模型运行器接入后生效。" label="前景阈值">
            <Input
              disabled={settings.backgroundRemovalEngine !== "rembg"}
              max={255}
              min={0}
              onChange={(event) =>
                updateSettings({
                  backgroundRemovalForegroundThreshold: clampNumber(event.target.value, 0, 255, 240),
                })
              }
              type="number"
              value={settings.backgroundRemovalForegroundThreshold}
            />
          </SettingsField>
          <SettingsField description="rembg alpha matting 背景阈值，后续模型运行器接入后生效。" label="背景阈值">
            <Input
              disabled={settings.backgroundRemovalEngine !== "rembg"}
              max={255}
              min={0}
              onChange={(event) =>
                updateSettings({
                  backgroundRemovalBackgroundThreshold: clampNumber(event.target.value, 0, 255, 10),
                })
              }
              type="number"
              value={settings.backgroundRemovalBackgroundThreshold}
            />
          </SettingsField>
          <SettingsField description="自定义模型时填写本地 ONNX 或模型目录路径；下载/选择模型会在后续模型管理命令中接入。" label="模型路径">
            <Input
              disabled={settings.backgroundRemovalEngine !== "rembg" || settings.backgroundRemovalModel !== "custom"}
              onChange={(event) => updateSettings({ backgroundRemovalModelPath: event.target.value })}
              placeholder="例如 D:\\JMTools\\models\\rembg\\model.onnx"
              value={settings.backgroundRemovalModelPath}
            />
          </SettingsField>
          <SettingsCheckboxRow
            checked={settings.backgroundRemovalAlphaMatting}
            description="启用后会使用前景/背景阈值优化半透明边缘，适合头发、披风、光效等复杂边界。"
            label="启用 Alpha Matting"
            onChange={(backgroundRemovalAlphaMatting) => updateSettings({ backgroundRemovalAlphaMatting })}
          />
          <SettingsCheckboxRow
            checked={settings.backgroundRemovalPreserveSmallParts}
            description="启用后不会清理较小的孤立前景块，适合保留武器碎光、发梢、特效粒子等细节。"
            label="保留小部件"
            onChange={(backgroundRemovalPreserveSmallParts) => updateSettings({ backgroundRemovalPreserveSmallParts })}
          />
        </div>
        <div className="ai-local-model-list" aria-label="去背景模型状态">
          {backgroundModelStatuses.map((modelStatus) => (
            <article data-active={settings.backgroundRemovalModel === modelStatus.id} key={modelStatus.id}>
              <div>
                <strong>{modelStatus.label}</strong>
                <span>{modelStatus.description}</span>
                <small>{modelStatus.path}</small>
              </div>
              <Badge variant={modelStatus.installed ? "secondary" : "outline"}>
                {modelStatus.installed ? "已下载" : "未检测到"}
              </Badge>
            </article>
          ))}
        </div>
      </section>

      {isDialogOpen ? (
        <AiProviderDialog
          initialModels={editingProvider ? models.filter((model) => model.providerId === editingProvider.id) : undefined}
          initialProvider={editingProvider}
          onClose={() => {
            setIsDialogOpen(false);
            setEditingProvider(undefined);
          }}
          onSave={(provider, modelNames, remoteModels) => void handleSaveProvider(provider, modelNames, remoteModels)}
        />
      ) : null}
      {editingModel ? (
        <ModelParameterDialog
          model={editingModel}
          onClose={() => setEditingModel(undefined)}
          onSave={(model) => void handleSaveModelParameters(model)}
        />
      ) : null}
    </section>
  );
}
