import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LoaderCircle, Pause, Play, X } from "lucide-react";

import type { LocalDownloadTask, LocalInferenceActivity } from "@/lib/tauri/localModels";

import type { LocalModelsActiveTask } from "./types";
import { formatBytesLabel, formatSpeedLabel, stageLabel } from "./utils";

interface LocalModelsDownloadTabProps {
  activeTask: LocalModelsActiveTask | null;
  activity: LocalInferenceActivity | null;
  downloadTask: LocalDownloadTask | null;
  isDownloadControlBusy?: boolean;
  modelsDirectoryDisplay?: string;
  onCancelDownload?: () => void;
  onPauseDownload?: () => void;
  onResumeDownload?: (profileId: string) => void;
  onResumeLoraDownload?: (loraId: string) => void;
}

function taskKindLabel(kind: LocalModelsActiveTask["kind"]) {
  switch (kind) {
    case "lora-download":
      return "LoRA 下载";
    case "model-download":
      return "模型下载";
    case "model-import":
      return "模型导入";
    case "runtime-download":
      return "Runtime 下载";
    case "runtime-import":
      return "Runtime 导入";
    case "test":
      return "测试出图";
    default:
      return "任务";
  }
}

function isLoraDownloadTask(
  activeTask: LocalModelsActiveTask | null,
  downloadTask: LocalDownloadTask | null,
) {
  return (
    activeTask?.kind === "lora-download" ||
    downloadTask?.taskKind === "lora" ||
    Boolean(downloadTask?.loraId)
  );
}

function isControlledDownloadTask(
  activeTask: LocalModelsActiveTask | null,
  downloadTask: LocalDownloadTask | null,
  activity: LocalInferenceActivity | null,
) {
  return (
    activeTask?.kind === "model-download" ||
    activeTask?.kind === "lora-download" ||
    downloadTask != null ||
    Boolean(activity?.profileId)
  );
}

function isDownloadPaused(downloadTask: LocalDownloadTask | null) {
  return downloadTask?.state === "paused";
}

function isDownloadRunning(
  activeTask: LocalModelsActiveTask | null,
  downloadTask: LocalDownloadTask | null,
) {
  if (downloadTask?.state === "running") {
    return true;
  }
  if (downloadTask?.state === "paused") {
    return false;
  }
  if (activeTask?.kind === "model-download" || activeTask?.kind === "lora-download") {
    return activeTask.state !== "paused";
  }
  return false;
}

function resolveModelProfileId(
  activeTask: LocalModelsActiveTask | null,
  activity: LocalInferenceActivity | null,
  downloadTask: LocalDownloadTask | null,
) {
  return downloadTask?.profileId ?? activeTask?.profileId ?? activity?.profileId ?? "";
}

function resolveLoraId(
  activeTask: LocalModelsActiveTask | null,
  downloadTask: LocalDownloadTask | null,
) {
  return downloadTask?.loraId ?? activeTask?.loraId ?? "";
}

