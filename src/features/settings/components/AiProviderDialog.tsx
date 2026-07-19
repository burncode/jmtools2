import { RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AiModelProvider, AiModelProviderType, AiProviderModel, AiProviderRemoteModel } from "@/lib/tauri/commands";
import { createProviderFromPreset } from "@/features/ai-models/providerFactory";
import {
  buildRemoteModelRefreshMessage,
  isImageSelectableModelKind,
  isTextSelectableModelKind,
} from "@/features/ai-models/providerModelImport";
import { refreshProviderModels, testAiProvider } from "@/features/ai-models/providerService";
import { getPresetsByType, providerTypeOptions } from "@/features/ai-models/providerPresets";

import { SettingsCheckboxRow, SettingsField, SettingsSelect } from "./SettingsControls";
import { SettingsModal } from "./SettingsModal";

interface AiProviderDialogProps {
  initialModels?: AiProviderModel[];
  initialProvider?: AiModelProvider;
  onClose: () => void;
  onSave: (provider: AiModelProvider, modelNames: ProviderModelNames, remoteModels: AiProviderRemoteModel[]) => void;
}

export interface ProviderModelNames {
  image: string[];
  text: string[];
}

function normalizeModelNames(models: string[]) {
  return models.map((model) => model.trim()).filter((model, index, allModels) => model && allModels.indexOf(model) === index);
}

function getInitialModelNames(
  provider: AiModelProvider,
  initialModels: AiProviderModel[] | undefined,
  bucket: "image" | "text",
) {
  const modelNames =
    initialModels
      ?.filter((model) =>
        bucket === "text" ? isTextSelectableModelKind(model.modelKind) : isImageSelectableModelKind(model.modelKind),
      )
      .map((model) => model.name) ?? [];
  const legacyModel = bucket === "text" ? provider.textModel : provider.imageModel;

  return normalizeModelNames([...modelNames, legacyModel]);
}

