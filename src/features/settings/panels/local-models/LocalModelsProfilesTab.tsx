import { Check, FolderOpen, HelpCircle, LoaderCircle, Minus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LocalInferenceSettings, LocalModelProfileStatus } from "@/lib/tauri/localModels";

import { SettingsField, SettingsSelect } from "../../components/SettingsControls";
import {
  detectHuggingFaceEndpointPreset,
  HUGGINGFACE_ENDPOINT_PRESET_OPTIONS,
  huggingFaceEndpointFromPreset,
  type HuggingFaceEndpointPreset,
} from "./hfMirror";
import { truncatePath } from "./utils";

interface LocalModelsProfilesTabProps {
  isProfileBusy: boolean;
  busyProfileId: string;
  modelsDirectoryDisplay: string;
  onBrowseModelsDirectory: () => void;
  onDownloadProfile: (profileId: string) => void;
  onImportDirectory: (profileId: string) => void;
  onResetModelsDirectory: () => void;
  onSaveSettings: () => void;
  onSettingsChange: (settings: LocalInferenceSettings) => void;
  profiles: LocalModelProfileStatus[];
  settings: LocalInferenceSettings;
  isSaving: boolean;
}

function FileStatusCell({ present }: { present: boolean }) {
  if (present) {
    return <Check aria-label="已就绪" className="mx-auto size-4 text-primary" />;
  }

  return <Minus aria-label="缺失" className="mx-auto size-4 text-muted-foreground" />;
}

function roleFilePresent(profile: LocalModelProfileStatus, role: string) {
  return profile.assetFiles?.find((file) => file.role === role)?.present ?? false;
}

function supportsOnlineDownload(entry: LocalModelProfileStatus) {
  const backend = entry.profile.backend;
  if (backend !== "sd-cpp" && backend !== "diffusion-rs") {
    return false;
  }

  return (entry.assetFiles?.length ?? 0) > 0;
}

function supportsLocalImport(entry: LocalModelProfileStatus) {
  const backend = entry.profile.backend;
  return (backend === "sd-cpp" || backend === "diffusion-rs") && (entry.assetFiles?.length ?? 0) > 0;
}

