import { ExternalLink, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LocalGenerationLimitsResult, LocalInferenceSettings } from "@/lib/tauri/localModels";
import { getLocalGenerationLimits } from "@/lib/tauri/localModels";

import { SettingsField } from "../../components/SettingsControls";
import { SettingsSectionCard } from "../../components/SettingsSectionCard";

interface LocalModelsGenerationSettingsProps {
  activeProfileId: string;
  onOpenRuntimeTab?: () => void;
  onSettingsChange: (settings: LocalInferenceSettings) => void;
  settings: LocalInferenceSettings;
}

const maxSideOptions = [
  { label: "自动（按硬件推荐）", value: "0" },
  { label: "512 px", value: "512" },
  { label: "768 px", value: "768" },
  { label: "1024 px", value: "1024" },
  { label: "1536 px", value: "1536" },
] as const;

export function LocalModelsGenerationSettings({
  activeProfileId,
  onOpenRuntimeTab,
  onSettingsChange,
  settings,
}: LocalModelsGenerationSettingsProps) {
  const [limitsResult, setLimitsResult] = useState<LocalGenerationLimitsResult | null>(null);
  const [limitsError, setLimitsError] = useState<string>();

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

  const limits = limitsResult?.limits;
  const testWidth = settings.testWidth > 0 ? settings.testWidth : limits?.recommendedWidth ?? settings.generationWidth;
  const testHeight = settings.testHeight > 0 ? settings.testHeight : limits?.recommendedHeight ?? settings.generationHeight;
  const testExceedsLimit =
    limits != null && Math.max(testWidth, testHeight) > limits.maxSide;

  return (
    <SettingsSectionCard
      description="默认分辨率与 Runtime 低显存选项，测试出图与角色流水线共用。"
      icon={SlidersHorizontal}
      title="生图参数"
    >
      {limits ? (
        <p className="text-sm text-muted-foreground">
          当前推荐最大边长 <strong className="text-foreground">{limits.maxSide} px</strong>
          {limitsResult?.backendLabel ? ` · ${limitsResult.backendLabel}` : null}
        </p>
      ) : null}
      {limitsError ? <p className="text-sm text-destructive">{limitsError}</p> : null}
      {limits?.warnings.map((warning) => (
        <p className="text-xs text-muted-foreground" key={warning}>
          {warning}
        </p>
      )) ?? null}

      <div className="grid gap-3 sm:grid-cols-2">
        <SettingsField label="默认宽度">
          <Input
            max={2048}
            min={128}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                generationWidth: Number.parseInt(event.target.value, 10) || 512,
              })
            }
            type="number"
            value={settings.generationWidth}
          />
        </SettingsField>
        <SettingsField label="默认高度">
          <Input
            max={2048}
            min={128}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                generationHeight: Number.parseInt(event.target.value, 10) || 512,
              })
            }
            type="number"
            value={settings.generationHeight}
          />
        </SettingsField>
      </div>

      <SettingsField
        description="自动模式会结合显存、Vulkan 与 Klein 档位保守封顶。"
        label="最大边长"
      >
        <Select
          onValueChange={(value) =>
            onSettingsChange({
              ...settings,
              maxGenerationSide: Number.parseInt(value, 10) || 0,
            })
          }
          value={String(settings.maxGenerationSide || 0)}
        >
          <SelectTrigger>
            <SelectValue placeholder="选择最大边长" />
          </SelectTrigger>
          <SelectContent>
            {maxSideOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsField>

      <div className="grid gap-3 sm:grid-cols-2">
        <SettingsField label="Steps">
          <Input
            max={50}
            min={1}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                generationSteps: Number.parseInt(event.target.value, 10) || 4,
              })
            }
            type="number"
            value={settings.generationSteps}
          />
        </SettingsField>
        <SettingsField label="CFG Scale">
          <Input
            max={20}
            min={0.1}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                generationCfgScale: Number.parseFloat(event.target.value) || 1,
              })
            }
            step={0.1}
            type="number"
            value={settings.generationCfgScale}
          />
        </SettingsField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SettingsField description="0 表示使用推荐尺寸" label="测试宽度">
          <Input
            max={2048}
            min={0}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                testWidth: Number.parseInt(event.target.value, 10) || 0,
              })
            }
            placeholder={String(limits?.recommendedWidth ?? 512)}
            type="number"
            value={settings.testWidth || ""}
          />
        </SettingsField>
        <SettingsField description="0 表示使用推荐尺寸" label="测试高度">
          <Input
            max={2048}
            min={0}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                testHeight: Number.parseInt(event.target.value, 10) || 0,
              })
            }
            placeholder={String(limits?.recommendedHeight ?? 512)}
            type="number"
            value={settings.testHeight || ""}
          />
        </SettingsField>
      </div>
      {testExceedsLimit ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          测试尺寸 {testWidth}×{testHeight} 超过推荐上限 {limits?.maxSide} px，实际生图会自动缩小。
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Runtime 低显存与 offload 选项已移至
        {" "}
        <button
          className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
          onClick={onOpenRuntimeTab}
          type="button"
        >
          生图 Runtime
          <ExternalLink aria-hidden="true" className="size-3" />
        </button>
        {" "}
        Tab 配置。
      </p>
    </SettingsSectionCard>
  );
}
