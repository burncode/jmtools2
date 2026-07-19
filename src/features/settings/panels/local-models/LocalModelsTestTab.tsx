import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Download, FolderOpen, ImagePlus, Sparkles, TestTubeDiagonal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LocalInferenceActivity, LocalInferenceSettings, LocalLoraStatus } from "@/lib/tauri/localModels";

import { SettingsCheckboxRow, SettingsField } from "../../components/SettingsControls";
import { SettingsSectionCard } from "../../components/SettingsSectionCard";
import { LocalModelsGenerationSettings } from "./LocalModelsGenerationSettings";

interface LocalModelsTestTabProps {
  activity: LocalInferenceActivity | null;
  busyLoraId?: string;
  img2imgSupported: boolean;
  isLoraBusy?: boolean;
  isTesting: boolean;
  loras: LocalLoraStatus[];
  onDownloadLora?: (loraId: string) => void;
  onImportLora?: (loraId: string) => void;
  onOpenRuntimeTab?: () => void;
  onSettingsChange: (settings: LocalInferenceSettings) => void;
  onTest: () => void;
  onTestPromptChange: (prompt: string) => void;
  onTestReferencePathChange: (path: string) => void;
  onTestReferenceStrengthChange: (strength: number) => void;
  settings: LocalInferenceSettings;
  testPreviewPath: string;
  testPrompt: string;
  testReferencePath: string;
  testReferenceStrength: number;
}

function isLoraCompatible(entry: LocalLoraStatus, profileId: string) {
  const ids = entry.lora.compatibleProfileIds;
  if (ids.length === 0) {
    return true;
  }
  return ids.includes(profileId);
}

export function LocalModelsTestTab({
  activity,
  busyLoraId,
  img2imgSupported,
  isLoraBusy,
  isTesting,
  loras,
  onDownloadLora,
  onImportLora,
  onOpenRuntimeTab,
  onSettingsChange,
  onTest,
  onTestPromptChange,
  onTestReferencePathChange,
  onTestReferenceStrengthChange,
  settings,
  testPreviewPath,
  testPrompt,
  testReferencePath,
  testReferenceStrength,
}: LocalModelsTestTabProps) {
  const compatibleLoras = loras.filter((entry) => isLoraCompatible(entry, settings.activeProfileId));

  function toggleLora(loraId: string, enabled: boolean) {
    const enabledLoraIds = enabled
      ? [...new Set([...settings.enabledLoraIds, loraId])]
      : settings.enabledLoraIds.filter((id) => id !== loraId);
    onSettingsChange({ ...settings, enabledLoraIds });
  }

  async function handlePickReference() {
    const selected = await open({
      filters: [{ extensions: ["png", "jpg", "jpeg", "webp"], name: "参考图片" }],
      multiple: false,
      title: "选择 img2img 参考图",
    });
    if (typeof selected === "string") {
      onTestReferencePathChange(selected);
    }
  }

  return (
    <div className="space-y-4">
      <LocalModelsGenerationSettings
        activeProfileId={settings.activeProfileId}
        onOpenRuntimeTab={onOpenRuntimeTab}
        onSettingsChange={onSettingsChange}
        settings={settings}
      />

      <SettingsSectionCard description="输入 Prompt 验证当前档位能否出图。" icon={TestTubeDiagonal} title="测试出图">
        <SettingsField label="测试 Prompt">
          <Textarea onChange={(event) => onTestPromptChange(event.target.value)} rows={3} value={testPrompt} />
        </SettingsField>

        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">参考图 img2img（可选）</p>
            <Badge variant={img2imgSupported ? "secondary" : "outline"}>
              {img2imgSupported ? "Runtime 支持" : "Runtime 不支持"}
            </Badge>
          </div>
          {!img2imgSupported ? (
            <p className="text-xs text-muted-foreground">
              当前 sd-cpp 版本未检测到 img2img 参数，请升级 Runtime 或在「生图 Runtime」Tab 确认能力。
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!img2imgSupported || isTesting}
              onClick={() => void handlePickReference()}
              size="sm"
              type="button"
              variant="outline"
            >
              <ImagePlus aria-hidden="true" />
              选择参考图
            </Button>
            {testReferencePath ? (
              <Button
                onClick={() => onTestReferencePathChange("")}
                size="sm"
                type="button"
                variant="ghost"
              >
                清除参考图
              </Button>
            ) : null}
          </div>
          {testReferencePath ? (
            <p className="truncate text-xs text-muted-foreground" title={testReferencePath}>
              {testReferencePath}
            </p>
          ) : null}
          <SettingsField description="0.05–1.0，越高越贴近参考图。" label="参考强度">
            <Input
              disabled={!testReferencePath || !img2imgSupported}
              max={1}
              min={0.05}
              onChange={(event) =>
                onTestReferenceStrengthChange(Number.parseFloat(event.target.value) || settings.defaultImg2imgStrength)
              }
              step={0.05}
              type="number"
              value={testReferenceStrength}
            />
          </SettingsField>
        </div>

        {(isTesting && activity?.message) ? (
          <p className="text-sm text-muted-foreground">{activity.message}</p>
        ) : null}
        <Button disabled={isTesting || isLoraBusy} onClick={onTest} type="button">
          {isTesting ? "生成中…" : "测试本地出图"}
        </Button>
        {testPreviewPath ? (
          <img
            alt="本地测试出图预览"
            className="max-h-64 rounded-lg border border-border object-contain"
            src={convertFileSrc(testPreviewPath)}
          />
        ) : null}
      </SettingsSectionCard>

      <SettingsSectionCard
        description="可选像素风 LoRA，与当前激活档位（Klein 4B）匹配。下载后勾选并测试出图。"
        icon={Sparkles}
        title="LoRA"
      >
        {compatibleLoras.length === 0 ? (
          <p className="text-sm text-muted-foreground">当前档位暂无可用 LoRA。</p>
        ) : null}
        {compatibleLoras.map((entry) => {
          const rowBusy = Boolean(isLoraBusy && busyLoraId === entry.lora.id);
          return (
            <div className="space-y-2 rounded-lg border border-border/60 p-3" key={entry.lora.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <SettingsCheckboxRow
                  checked={settings.enabledLoraIds.includes(entry.lora.id)}
                  description={`${entry.lora.description} · ${entry.detail}`}
                  label={entry.lora.label}
                  onChange={(checked) => toggleLora(entry.lora.id, checked)}
                />
                <Badge variant={entry.installed ? "secondary" : "outline"}>
                  {entry.installed ? "已就绪" : "未下载"}
                </Badge>
              </div>
              {!entry.installed ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={rowBusy || isTesting}
                    onClick={() => onDownloadLora?.(entry.lora.id)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Download aria-hidden="true" />
                    {rowBusy ? "下载中…" : "在线下载"}
                  </Button>
                  <Button
                    disabled={rowBusy || isTesting}
                    onClick={() => onImportLora?.(entry.lora.id)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <FolderOpen aria-hidden="true" />
                    选择本地文件
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
        <SettingsField label="默认 LoRA 强度">
          <Input
            max={2}
            min={0}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                defaultLoraStrength: Number.parseFloat(event.target.value) || 0.9,
              })
            }
            step={0.05}
            type="number"
            value={settings.defaultLoraStrength}
          />
        </SettingsField>
      </SettingsSectionCard>
    </div>
  );
}
