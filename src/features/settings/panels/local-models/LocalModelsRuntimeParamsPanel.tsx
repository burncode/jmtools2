import { useEffect, useMemo, useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  LocalGenerationLimitsResult,
  LocalInferenceSettings,
  SdCliCapabilities,
} from "@/lib/tauri/localModels";
import { getLocalGenerationLimits } from "@/lib/tauri/localModels";

import { SettingsField, SettingsSelect } from "../../components/SettingsControls";
import { LocalModelsRuntimeEffectivePreview } from "./LocalModelsRuntimeEffectivePreview";
import {
  runtimeCategoryLabels,
  runtimeParamCatalog,
  type RuntimeParamCategory,
  type RuntimePresetId,
} from "./runtimeParamCatalog";

interface LocalModelsRuntimeParamsPanelProps {
  activeProfileId: string;
  backendLabel?: string;
  capabilities: SdCliCapabilities | null;
  isSaving?: boolean;
  onSave: () => void;
  onSettingsChange: (settings: LocalInferenceSettings) => void;
  settings: LocalInferenceSettings;
}

type TriStateValue = "follow" | "on" | "off";

function triStateFromOptional(value: boolean | null | undefined): TriStateValue {
  if (value === true) {
    return "on";
  }
  if (value === false) {
    return "off";
  }
  return "follow";
}

function optionalFromTriState(value: TriStateValue): boolean | null {
  if (value === "on") {
    return true;
  }
  if (value === "off") {
    return false;
  }
  return null;
}

function detectPreset(settings: LocalInferenceSettings): RuntimePresetId {
  const isManifest =
    settings.runtimeOffloadToCpu == null &&
    settings.runtimeDiffusionFa == null &&
    settings.runtimeClipOnCpu == null &&
    !settings.runtimeVaeOnCpu &&
    !settings.runtimeVaeTiling &&
    !settings.runtimeParamsBackend &&
    !settings.runtimeBackend;
  if (isManifest) {
    return "manifest";
  }
  if (
    settings.runtimeOffloadToCpu === true &&
    settings.runtimeDiffusionFa === true &&
    settings.runtimeVaeOnCpu &&
    settings.runtimeVaeTiling &&
    settings.runtimeClipOnCpu === true
  ) {
    return "ultraLowVram";
  }
  if (
    settings.runtimeOffloadToCpu === true &&
    settings.runtimeDiffusionFa === true &&
    settings.runtimeVaeOnCpu
  ) {
    return "lowVram";
  }
  return "custom";
}

function applyPreset(
  preset: RuntimePresetId,
  settings: LocalInferenceSettings,
): LocalInferenceSettings {
  if (preset === "manifest") {
    return {
      ...settings,
      runtimeOffloadToCpu: null,
      runtimeDiffusionFa: null,
      runtimeClipOnCpu: null,
      runtimeVaeOnCpu: false,
      runtimeVaeTiling: false,
      runtimeVaeTileOverlap: null,
      runtimeParamsBackend: null,
      runtimeBackend: null,
    };
  }
  if (preset === "lowVram") {
    return {
      ...settings,
      runtimeOffloadToCpu: true,
      runtimeDiffusionFa: true,
      runtimeVaeOnCpu: true,
      runtimeVaeTiling: false,
      runtimeClipOnCpu: null,
    };
  }
  if (preset === "ultraLowVram") {
    return {
      ...settings,
      runtimeOffloadToCpu: true,
      runtimeDiffusionFa: true,
      runtimeVaeOnCpu: true,
      runtimeVaeTiling: true,
      runtimeClipOnCpu: true,
    };
  }
  return settings;
}

function isFlagSupported(capabilities: SdCliCapabilities | null, id: string) {
  if (!capabilities?.available) {
    return false;
  }
  return capabilities.supportedFlags.includes(id);
}

