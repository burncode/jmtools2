import { Check, X } from "lucide-react";

import { SettingsPanelCard } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LocalGenerationLimitsResult, SdCliCapabilities } from "@/lib/tauri/localModels";

interface LocalModelsRuntimeEffectivePreviewProps {
  backendLabel?: string;
  capabilities: SdCliCapabilities | null;
  isSaving?: boolean;
  limitsResult: LocalGenerationLimitsResult | null;
  onApplyLowVramPreset: () => void;
  onResetManifest: () => void;
  onSave: () => void;
}

function flagRow(label: string, active: boolean, supported: boolean) {
  const Icon = active ? Check : X;
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1">
        {!supported ? <Badge variant="outline">不支持</Badge> : null}
        <Icon
          aria-hidden="true"
          className={active ? "size-4 text-emerald-500" : "size-4 text-muted-foreground"}
        />
      </span>
    </div>
  );
}

export function LocalModelsRuntimeEffectivePreview({
  backendLabel,
  capabilities,
  isSaving,
  limitsResult,
  onApplyLowVramPreset,
  onResetManifest,
  onSave,
}: LocalModelsRuntimeEffectivePreviewProps) {
  const runtime = limitsResult?.effectiveRuntime;

  return (
    <SettingsPanelCard
      bodyClassName="local-models-runtime-preview space-y-3"
      className="local-models-runtime-preview-card"
      description="修改左侧参数后此处实时反映将传给 sd-cli 的生效组合。"
      title="生效预览"
    >
      <div className="space-y-1 text-sm">
        <p>
          Runtime
          {" · "}
          {capabilities?.available ? capabilities.runtimeVersion ?? "已安装" : "未安装"}
        </p>
        {backendLabel ? <p>Backend · {backendLabel}</p> : null}
        {limitsResult ? (
          <p>
            推荐 txt2img · {limitsResult.limits.maxSide}px
            {limitsResult.img2imgSupported ? ` · img2img ${limitsResult.img2imgMaxSide}px` : null}
          </p>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-border/60 pt-3">
        {flagRow("offload-to-cpu", runtime?.offloadToCpu ?? false, true)}
        {flagRow("diffusion-fa", runtime?.diffusionFa ?? false, true)}
        {flagRow(
          "vae-on-cpu",
          runtime?.vaeOnCpu ?? false,
          runtime?.vaeOnCpuSupported ?? false,
        )}
        {flagRow(
          "vae-tiling",
          runtime?.vaeTiling ?? false,
          runtime?.vaeTilingSupported ?? false,
        )}
        {flagRow(
          "clip-on-cpu",
          runtime?.clipOnCpu ?? false,
          runtime?.clipOnCpuSupported ?? false,
        )}
        {runtime?.loraApplyMode ? (
          <p className="text-xs text-muted-foreground">LoRA 模式 · {runtime.loraApplyMode}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
        <Button disabled={isSaving} onClick={onSave} size="sm" type="button">
          {isSaving ? "保存中…" : "保存 Runtime 设置"}
        </Button>
        <Button onClick={onApplyLowVramPreset} size="sm" type="button" variant="outline">
          应用低显存预设
        </Button>
        <Button onClick={onResetManifest} size="sm" type="button" variant="ghost">
          恢复 manifest 默认
        </Button>
      </div>
    </SettingsPanelCard>
  );
}