export function LocalModelsProfilesTab({
  busyProfileId,
  isProfileBusy,
  isSaving,
  modelsDirectoryDisplay,
  onBrowseModelsDirectory,
  onDownloadProfile,
  onImportDirectory,
  onResetModelsDirectory,
  onSaveSettings,
  onSettingsChange,
  profiles,
  settings,
}: LocalModelsProfilesTabProps) {
  const [search, setSearch] = useState("");
  const [customHfEndpoint, setCustomHfEndpoint] = useState(() => {
    const preset = detectHuggingFaceEndpointPreset(settings.huggingfaceEndpoint);
    return preset === "custom" ? settings.huggingfaceEndpoint : "";
  });

  const hfEndpointPreset = detectHuggingFaceEndpointPreset(settings.huggingfaceEndpoint);

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return profiles;
    }

    return profiles.filter(
      (entry) =>
        entry.profile.label.toLowerCase().includes(query) ||
        entry.profile.id.toLowerCase().includes(query),
    );
  }, [profiles, search]);

  const profileOptions = profiles.map((entry) => ({
    label: entry.profile.label,
    value: entry.profile.id,
  }));

  function updateHfEndpointPreset(preset: HuggingFaceEndpointPreset) {
    onSettingsChange({
      ...settings,
      huggingfaceEndpoint: huggingFaceEndpointFromPreset(
        preset,
        preset === "custom" ? customHfEndpoint : settings.huggingfaceEndpoint,
      ),
    });
  }

  function updateCustomHfEndpoint(value: string) {
    setCustomHfEndpoint(value);
    onSettingsChange({
      ...settings,
      huggingfaceEndpoint: value.trim().replace(/\/+$/, ""),
    });
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-4">
      <section className="settings-card local-models-settings-form">
        <header className="settings-card-title">
          <div>
            <strong>模型与网络</strong>
            <span>档位、下载镜像与模型目录</span>
          </div>
        </header>
        <div className="local-models-panel-body local-models-settings-fields">
          <SettingsSelect
            label="当前档位"
            onChange={(activeProfileId) => onSettingsChange({ ...settings, activeProfileId })}
            options={profileOptions}
            value={settings.activeProfileId}
          />
          <SettingsField label="Ollama API 地址">
            <Input
              onChange={(event) => onSettingsChange({ ...settings, ollamaApiBase: event.target.value })}
              value={settings.ollamaApiBase}
            />
          </SettingsField>
          <SettingsField
            description="模型在线下载使用该端点；选官方即访问 huggingface.co。"
            label="HuggingFace 端点"
          >
            <div className="space-y-2">
              <Select
                onValueChange={(value) => updateHfEndpointPreset(value as HuggingFaceEndpointPreset)}
                value={hfEndpointPreset}
              >
                <SelectTrigger className="settings-select-trigger w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="settings-select-content">
                  <div className="settings-select-viewport">
                    {HUGGINGFACE_ENDPOINT_PRESET_OPTIONS.map((option) => (
                      <SelectItem
                        className="settings-select-item"
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
              {hfEndpointPreset === "custom" ? (
                <Input
                  onChange={(event) => updateCustomHfEndpoint(event.target.value)}
                  placeholder="https://hf-mirror.com"
                  value={customHfEndpoint}
                />
              ) : null}
            </div>
          </SettingsField>
          <SettingsField
            description="Klein 档位含 DiT、VAE 与 Qwen3-4B 文本编码器共 3 个文件。下载暂存于「模型目录/.tmp/downloads/」，HF 缓存位于「模型目录/.cache/huggingface/」，运行文件在对应档位子目录。"
            label="模型目录"
          >
            <div className="flex flex-wrap gap-2">
              <Input className="min-w-[200px] flex-1" readOnly value={modelsDirectoryDisplay} />
              <Button onClick={onBrowseModelsDirectory} size="sm" type="button" variant="outline">
                <FolderOpen aria-hidden="true" />
                浏览…
              </Button>
              <Button onClick={onResetModelsDirectory} size="sm" type="button" variant="ghost">
                恢复默认
              </Button>
            </div>
          </SettingsField>
        </div>
      </section>

      <div className="relative max-w-xs">
        <Search aria-hidden="true" className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索档位…"
          value={search}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>档位</TableHead>
            <TableHead>大小</TableHead>
            <TableHead className="text-center">DiT</TableHead>
            <TableHead className="text-center">VAE</TableHead>
            <TableHead className="text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center justify-center gap-1">
                    LLM
                    <HelpCircle aria-hidden="true" className="size-3.5 text-muted-foreground" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">文本编码器（Qwen3-4B）</TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProfiles.map((entry) => {
            const rowBusy = isProfileBusy && busyProfileId === entry.profile.id;
            const canImport = supportsLocalImport(entry);
            const canDownload = supportsOnlineDownload(entry);

            return (
              <TableRow key={entry.profile.id}>
                <TableCell>
                  <div className="font-medium">{entry.profile.label}</div>
                  <div className="text-xs text-muted-foreground">{truncatePath(entry.profile.id, 24)}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">~{entry.profile.estimatedSizeMb} MB</TableCell>
                <TableCell>
                  <FileStatusCell present={roleFilePresent(entry, "diffusion")} />
                </TableCell>
                <TableCell>
                  <FileStatusCell present={roleFilePresent(entry, "vae")} />
                </TableCell>
                <TableCell>
                  <FileStatusCell present={roleFilePresent(entry, "llm")} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {entry.recommended ? <Badge variant="secondary">推荐</Badge> : null}
                    {entry.ready ? <Badge>就绪</Badge> : entry.installed ? <Badge variant="outline">部分</Badge> : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {canImport ? (
                      <Button
                        disabled={rowBusy}
                        onClick={() => onImportDirectory(entry.profile.id)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        选择本地目录
                      </Button>
                    ) : null}
                    {!entry.ready && canDownload ? (
                      <Button
                        disabled={rowBusy}
                        onClick={() => onDownloadProfile(entry.profile.id)}
                        size="sm"
                        type="button"
                        variant={rowBusy ? "secondary" : "default"}
                      >
                        {rowBusy ? (
                          <>
                            <LoaderCircle aria-hidden="true" className="animate-spin" />
                            下载中…
                          </>
                        ) : (
                          "在线下载"
                        )}
                      </Button>
                    ) : null}
                    {!entry.ready && !canDownload ? (
                      <span className="text-xs text-muted-foreground">暂不支持在线下载</span>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Button disabled={isSaving} onClick={onSaveSettings} type="button">
        {isSaving ? "保存中…" : "保存本地生图设置"}
      </Button>
    </div>
    </TooltipProvider>
  );
}