function IconControlButton({
  busy,
  label,
  onClick,
  variant = "ghost",
  children,
}: {
  busy?: boolean;
  children: ReactNode;
  label: string;
  onClick?: () => void;
  variant?: "default" | "ghost" | "outline";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          disabled={busy}
          onClick={onClick}
          size="icon"
          type="button"
          variant={variant}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function DownloadInlineControls(props: LocalModelsDownloadTabProps) {
  const {
    activeTask,
    activity,
    downloadTask,
    isDownloadControlBusy,
    onCancelDownload,
    onPauseDownload,
    onResumeDownload,
    onResumeLoraDownload,
  } = props;

  if (!isControlledDownloadTask(activeTask, downloadTask, activity)) {
    return null;
  }

  const isLora = isLoraDownloadTask(activeTask, downloadTask);
  const profileId = resolveModelProfileId(activeTask, activity, downloadTask);
  const loraId = resolveLoraId(activeTask, downloadTask);
  const paused = isDownloadPaused(downloadTask);
  const running = isDownloadRunning(activeTask, downloadTask) && !paused;

  if (!running && !paused) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {running ? (
        <>
          <IconControlButton
            busy={isDownloadControlBusy}
            label="暂停"
            onClick={() => onPauseDownload?.()}
          >
            <Pause aria-hidden="true" className="size-4" />
          </IconControlButton>
          <IconControlButton
            busy={isDownloadControlBusy}
            label="取消"
            onClick={() => onCancelDownload?.()}
          >
            <X aria-hidden="true" className="size-4" />
          </IconControlButton>
        </>
      ) : null}
      {paused && isLora && loraId ? (
        <>
          <IconControlButton
            busy={isDownloadControlBusy}
            label="恢复"
            onClick={() => onResumeLoraDownload?.(loraId)}
            variant="default"
          >
            <Play aria-hidden="true" className="size-4" />
          </IconControlButton>
          <IconControlButton
            busy={isDownloadControlBusy}
            label="取消"
            onClick={() => onCancelDownload?.()}
          >
            <X aria-hidden="true" className="size-4" />
          </IconControlButton>
        </>
      ) : null}
      {paused && !isLora && profileId ? (
        <>
          <IconControlButton
            busy={isDownloadControlBusy}
            label="恢复"
            onClick={() => onResumeDownload?.(profileId)}
            variant="default"
          >
            <Play aria-hidden="true" className="size-4" />
          </IconControlButton>
          <IconControlButton
            busy={isDownloadControlBusy}
            label="取消"
            onClick={() => onCancelDownload?.()}
          >
            <X aria-hidden="true" className="size-4" />
          </IconControlButton>
        </>
      ) : null}
    </div>
  );
}

function ProgressWithControls(props: LocalModelsDownloadTabProps & { indeterminate?: boolean; percent: number | null }) {
  const { indeterminate, percent } = props;

  return (
    <div className="flex items-center gap-2">
      <Progress className="h-3 min-w-0 flex-1" value={indeterminate ? undefined : (percent ?? 0)} />
      <DownloadInlineControls {...props} />
    </div>
  );
}

export function LocalModelsDownloadTab(props: LocalModelsDownloadTabProps) {
  const {
    activeTask,
    activity,
    downloadTask,
    modelsDirectoryDisplay,
  } = props;

  const paused = isDownloadPaused(downloadTask);
  const pausedActivity = paused ? (downloadTask?.activity ?? activity) : null;
  const displayActivity = paused && pausedActivity ? pausedActivity : activity;

  const hasActivity =
    displayActivity != null && displayActivity.phase !== "idle" && Boolean(displayActivity.message);
  const hasPausedSnapshot = paused && downloadTask != null;
  const hasPendingTask = !hasActivity && !hasPausedSnapshot && activeTask != null;

  const tempDirHint = modelsDirectoryDisplay?.trim()
    ? `${modelsDirectoryDisplay.replace(/[/\\]+$/, "")}/.tmp/downloads/`
    : "模型目录/.tmp/downloads/";
  const hfCacheHint = modelsDirectoryDisplay?.trim()
    ? `${modelsDirectoryDisplay.replace(/[/\\]+$/, "")}/.cache/huggingface/`
    : "模型目录/.cache/huggingface/";

  const isLora = isLoraDownloadTask(activeTask, downloadTask);
  const isModelDownload =
    activeTask?.kind === "model-download" || (downloadTask != null && !isLora);

  return (
    <TooltipProvider delayDuration={200}>
      {!hasActivity && !hasPendingTask && !hasPausedSnapshot ? (
        <div className="local-models-download-hero flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">当前没有进行中的下载或导入任务。</p>
          <p className="text-xs text-muted-foreground">在「运行环境」或「模型管理」中触发下载后，进度将显示在此处。</p>
        </div>
      ) : null}

      {hasPendingTask && activeTask ? (
        <div className="local-models-download-hero space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary" />
                正在准备{taskKindLabel(activeTask.kind)}（{activeTask.label}）…
              </p>
              <Badge variant="outline">连接中</Badge>
            </div>
          </div>
          <ProgressWithControls {...props} indeterminate percent={null} />
          <p className="text-xs text-muted-foreground">正在建立连接，请稍候…</p>
        </div>
      ) : null}

      {displayActivity && (hasActivity || hasPausedSnapshot) ? (
        <div className="local-models-download-hero space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">{displayActivity.message}</p>
              {paused ? (
                <Badge variant="outline">已暂停</Badge>
              ) : displayActivity.stage ? (
                <Badge variant="outline">{stageLabel(displayActivity.stage)}</Badge>
              ) : null}
            </div>
            {displayActivity.progressPercent != null ? (
              <span className="text-3xl font-semibold tabular-nums">{displayActivity.progressPercent}%</span>
            ) : null}
          </div>

          <ProgressWithControls
            {...props}
            indeterminate={
              displayActivity.progressPercent == null &&
              (displayActivity.stage === "extracting" ||
                displayActivity.stage === "verifying" ||
                displayActivity.stage === "copying")
            }
            percent={displayActivity.progressPercent ?? null}
          />

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {displayActivity.bytesDownloaded != null ? (
              <span>
                {displayActivity.bytesTotal != null
                  ? `${formatBytesLabel(displayActivity.bytesDownloaded)} / ${formatBytesLabel(displayActivity.bytesTotal)}`
                  : formatBytesLabel(displayActivity.bytesDownloaded)}
              </span>
            ) : null}
            {!paused && displayActivity.speedBytesPerSec ? (
              <span>{formatSpeedLabel(displayActivity.speedBytesPerSec)}</span>
            ) : null}
          </div>

          {paused ? (
            <p className="text-xs text-muted-foreground">
              已暂停，点击恢复将从断点继续下载。临时文件位于「{tempDirHint}」。
            </p>
          ) : isModelDownload ? (
            <p className="text-xs text-muted-foreground">
              下载暂存于「{tempDirHint}」，HF 缓存位于「{hfCacheHint}」，完成后写入对应档位子目录。
            </p>
          ) : isLora ? (
            <p className="text-xs text-muted-foreground">
              LoRA 下载暂存于「{tempDirHint}」，完成后写入 loras 子目录。
            </p>
          ) : null}
        </div>
      ) : null}
    </TooltipProvider>
  );
}