export function LocalModelsRuntimeParamsPanel({
  activeProfileId,
  backendLabel,
  capabilities,
  isSaving,
  onSave,
  onSettingsChange,
  settings,
}: LocalModelsRuntimeParamsPanelProps) {
  const [limitsResult, setLimitsResult] = useState<LocalGenerationLimitsResult | null>(null);
  const [limitsError, setLimitsError] = useState<string>();
  const activePreset = detectPreset(settings);

  useEffect(() => {
    let cancelled = false;
    void getLocalGenerationLimits(activeProfileId)
      .then((result) => {
        if (!cancelled) {
          setLimitsResult(result);
          setLimitsError(undefined);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLimitsResult(null);
          setLimitsError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeProfileId, settings]);

  const categories = useMemo(() => {
    const order: RuntimeParamCategory[] = ["memory", "vae", "encoder", "performance", "expert"];
    return order.map((category) => ({
      category,
      items: runtimeParamCatalog.filter((entry) => entry.category === category),
    }));
  }, []);

  function applyPresetTab(preset: RuntimePresetId) {
    if (preset === "custom") {
      return;
    }
    onSettingsChange(applyPreset(preset, settings));
  }

  return (
    <div className="local-models-runtime-params-grid">
      <div className="local-models-runtime-params-main space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">推理参数预设</p>
          <Tabs
            onValueChange={(value) => applyPresetTab(value as RuntimePresetId)}
            value={activePreset}
          >
            <TabsList className="local-models-runtime-preset-tabs">
              <TabsTrigger value="manifest">跟随 manifest</TabsTrigger>
              <TabsTrigger value="lowVram">低显存</TabsTrigger>
              <TabsTrigger value="ultraLowVram">极低显存</TabsTrigger>
              <TabsTrigger disabled value="custom">
                自定义
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {limitsError ? <p className="text-sm text-destructive">{limitsError}</p> : null}

        <Accordion className="space-y-2" defaultValue={["memory", "vae", "encoder", "performance"]} type="multiple">
          {categories.map(({ category, items }) => (
            <AccordionItem className="rounded-lg border border-border/60 px-3" key={category} value={category}>
              <AccordionTrigger className="py-2 text-sm font-medium hover:no-underline">
                {runtimeCategoryLabels[category]}
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3">
                {category === "memory" ? (
                  <>
                    <SettingsSelect
                      label="Offload to CPU"
                      onChange={(value) =>
                        onSettingsChange({
                          ...settings,
                          runtimeOffloadToCpu: optionalFromTriState(value as TriStateValue),
                        })
                      }
                      options={[
                        { label: "跟随 manifest 默认", value: "follow" },
                        { label: "开启", value: "on" },
                        { label: "关闭", value: "off" },
                      ]}
                      value={triStateFromOptional(settings.runtimeOffloadToCpu)}
                    />
                    {isFlagSupported(capabilities, "paramsBackend") ? (
                      <SettingsField
                        description="对应 --params-backend，留空则使用 Runtime 默认。"
                        label="Params Backend"
                      >
                        <Input
                          onChange={(event) =>
                            onSettingsChange({
                              ...settings,
                              runtimeParamsBackend: event.target.value,
                            })
                          }
                          placeholder="例如 cpu 或 vulkan"
                          value={settings.runtimeParamsBackend ?? ""}
                        />
                      </SettingsField>
                    ) : null}
                  </>
                ) : null}

                {category === "vae" ? (
                  <>
                    <SettingsSelect
                      disabled={!isFlagSupported(capabilities, "vaeOnCpu")}
                      label="VAE on CPU"
                      onChange={(value) =>
                        onSettingsChange({
                          ...settings,
                          runtimeVaeOnCpu: value === "on",
                        })
                      }
                      options={[
                        { label: "关闭", value: "off" },
                        { label: "开启", value: "on" },
                      ]}
                      value={settings.runtimeVaeOnCpu ? "on" : "off"}
                    />
                    <SettingsSelect
                      disabled={!isFlagSupported(capabilities, "vaeTiling")}
                      label="VAE Tiling"
                      onChange={(value) =>
                        onSettingsChange({
                          ...settings,
                          runtimeVaeTiling: value === "on",
                        })
                      }
                      options={[
                        { label: "关闭", value: "off" },
                        { label: "开启", value: "on" },
                      ]}
                      value={settings.runtimeVaeTiling ? "on" : "off"}
                    />
                    {isFlagSupported(capabilities, "vaeTileOverlap") ? (
                      <SettingsField description="0–0.9，需开启 VAE Tiling。" label="Tile Overlap">
                        <Input
                          max={0.9}
                          min={0}
                          onChange={(event) =>
                            onSettingsChange({
                              ...settings,
                              runtimeVaeTileOverlap: Number.parseFloat(event.target.value) || null,
                            })
                          }
                          step={0.05}
                          type="number"
                          value={settings.runtimeVaeTileOverlap ?? ""}
                        />
                      </SettingsField>
                    ) : null}
                  </>
                ) : null}

                {category === "encoder" ? (
                  <SettingsSelect
                    disabled={!isFlagSupported(capabilities, "clipOnCpu")}
                    label="文本编码器放 CPU"
                    onChange={(value) =>
                      onSettingsChange({
                        ...settings,
                        runtimeClipOnCpu: optionalFromTriState(value as TriStateValue),
                      })
                    }
                    options={[
                      { label: "跟随 manifest / 关闭", value: "follow" },
                      { label: "开启", value: "on" },
                      { label: "关闭", value: "off" },
                    ]}
                    value={triStateFromOptional(settings.runtimeClipOnCpu)}
                  />
                ) : null}

                {category === "performance" ? (
                  <>
                    <SettingsSelect
                      label="Diffusion FA"
                      onChange={(value) =>
                        onSettingsChange({
                          ...settings,
                          runtimeDiffusionFa: optionalFromTriState(value as TriStateValue),
                        })
                      }
                      options={[
                        { label: "跟随 manifest 默认", value: "follow" },
                        { label: "开启", value: "on" },
                        { label: "关闭", value: "off" },
                      ]}
                      value={triStateFromOptional(settings.runtimeDiffusionFa)}
                    />
                    {isFlagSupported(capabilities, "loraApplyMode") ? (
                      <SettingsField description="--lora-apply-mode" label="LoRA 应用模式">
                        <Select
                          onValueChange={(value) =>
                            onSettingsChange({ ...settings, runtimeLoraApplyMode: value })
                          }
                          value={settings.runtimeLoraApplyMode ?? "at_runtime"}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">auto</SelectItem>
                            <SelectItem value="at_runtime">at_runtime</SelectItem>
                            <SelectItem value="immediately">immediately</SelectItem>
                          </SelectContent>
                        </Select>
                      </SettingsField>
                    ) : null}
                  </>
                ) : null}

                {category === "expert" ? (
                  <>
                    {isFlagSupported(capabilities, "backend") ? (
                      <SettingsField description="--backend 模块分配字符串" label="Backend 分配">
                        <Input
                          onChange={(event) =>
                            onSettingsChange({ ...settings, runtimeBackend: event.target.value })
                          }
                          placeholder="留空使用默认"
                          value={settings.runtimeBackend ?? ""}
                        />
                      </SettingsField>
                    ) : (
                      <p className="text-xs text-muted-foreground">当前 Runtime 未暴露 backend 细粒度参数。</p>
                    )}
                  </>
                ) : null}

                {items.map((item) => (
                  <p className="text-xs text-muted-foreground" key={item.id}>
                    {item.cliFlag} · {item.description}
                  </p>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <SettingsField description="img2img 单独封顶，0 表示自动（比 txt2img 低一档）。" label="参考图生图最大边长">
          <Select
            onValueChange={(value) =>
              onSettingsChange({
                ...settings,
                maxImg2imgSide: Number.parseInt(value, 10) || 0,
              })
            }
            value={String(settings.maxImg2imgSide ?? 0)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">自动</SelectItem>
              <SelectItem value="384">384 px</SelectItem>
              <SelectItem value="512">512 px</SelectItem>
              <SelectItem value="768">768 px</SelectItem>
              <SelectItem value="1024">1024 px</SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>

        {!capabilities?.available ? (
          <Badge variant="outline">请先安装并选用 sd-cpp Runtime</Badge>
        ) : null}
      </div>

      <LocalModelsRuntimeEffectivePreview
        backendLabel={backendLabel ?? limitsResult?.backendLabel}
        capabilities={capabilities}
        isSaving={isSaving}
        limitsResult={limitsResult}
        onApplyLowVramPreset={() => applyPresetTab("lowVram")}
        onResetManifest={() => applyPresetTab("manifest")}
        onSave={onSave}
      />
    </div>
  );
}