function ModelTagField({
  label,
  models,
  onChange,
  options,
  onRefresh,
  refreshDisabled,
  selectedValue,
  onSelectedValueChange,
}: {
  label: string;
  models: string[];
  onChange: (models: string[]) => void;
  onRefresh: () => void;
  onSelectedValueChange: (value: string) => void;
  options: readonly { label: string; value: string }[];
  refreshDisabled: boolean;
  selectedValue: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const label = option.label.toLocaleLowerCase();
      const value = option.value.toLocaleLowerCase();

      return label.includes(normalizedQuery) || value.includes(normalizedQuery);
    });
  }, [options, query]);

  function addModel() {
    const nextModel = selectedValue.trim();

    if (!nextModel) {
      return;
    }

    onChange(normalizeModelNames([...models, nextModel]));
    onSelectedValueChange("");
    setQuery("");
    setIsOpen(false);
  }

  function selectModel(modelName: string) {
    onSelectedValueChange(modelName);
    setQuery(modelName);
    setIsOpen(false);
  }

  return (
    <SettingsField label={label}>
      <div className="settings-model-tags">
        <div className="settings-model-tag-input">
          <div className="settings-model-combobox">
            <Input
              aria-label={`${label}搜索`}
              onBlur={() => {
                window.setTimeout(() => setIsOpen(false), 120);
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={selectedValue || "搜索模型，或先刷新列表"}
              value={query}
            />
            {isOpen ? (
              <div className="settings-model-combobox-list">
                {options.length === 0 ? (
                  <div className="settings-model-combobox-empty">请先刷新模型列表</div>
                ) : (
                  <>
                    <div className="settings-model-combobox-meta">共 {options.length} 个，可滚动查看</div>
                    {filteredOptions.length > 0 ? (
                      filteredOptions.map((option) => (
                        <button
                          className="settings-model-combobox-item"
                          data-selected={option.value === selectedValue}
                          key={option.value}
                          onClick={() => selectModel(option.value)}
                          onMouseDown={(event) => event.preventDefault()}
                          title={option.label}
                          type="button"
                        >
                          <span>{option.label}</span>
                          <small>{option.value}</small>
                        </button>
                      ))
                    ) : (
                      <div className="settings-model-combobox-empty">没有匹配的模型</div>
                    )}
                  </>
                )}
              </div>
            ) : null}
          </div>
          <Button disabled={refreshDisabled} onClick={onRefresh} size="sm" type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            刷新
          </Button>
          <Button onClick={addModel} size="sm" type="button" variant="outline">
            添加
          </Button>
        </div>
        <div className="settings-model-tag-list">
          {models.length > 0 ? (
            models.map((model) => (
              <button
                className="settings-model-tag"
                key={model}
                onClick={() => onChange(models.filter((item) => item !== model))}
                title="点击移除模型"
                type="button"
              >
                <span>{model}</span>
                <X aria-hidden="true" />
              </button>
            ))
          ) : (
            <span className="settings-model-tag-empty">暂未添加模型</span>
          )}
        </div>
      </div>
    </SettingsField>
  );
}

export function AiProviderDialog({ initialModels, initialProvider, onClose, onSave }: AiProviderDialogProps) {
  const isEditing = Boolean(initialProvider);
  const [providerType, setProviderType] = useState<AiModelProviderType>(initialProvider?.providerType ?? "domestic");
  const presets = useMemo(() => getPresetsByType(providerType), [providerType]);
  const [presetValue, setPresetValue] = useState<string>(initialProvider?.preset ?? presets[0]?.value ?? "deepseek");
  const [provider, setProvider] = useState<AiModelProvider>(() => initialProvider ?? createProviderFromPreset(presetValue));
  const [textModels, setTextModels] = useState<string[]>(() =>
    getInitialModelNames(initialProvider ?? createProviderFromPreset(presetValue), initialModels, "text"),
  );
  const [imageModels, setImageModels] = useState<string[]>(() =>
    getInitialModelNames(initialProvider ?? createProviderFromPreset(presetValue), initialModels, "image"),
  );
  const [remoteModels, setRemoteModels] = useState<AiProviderRemoteModel[]>([]);
  const [selectedTextModel, setSelectedTextModel] = useState("");
  const [selectedImageModel, setSelectedImageModel] = useState("");
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [testMessage, setTestMessage] = useState("等待测试连接...");
  const isLocalDiffusion = provider.preset === "local-diffusion" || presetValue === "local-diffusion";

  const textModelOptions = useMemo(
    () =>
      remoteModels
        .filter((model) => isTextSelectableModelKind(model.modelKind))
        .map((model) => ({ label: model.displayName || model.name, value: model.name })),
    [remoteModels],
  );
  const imageModelOptions = useMemo(
    () =>
      remoteModels
        .filter((model) => isImageSelectableModelKind(model.modelKind))
        .map((model) => ({ label: model.displayName || model.name, value: model.name })),
    [remoteModels],
  );

  function handleTypeChange(nextType: AiModelProviderType) {
    const nextPresets = getPresetsByType(nextType);
    const nextPresetValue = nextPresets[0]?.value ?? "openai-compatible";

    setProviderType(nextType);
    setPresetValue(nextPresetValue);
    const nextProvider = createProviderFromPreset(nextPresetValue);

    setProvider(nextProvider);
    setTextModels(normalizeModelNames([nextProvider.textModel]));
    setImageModels(normalizeModelNames([nextProvider.imageModel]));
    setRemoteModels([]);
    setSelectedTextModel("");
    setSelectedImageModel("");
  }

  function handlePresetChange(nextPresetValue: string) {
    setPresetValue(nextPresetValue);
    const nextProvider = createProviderFromPreset(nextPresetValue);

    setProvider(nextProvider);
    setTextModels(normalizeModelNames([nextProvider.textModel]));
    setImageModels(normalizeModelNames([nextProvider.imageModel]));
    setRemoteModels([]);
    setSelectedTextModel("");
    setSelectedImageModel("");

    if (nextPresetValue === "local-diffusion") {
      void handleRefreshModels(nextProvider);
    }
  }

  function updateProvider(nextProvider: Partial<AiModelProvider>) {
    setProvider((currentProvider) => ({ ...currentProvider, ...nextProvider }));
  }

  async function handleTestProvider() {
    const result = await testAiProvider(provider);

    setTestMessage(result.message);
  }

  async function handleRefreshModels(providerOverride?: AiModelProvider) {
    const targetProvider = providerOverride ?? provider;
    setIsRefreshingModels(true);
    setTestMessage("正在刷新模型列表...");

    try {
      const refreshedModels = await refreshProviderModels(targetProvider);

      setRemoteModels(refreshedModels);
      setSelectedTextModel(
        refreshedModels.find((model) => isTextSelectableModelKind(model.modelKind))?.name ?? "",
      );
      setSelectedImageModel(
        refreshedModels.find((model) => isImageSelectableModelKind(model.modelKind))?.name ?? "",
      );
      setTestMessage(buildRemoteModelRefreshMessage(refreshedModels));
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshingModels(false);
    }
  }

  return (
    <SettingsModal
      ariaLabel={isEditing ? "编辑模型服务提供商" : "添加模型服务提供商"}
      className="settings-provider-modal"
      footer={
        <>
          <Button onClick={onClose} type="button" variant="outline">
            取消
          </Button>
          <Button onClick={() => void handleTestProvider()} type="button" variant="outline">
            测试连接
          </Button>
          <Button
            onClick={() =>
              onSave(
                {
                  ...provider,
                  imageModel: imageModels[0] ?? "",
                  textModel: textModels[0] ?? "",
                },
                { image: imageModels, text: textModels },
                remoteModels,
              )
            }
            type="button"
          >
            {isEditing ? "保存修改" : "保存提供商"}
          </Button>
        </>
      }
      header={
        <>
          <div>
            <span className="settings-kicker">AI 模型</span>
            <h3>{isEditing ? "编辑模型服务提供商" : "添加模型服务提供商"}</h3>
            <p>{isEditing ? "修改连接参数和默认模型，保存后会继续用于现有绑定。" : "选择类型和预设后，填写连接参数并保存。"}</p>
          </div>
          <Button aria-label="关闭" onClick={onClose} size="icon" type="button" variant="ghost">
            <X />
          </Button>
        </>
      }
      onClose={onClose}
    >
          {isEditing ? (
            <div className="settings-note">
              当前正在编辑已有服务商。刷新只更新可选列表，不会自动写入模型；请搜索后点击「添加」，保存时才会写入模型列表。
            </div>
          ) : (
            <>
              <div className="settings-modal-grid">
                <SettingsSelect
                  label="提供商类型"
                  onChange={handleTypeChange}
                  options={providerTypeOptions}
                  value={providerType}
                />
                <SettingsSelect
                  label="预设提供商"
                  onChange={handlePresetChange}
                  options={presets.map((preset) => ({ label: preset.label, value: preset.value }))}
                  value={presetValue}
                />
              </div>
              <div className="settings-note">预设只会自动填充 API Base。刷新后在下方搜索模型并点击「添加」，保存后才会写入列表。</div>
            </>
          )}
          <SettingsField label="提供商名称">
            <Input onChange={(event) => updateProvider({ name: event.target.value })} value={provider.name} />
          </SettingsField>
          <SettingsField label="API Base">
            <Input onChange={(event) => updateProvider({ apiBase: event.target.value })} value={provider.apiBase} />
          </SettingsField>
          <SettingsField description="API Key 目前存入本机 SQLite，后续会接入系统密钥链。" label="API Key">
            <Input
              onChange={(event) => updateProvider({ apiKey: event.target.value })}
              placeholder={isLocalDiffusion ? "本地生图无需 API Key" : "sk-... 或本地服务留空"}
              type="password"
              value={provider.apiKey}
            />
          </SettingsField>
          {isLocalDiffusion ? (
            <div className="settings-note">
              模型下载与 Runtime 安装请前往「设置 → 本地生图」（运行环境 / 模型管理）。刷新后可搜索 sd-cpp 档位并添加。
            </div>
          ) : null}
          {!isLocalDiffusion ? (
            <ModelTagField
              label="文本模型"
              models={textModels}
              onChange={setTextModels}
              onRefresh={() => void handleRefreshModels()}
              onSelectedValueChange={setSelectedTextModel}
              options={textModelOptions}
              refreshDisabled={isRefreshingModels}
              selectedValue={selectedTextModel}
            />
          ) : null}
          <ModelTagField
            label="图像模型"
            models={imageModels}
            onChange={setImageModels}
            onRefresh={() => void handleRefreshModels()}
            onSelectedValueChange={setSelectedImageModel}
            options={imageModelOptions}
            refreshDisabled={isRefreshingModels}
            selectedValue={selectedImageModel}
          />
          <SettingsCheckboxRow
            checked={provider.isDefault}
            label="设为默认服务"
            onChange={(isDefault) => updateProvider({ isDefault })}
          />
          <div className="settings-note">{testMessage}</div>
    </SettingsModal>
  );
}
