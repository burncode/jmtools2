import { useEffect, useMemo, useState } from "react";

import { AppSelect, InspectorField } from "@/components/shared";
import { getAppSettings, listAiModelProviders, listAiProviderModels, type AiProviderModel } from "@/lib/tauri/commands";

export type AiProviderBinding = "character" | "text";

interface WorkflowAiProviderSelectProps {
  binding: AiProviderBinding;
  model: string;
  onModelChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  providerId: string;
}

const FOLLOW_SETTINGS_VALUE = "__follow_settings__";
const NO_MODEL_VALUE = "__no_model__";

const bindingLabels: Record<AiProviderBinding, string> = {
  character: "角色生成",
  text: "文本生成",
};

function toSelectValue(value: string) {
  return value.trim() || FOLLOW_SETTINGS_VALUE;
}

function fromSelectValue(value: string) {
  return value === FOLLOW_SETTINGS_VALUE ? "" : value;
}

export function WorkflowAiProviderSelect({
  binding,
  model,
  onModelChange,
  onProviderChange,
  providerId,
}: WorkflowAiProviderSelectProps) {
  const [providers, setProviders] = useState<Array<{ id: string; label: string }>>([]);
  const [models, setModels] = useState<AiProviderModel[]>([]);
  const [defaults, setDefaults] = useState({ model: "", providerId: "" });
  const [loadError, setLoadError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const settings = await getAppSettings();
        const providerField = binding === "text" ? "aiTextProviderId" : "aiCharacterProviderId";
        const modelField = binding === "text" ? "aiTextModel" : "aiCharacterModel";
        const defaultProviderId = String(settings[providerField] ?? "").trim();
        const defaultModel = String(settings[modelField] ?? "").trim();

        const providerModels = await listAiProviderModels();
        const providerRecords = await listAiModelProviders();
        if (cancelled) {
          return;
        }

        setProviders(
          providerRecords.map((provider) => ({
            id: provider.id,
            label: provider.name,
          })),
        );
        setModels(providerModels);
        setDefaults({ model: defaultModel, providerId: defaultProviderId });
        setLoadError(undefined);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "读取 AI 设置失败。");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [binding]);

  const modelKind = binding === "text" ? "text" : "image";
  const providerOptions = useMemo(
    () => [
      { label: defaults.providerId ? `跟随设置（${bindingLabels[binding]}）` : "跟随设置", value: FOLLOW_SETTINGS_VALUE },
      ...providers.map((provider) => ({ label: provider.label, value: provider.id })),
    ],
    [binding, defaults.providerId, providers],
  );
  const activeProviderId = providerId.trim() || defaults.providerId;
  const activeModel = model.trim() || defaults.model;
  const activeProviderLabel =
    providers.find((item) => item.id === activeProviderId)?.label ?? activeProviderId ?? "未配置";
  const effectiveSummary = activeModel
    ? `当前：设置 → ${bindingLabels[binding]} · ${activeProviderLabel} · ${activeModel}`
    : `当前：设置 → ${bindingLabels[binding]} · ${activeProviderLabel}`;

  const modelOptions = useMemo(() => {
    const filtered = models.filter(
      (item) => item.providerId === activeProviderId && item.modelKind === modelKind && item.isEnabled,
    );

    if (filtered.length === 0) {
      return [{ label: "暂无可用模型", value: NO_MODEL_VALUE }];
    }

    return [
      { label: defaults.model ? `跟随设置（${defaults.model}）` : "跟随设置", value: FOLLOW_SETTINGS_VALUE },
      ...filtered.map((item) => ({
        label: item.displayName || item.name,
        value: item.name,
      })),
    ];
  }, [activeProviderId, defaults.model, modelKind, models]);

  return (
    <InspectorField
      hint={
        loadError ??
        `留空则使用设置中的「${bindingLabels[binding]}」绑定；也可在此节点单独覆盖。`
      }
      label={`AI 模型（${bindingLabels[binding]}）`}
    >
      <div className="workflow-ai-provider-select">
        <p className="workflow-ai-provider-effective">{effectiveSummary}</p>
        <AppSelect
          ariaLabel="AI 服务商"
          onValueChange={(nextValue) => onProviderChange(fromSelectValue(nextValue))}
          options={providerOptions}
          value={toSelectValue(providerId)}
        />
        <AppSelect
          ariaLabel="AI 模型"
          onValueChange={(nextValue) => {
            if (nextValue === NO_MODEL_VALUE) {
              return;
            }
            onModelChange(fromSelectValue(nextValue));
          }}
          options={modelOptions}
          value={modelOptions.some((option) => option.value === toSelectValue(model)) ? toSelectValue(model) : modelOptions[0]?.value ?? NO_MODEL_VALUE}
        />
      </div>
    </InspectorField>
  );
}
