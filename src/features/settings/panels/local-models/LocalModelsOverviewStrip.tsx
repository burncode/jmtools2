import { Gauge, CheckCircle2, CircleAlert, Cpu, HardDrive, Package } from "lucide-react";

import { SettingsMetricCard } from "@/components/shared";
import { Progress } from "@/components/ui/progress";
import type {
  LocalDiffusionRuntimeStatus,
  LocalGenerationLimitsResult,
  LocalHardwareProbeResult,
  LocalModelProfileStatus,
} from "@/lib/tauri/localModels";

interface LocalModelsOverviewStripProps {
  generationLimits: LocalGenerationLimitsResult | null;
  hardware: LocalHardwareProbeResult | null;
  profiles: LocalModelProfileStatus[];
  runtimes: LocalDiffusionRuntimeStatus[];
}

const STORAGE_REFERENCE_MB = 8192;

export function LocalModelsOverviewStrip({
  generationLimits,
  hardware,
  profiles,
  runtimes,
}: LocalModelsOverviewStripProps) {
  const readyProfiles = profiles.filter((entry) => entry.ready).length;
  const runtimeReady = runtimes.some((entry) => entry.installed && entry.active);
  const installedRuntimes = runtimes.filter((entry) => entry.installed).length;
  const storageMb = hardware?.diskUsageMb ?? 0;
  const storagePercent = Math.min(100, Math.round((storageMb / STORAGE_REFERENCE_MB) * 100));
  const vramMb = hardware?.hardware.vramMb ?? 0;
  const vramPercent = vramMb > 0 ? Math.min(100, Math.round((vramMb / 8192) * 100)) : 0;
  const backendLabel = generationLimits?.backendLabel ?? hardware?.hardware.backend?.toUpperCase() ?? "—";
  const maxSide = generationLimits?.limits.maxSide;

  return (
    <div className="local-models-metric-grid">
      <SettingsMetricCard icon={Package} title="生图引擎">
        <div className="flex items-center gap-2">
          {runtimeReady ? (
            <CheckCircle2 aria-hidden="true" className="size-4 text-primary" />
          ) : (
            <CircleAlert aria-hidden="true" className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">{runtimeReady ? "Runtime 就绪" : "未安装"}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          已安装 {installedRuntimes} / {runtimes.length}
        </p>
      </SettingsMetricCard>

      <SettingsMetricCard icon={HardDrive} title="模型档位">
        <p className="text-sm font-semibold">
          {readyProfiles} / {profiles.length} 就绪
        </p>
        <Progress className="h-1.5" value={profiles.length ? (readyProfiles / profiles.length) * 100 : 0} />
      </SettingsMetricCard>

      <SettingsMetricCard icon={Gauge} title="推荐最大边长">
        <p className="text-sm font-semibold">{maxSide ? `${maxSide} px` : "—"}</p>
        <p className="text-xs text-muted-foreground">{backendLabel}</p>
      </SettingsMetricCard>

      <SettingsMetricCard icon={HardDrive} title="磁盘占用">
        <p className="text-sm font-semibold">{storageMb > 0 ? `${storageMb} MB` : "—"}</p>
        <Progress className="h-1.5" value={storagePercent} />
      </SettingsMetricCard>

      <SettingsMetricCard icon={Cpu} title="显存">
        <p className="text-sm font-semibold">{vramMb > 0 ? `${vramMb} MB` : "未知"}</p>
        <p className="truncate text-xs text-muted-foreground" title={hardware?.hardware.gpuName ?? undefined}>
          {hardware?.hardware.gpuName ?? "未检测到独显"}
        </p>
        {vramMb > 0 ? <Progress className="h-1.5" value={vramPercent} /> : null}
      </SettingsMetricCard>
    </div>
  );
}
