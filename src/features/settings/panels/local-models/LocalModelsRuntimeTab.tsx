import { Upload } from "lucide-react";

import { SettingsPanelCard } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  LocalDiffusionRuntimeStatus,
  LocalInferenceSettings,
  SdCliCapabilities,
} from "@/lib/tauri/localModels";

import { LocalModelsRuntimeParamsPanel } from "./LocalModelsRuntimeParamsPanel";
import { truncatePath } from "./utils";

interface LocalModelsRuntimeTabProps {
  activeProfileId: string;
  backendLabel?: string;
  busyRuntimeId: string;
  capabilities: SdCliCapabilities | null;
  hasActiveRuntime: boolean;
  hasInstalledRuntime: boolean;
  isRuntimeBusy: boolean;
  isSaving?: boolean;
  onActivate: (runtimeId: string) => void;
  onDownload: (runtimeId: string) => void;
  onImportZip: (runtimeId: string) => void;
  onRemove: (runtimeId: string) => void;
  onSaveSettings: () => void;
  onSettingsChange: (settings: LocalInferenceSettings) => void;
  runtimeRootDirectory: string;
  runtimes: LocalDiffusionRuntimeStatus[];
  settings: LocalInferenceSettings;
}

export function LocalModelsRuntimeTab({
  activeProfileId,
  backendLabel,
  busyRuntimeId,
  capabilities,
  hasActiveRuntime,
  hasInstalledRuntime,
  isRuntimeBusy,
  isSaving,
  onActivate,
  onDownload,
  onImportZip,
  onRemove,
  onSaveSettings,
  onSettingsChange,
  runtimeRootDirectory,
  runtimes,
  settings,
}: LocalModelsRuntimeTabProps) {
  return (
    <div className="space-y-4">
      <p className="settings-note">
        Runtime 根目录：<span className="text-foreground">{truncatePath(runtimeRootDirectory, 64)}</span>
      </p>

      <div className="grid gap-3">
        {runtimes.map((entry) => (
          <SettingsPanelCard
            bodyClassName="space-y-3"
            description={entry.description}
            key={entry.id}
            title={entry.label}
          >
            <div className="flex flex-wrap items-center gap-2">
              {entry.recommended ? <Badge variant="secondary">推荐</Badge> : null}
              {entry.active ? <Badge>当前</Badge> : null}
              {entry.installed ? <Badge variant="outline">已安装</Badge> : null}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                版本 {entry.installedVersion ?? entry.packageVersion}
                {entry.updateAvailable ? " · 有更新" : ""}
              </p>
              {entry.executablePath ? (
                <p className="truncate text-xs text-muted-foreground" title={entry.executablePath}>
                  {truncatePath(entry.executablePath, 56)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {entry.installed ? (
                <>
                  {!entry.active ? (
                    <Button disabled={isRuntimeBusy} onClick={() => onActivate(entry.id)} size="sm" type="button" variant="outline">
                      选用
                    </Button>
                  ) : null}
                  {entry.updateAvailable ? (
                    <Button disabled={isRuntimeBusy} onClick={() => onDownload(entry.id)} size="sm" type="button">
                      更新
                    </Button>
                  ) : null}
                  <Button disabled={isRuntimeBusy} onClick={() => onRemove(entry.id)} size="sm" type="button" variant="ghost">
                    卸载
                  </Button>
                </>
              ) : (
                <>
                  <Button disabled={isRuntimeBusy} onClick={() => onDownload(entry.id)} size="sm" type="button">
                    {isRuntimeBusy && busyRuntimeId === entry.id ? "处理中…" : "下载"}
                  </Button>
                  <Button disabled={isRuntimeBusy} onClick={() => onImportZip(entry.id)} size="sm" type="button" variant="outline">
                    <Upload aria-hidden="true" />
                    从 zip 导入
                  </Button>
                </>
              )}
            </div>
          </SettingsPanelCard>
        ))}
      </div>

      {!hasInstalledRuntime ? (
        <p className="settings-note">
          若 GitHub 下载失败，请手动下载 zip 后点击「从 zip 导入」。NVIDIA 独显优先 CUDA，否则 Vulkan。
        </p>
      ) : null}

      {capabilities?.available && !capabilities.img2imgSupported ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          <p className="font-medium">当前 Runtime 未检测到 img2img 能力</p>
          <p className="mt-1 text-xs opacity-90">
            角色工作坊参考图与测试 Tab 参考图生图需要 sd-cli 支持 <code>--init-img</code> 或等效参数。请更新
            stable-diffusion.cpp Runtime
            {capabilities.runtimeVersion ? `（当前：${capabilities.runtimeVersion}）` : ""}，或在 GitHub Releases 手动导入新版 zip。
          </p>
        </div>
      ) : null}

      {hasInstalledRuntime && hasActiveRuntime ? (
        <LocalModelsRuntimeParamsPanel
          activeProfileId={activeProfileId}
          backendLabel={backendLabel}
          capabilities={capabilities}
          isSaving={isSaving}
          onSave={onSaveSettings}
          onSettingsChange={onSettingsChange}
          settings={settings}
        />
      ) : hasInstalledRuntime ? (
        <p className="settings-note">请先选用一个已安装的 Runtime，再配置推理参数。</p>
      ) : null}
    </div>
  );
}
