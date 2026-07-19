import { open } from "@tauri-apps/plugin-dialog";
import { Cpu, HardDrive, LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SettingsPanelCard } from "@/components/shared";
import { appLogger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  cancelLocalModelDownload,
  downloadLocalDiffusionRuntime,
  downloadLocalLora,
  downloadLocalModelProfile,
  DOWNLOAD_CANCELLED_MESSAGE,
  DOWNLOAD_PAUSED_MESSAGE,
  formatProbedAt,
  getLocalGenerationLimits,
  getLocalDiffusionRuntimeDirectory,
  getLocalDownloadTask,
  getLocalInferenceActivity,
  getLocalInferenceSettings,
  getSdCliCapabilities,
  importLocalDiffusionRuntimeFromZip,
  importLocalLora,
  importLocalModelBundleFromDirectory,
  listLocalBackendEvaluations,
  listLocalDiffusionRuntimes,
  listLocalLoras,
  listLocalModelProfiles,
  pauseLocalModelDownload,
  probeLocalHardware,
  removeLocalDiffusionRuntime,
  resumeLocalLoraDownload,
  resumeLocalModelDownload,
  saveLocalInferenceSettings,
  setActiveLocalDiffusionRuntime,
  testLocalImageGeneration,
  type BackendEvaluationStatus,
  type LocalGenerationLimitsResult,
  type LocalDiffusionRuntimeStatus,
  type LocalDownloadTask,
  type LocalHardwareProbeResult,
  type LocalInferenceActivity,
  type LocalInferenceSettings,
  type SdCliCapabilities,
  type LocalLoraStatus,
  type LocalModelProfileStatus,
} from "@/lib/tauri/localModels";

import type { SettingsPanelProps } from "../types";
import { LocalModelsDownloadTab } from "./LocalModelsDownloadTab";
import { LocalModelsEvaluationList } from "./LocalModelsEvaluationList";
import { LocalModelsOverviewStrip } from "./LocalModelsOverviewStrip";
import { LocalModelsProfilesTab } from "./LocalModelsProfilesTab";
import { LocalModelsRuntimeTab } from "./LocalModelsRuntimeTab";
import { LocalModelsTestTab } from "./LocalModelsTestTab";
import {
  getLocalModelsPanelSnapshot,
  isLocalModelsPanelCacheFresh,
  setLocalModelsPanelSnapshot,
  type LocalModelsPanelSnapshot,
} from "./panelCache";
import type { LocalModelsActiveTask } from "./types";

const defaultLocalSettings: LocalInferenceSettings = {
  activeProfileId: "klein-4b-q4",
  defaultImg2imgStrength: 0.42,
  defaultLoraStrength: 0.9,
  enabledLoraIds: [],
  generationCfgScale: 1,
  generationHeight: 512,
  generationSteps: 4,
  generationWidth: 512,
  huggingfaceEndpoint: "",
  maxGenerationSide: 0,
  maxImg2imgSide: 0,
  modelsDirectory: "",
  ollamaApiBase: "http://127.0.0.1:11434",
  runtimeDiffusionFa: null,
  runtimeOffloadToCpu: null,
  runtimeVaeOnCpu: false,
  runtimeVaeTiling: false,
  testHeight: 0,
  testWidth: 0,
};

function normalizeLocalSettings(settings: LocalInferenceSettings): LocalInferenceSettings {
  return {
    ...defaultLocalSettings,
    ...settings,
    defaultImg2imgStrength: settings.defaultImg2imgStrength || defaultLocalSettings.defaultImg2imgStrength,
    generationWidth: settings.generationWidth || defaultLocalSettings.generationWidth,
    generationHeight: settings.generationHeight || defaultLocalSettings.generationHeight,
    generationSteps: settings.generationSteps || defaultLocalSettings.generationSteps,
    generationCfgScale: settings.generationCfgScale || defaultLocalSettings.generationCfgScale,
    runtimeVaeOnCpu: settings.runtimeVaeOnCpu ?? false,
    runtimeVaeTiling: settings.runtimeVaeTiling ?? false,
  };
}

function formatCacheLoadedAt(loadedAt: number) {
  return new Date(loadedAt).toLocaleString("zh-CN");
}

function buildProbeMessage(probe: LocalHardwareProbeResult) {
  return probe.cached
    ? `已读取本地生图设置（硬件缓存：${formatProbedAt(probe.probedAt)}）。`
    : "首次硬件探测已完成，后续可在需要时手动刷新。";
}

function profileLabelById(profiles: LocalModelProfileStatus[], profileId: string) {
  return profiles.find((entry) => entry.profile.id === profileId)?.profile.label ?? profileId;
}

function runtimeLabelById(runtimes: LocalDiffusionRuntimeStatus[], runtimeId: string) {
  return runtimes.find((entry) => entry.id === runtimeId)?.label ?? runtimeId;
}

function loraLabelById(loras: LocalLoraStatus[], loraId: string) {
  return loras.find((entry) => entry.lora.id === loraId)?.lora.label ?? loraId;
}

function applySnapshot(snapshot: LocalModelsPanelSnapshot, apply: {
  setEvaluations: (value: BackendEvaluationStatus[]) => void;
  setHardware: (value: LocalHardwareProbeResult | null) => void;
  setLoras: (value: LocalLoraStatus[]) => void;
  setProfiles: (value: LocalModelProfileStatus[]) => void;
  setRuntimeRootDirectory: (value: string) => void;
  setRuntimes: (value: LocalDiffusionRuntimeStatus[]) => void;
  setSettings: (value: LocalInferenceSettings) => void;
}) {
  apply.setHardware(snapshot.hardware);
  apply.setProfiles(snapshot.profiles);
  apply.setLoras(snapshot.loras);
  apply.setEvaluations(snapshot.evaluations);
  apply.setRuntimes(snapshot.runtimes);
  apply.setSettings(normalizeLocalSettings(snapshot.settings));
  apply.setRuntimeRootDirectory(snapshot.runtimeRootDirectory);
}

export function LocalModelsSettingsPanel(_props: SettingsPanelProps) {
  const cachedSnapshot = getLocalModelsPanelSnapshot();
  const [hardware, setHardware] = useState<LocalHardwareProbeResult | null>(cachedSnapshot?.hardware ?? null);
  const [profiles, setProfiles] = useState<LocalModelProfileStatus[]>(cachedSnapshot?.profiles ?? []);
  const [loras, setLoras] = useState<LocalLoraStatus[]>(cachedSnapshot?.loras ?? []);
  const [evaluations, setEvaluations] = useState<BackendEvaluationStatus[]>(cachedSnapshot?.evaluations ?? []);
  const [runtimes, setRuntimes] = useState<LocalDiffusionRuntimeStatus[]>(cachedSnapshot?.runtimes ?? []);
  const [settings, setSettings] = useState<LocalInferenceSettings>(
    normalizeLocalSettings(cachedSnapshot?.settings ?? defaultLocalSettings),
  );
  const [generationLimits, setGenerationLimits] = useState<LocalGenerationLimitsResult | null>(null);
  const [sdCliCapabilities, setSdCliCapabilities] = useState<SdCliCapabilities | null>(null);
  const [testReferencePath, setTestReferencePath] = useState("");
  const [testReferenceStrength, setTestReferenceStrength] = useState(0.42);
  const [runtimeRootDirectory, setRuntimeRootDirectory] = useState(cachedSnapshot?.runtimeRootDirectory ?? "");
  const [testPrompt, setTestPrompt] = useState("pixel art sprite, knight, front view, white background");
  const [testPreviewPath, setTestPreviewPath] = useState("");
  const [activity, setActivity] = useState<LocalInferenceActivity | null>(null);
  const [downloadTask, setDownloadTask] = useState<LocalDownloadTask | null>(null);
  const [activeTask, setActiveTask] = useState<LocalModelsActiveTask | null>(null);
  const [activeTab, setActiveTab] = useState("runtime");
  const [message, setMessage] = useState(() => {
    if (!cachedSnapshot) {
      return "正在加载本地生图设置…";
    }
    if (isLocalModelsPanelCacheFresh()) {
      return `已读取缓存（${formatCacheLoadedAt(cachedSnapshot.loadedAt)}）。`;
    }
    return `已读取缓存（${formatCacheLoadedAt(cachedSnapshot.loadedAt)}），正在后台更新…`;
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(!cachedSnapshot);
  const [isProbingHardware, setIsProbingHardware] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRuntimeBusy, setIsRuntimeBusy] = useState(false);
  const [isProfileBusy, setIsProfileBusy] = useState(false);
  const [isDownloadControlBusy, setIsDownloadControlBusy] = useState(false);
  const [isLoraBusy, setIsLoraBusy] = useState(false);
  const [busyLoraId, setBusyLoraId] = useState("");
  const [busyRuntimeId, setBusyRuntimeId] = useState("");
  const [busyProfileId, setBusyProfileId] = useState("");
  const activityPollRef = useRef<number | null>(null);

  const isTaskBusy =
    isRuntimeBusy || isProfileBusy || isTesting || isLoraBusy || downloadTask?.state === "paused";

  const snapshotApply = useMemo(
    () => ({
      setEvaluations,
      setHardware,
      setLoras,
      setProfiles,
      setRuntimeRootDirectory,
      setRuntimes,
      setSettings,
    }),
    [],
  );

  const loadHardware = useCallback(async (force: boolean) => {
    setIsProbingHardware(true);
    try {
      const probe = await probeLocalHardware({ force });
      const profileRows = await listLocalModelProfiles();
      setHardware(probe);
      setProfiles(profileRows);
      setMessage(
        probe.cached
          ? `已读取缓存硬件信息（${formatProbedAt(probe.probedAt)}）。`
          : "已完成硬件探测并更新缓存。",
      );
      const current = getLocalModelsPanelSnapshot();
      if (current) {
        setLocalModelsPanelSnapshot({
          ...current,
          hardware: probe,
          profiles: profileRows,
          loadedAt: Date.now(),
        });
      }
      return probe;
    } finally {
      setIsProbingHardware(false);
    }
  }, []);

  const loadPanel = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    const cached = getLocalModelsPanelSnapshot();

    if (!silent) {
      if (cached) {
        applySnapshot(cached, snapshotApply);
        setIsLoading(false);
        setMessage(`已读取缓存（${formatCacheLoadedAt(cached.loadedAt)}），正在后台刷新…`);
      } else {
        setIsLoading(true);
      }
    }

    setError("");
    try {
      const [probe, loraRows, evalRows, savedSettings, runtimeRows, runtimeRoot, capabilities, limits] =
        await Promise.all([
        probeLocalHardware({ force: false }),
        listLocalLoras(),
        listLocalBackendEvaluations(),
        getLocalInferenceSettings(),
        listLocalDiffusionRuntimes(),
        getLocalDiffusionRuntimeDirectory(),
        getSdCliCapabilities().catch(() => null),
        getLocalGenerationLimits("").catch(() => null),
      ]);
      const profileRows = await listLocalModelProfiles();

      setHardware(probe);
      setProfiles(profileRows);
      setLoras(loraRows);
      setEvaluations(evalRows);
      setRuntimes(runtimeRows);
      const normalizedSettings = normalizeLocalSettings(savedSettings);
      setSettings(normalizedSettings);
      setRuntimeRootDirectory(runtimeRoot);
      setSdCliCapabilities(capabilities);
      setGenerationLimits(limits);
      setMessage(buildProbeMessage(probe));

      setLocalModelsPanelSnapshot({
        evaluations: evalRows,
        hardware: probe,
        loadedAt: Date.now(),
        loras: loraRows,
        profiles: profileRows,
        runtimeRootDirectory: runtimeRoot,
        runtimes: runtimeRows,
        settings: normalizedSettings,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [snapshotApply]);

  const refreshProfilesAndLoras = useCallback(async () => {
    try {
      const [profileRows, loraRows, savedSettings] = await Promise.all([
        listLocalModelProfiles(),
        listLocalLoras(),
        getLocalInferenceSettings(),
      ]);
      setProfiles(profileRows);
      setLoras(loraRows);
      const normalizedSettings = normalizeLocalSettings(savedSettings);
      setSettings(normalizedSettings);
      const current = getLocalModelsPanelSnapshot();
      if (current) {
        setLocalModelsPanelSnapshot({
          ...current,
          loras: loraRows,
          profiles: profileRows,
          settings: normalizedSettings,
          loadedAt: Date.now(),
        });
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    }
  }, []);

  const refreshPanelSilently = useCallback(async () => {
    await loadPanel({ silent: true });
  }, [loadPanel]);

  useEffect(() => {
    const cached = getLocalModelsPanelSnapshot();
    const fresh = isLocalModelsPanelCacheFresh();

    if (cached) {
      applySnapshot(cached, snapshotApply);
      setIsLoading(false);
      if (fresh) {
        setMessage(`已读取缓存（${formatCacheLoadedAt(cached.loadedAt)}）。`);
        return;
      }
      setMessage(`已读取缓存（${formatCacheLoadedAt(cached.loadedAt)}），正在后台更新…`);
    }

    const timer = window.setTimeout(() => {
      void loadPanel({ silent: Boolean(cached) });
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadPanel, snapshotApply]);

  useEffect(() => {
    void getLocalDownloadTask()
      .then((task) => {
        if (task?.state !== "paused") {
          return;
        }
        setDownloadTask(task);
        setActivity(task.activity);
        if (task.taskKind === "lora" || task.loraId) {
          const loraId = task.loraId ?? "";
          setActiveTask({
            kind: "lora-download",
            label: loraLabelById(loras, loraId),
            loraId,
            startedAt: Date.now(),
            state: "paused",
          });
          return;
        }
        setActiveTask({
          kind: "model-download",
          label: profileLabelById(profiles, task.profileId),
          profileId: task.profileId,
          startedAt: Date.now(),
          state: "paused",
        });
      })
      .catch(() => {
        // 忽略恢复失败
      });
  }, [loras, profiles]);

  useEffect(() => {
    return () => {
      if (activityPollRef.current !== null) {
        window.clearInterval(activityPollRef.current);
      }
    };
  }, []);

  const pollActivity = useCallback(() => {
    void Promise.all([getLocalInferenceActivity(), getLocalDownloadTask()])
      .then(([latestActivity, task]) => {
        setDownloadTask(task);
        const isLoraTask = task?.taskKind === "lora" || Boolean(task?.loraId);

        if (task?.state === "paused") {
          setActivity(task.activity);
          if (isLoraTask) {
            const loraId = task.loraId ?? "";
            setActiveTask((current) =>
              current?.kind === "lora-download"
                ? { ...current, state: "paused", loraId }
                : {
                    kind: "lora-download",
                    label: loraLabelById(loras, loraId),
                    loraId,
                    startedAt: Date.now(),
                    state: "paused",
                  },
            );
          } else {
            setActiveTask((current) =>
              current?.kind === "model-download"
                ? { ...current, state: "paused", profileId: task.profileId }
                : {
                    kind: "model-download",
                    label: profileLabelById(profiles, task.profileId),
                    profileId: task.profileId,
                    startedAt: Date.now(),
                    state: "paused",
                  },
            );
          }
          return;
        }

        if (task?.state === "running") {
          const nextActivity =
            latestActivity.phase !== "idle" && latestActivity.controlState !== "paused"
              ? latestActivity
              : task.activity;
          setActivity(nextActivity.phase !== "idle" ? nextActivity : null);
          if (isLoraTask) {
            const loraId = task.loraId ?? "";
            setActiveTask((current) =>
              current?.kind === "lora-download"
                ? { ...current, state: "running", loraId }
                : current,
            );
          } else {
            setActiveTask((current) =>
              current?.kind === "model-download"
                ? { ...current, state: "running", profileId: task.profileId }
                : current,
            );
          }
          return;
        }

        setActivity(latestActivity.phase !== "idle" ? latestActivity : null);
      })
      .catch(() => {
        setActivity(null);
        setDownloadTask(null);
      });
  }, [loras, profiles]);

  const finishTaskState = useCallback(async (options?: { keepPaused?: boolean }) => {
    if (options?.keepPaused) {
      try {
        const task = await getLocalDownloadTask();
        setDownloadTask(task);
        if (task?.state === "paused") {
          setActivity(task.activity);
        }
      } catch {
        // 保留当前 paused UI
      }
      return;
    }

    try {
      const [latest, task] = await Promise.all([
        getLocalInferenceActivity(),
        getLocalDownloadTask(),
      ]);
      setDownloadTask(task);
      setActivity(latest.phase !== "idle" ? latest : null);
    } catch {
      setActivity(null);
      setDownloadTask(null);
    }
    setActiveTask(null);
  }, []);

  useEffect(() => {
    if (activityPollRef.current !== null) {
      window.clearInterval(activityPollRef.current);
      activityPollRef.current = null;
    }

    const shouldPoll = isTaskBusy || isLoraBusy || activeTab === "download" || downloadTask?.state === "paused";
    if (!shouldPoll) {
      if (!isTaskBusy && downloadTask?.state !== "paused") {
        setActivity(null);
        setDownloadTask(null);
      }
      return;
    }

    pollActivity();
    const intervalMs = activeTab === "download" || isTaskBusy ? 200 : 400;
    activityPollRef.current = window.setInterval(pollActivity, intervalMs);

    return () => {
      if (activityPollRef.current !== null) {
        window.clearInterval(activityPollRef.current);
        activityPollRef.current = null;
      }
    };
  }, [activeTab, downloadTask?.state, isLoraBusy, isTaskBusy, pollActivity]);

  async function handleRefreshHardware() {
    setError("");
    try {
      await loadHardware(true);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    }
  }

  useEffect(() => {
    let cancelled = false;

    void getLocalGenerationLimits(settings.activeProfileId)
      .then((result) => {
        if (!cancelled) {
          setGenerationLimits(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGenerationLimits(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [settings.activeProfileId, settings]);

  async function handleSaveSettings() {
    setIsSaving(true);
    setError("");
    try {
      const saved = await saveLocalInferenceSettings(settings);
      setSettings(normalizeLocalSettings(saved));
      setMessage("本地生图设置已保存。");
      await refreshPanelSilently();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function withActivityTask<T>(task: () => Promise<T>, onDone?: () => Promise<void>) {
    setActiveTab("download");
    pollActivity();
    try {
      const result = await task();
      if (onDone) {
        await onDone();
      }
      return result;
    } finally {
      pollActivity();
    }
  }

  async function handleDownloadRuntime(runtimeId: string) {
    setIsRuntimeBusy(true);
    setBusyRuntimeId(runtimeId);
    setActiveTask({
      kind: "runtime-download",
      label: runtimeLabelById(runtimes, runtimeId),
      startedAt: Date.now(),
    });
    setError("");
    try {
      await withActivityTask(async () => {
        await downloadLocalDiffusionRuntime(runtimeId);
        await setActiveLocalDiffusionRuntime(runtimeId);
      }, async () => {
        setMessage("生图 Runtime 已安装。");
        await refreshPanelSilently();
      });
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : String(downloadError));
    } finally {
      setIsRuntimeBusy(false);
      setBusyRuntimeId("");
      await finishTaskState();
    }
  }

  async function handleImportRuntimeZip(runtimeId: string) {
    const selectedPath = await open({
      filters: [{ extensions: ["zip"], name: "Runtime 压缩包" }],
      multiple: false,
      title: "选择 stable-diffusion.cpp Runtime zip",
    });

    if (typeof selectedPath !== "string") {
      return;
    }

    setIsRuntimeBusy(true);
    setBusyRuntimeId(runtimeId);
    setActiveTask({
      kind: "runtime-import",
      label: runtimeLabelById(runtimes, runtimeId),
      startedAt: Date.now(),
    });
    setError("");
    try {
      await withActivityTask(async () => {
        await importLocalDiffusionRuntimeFromZip(runtimeId, selectedPath);
        await setActiveLocalDiffusionRuntime(runtimeId);
      }, async () => {
        setMessage("已从本地 zip 导入生图 Runtime。");
        await refreshPanelSilently();
      });
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setIsRuntimeBusy(false);
      setBusyRuntimeId("");
      await finishTaskState();
    }
  }

  async function handleActivateRuntime(runtimeId: string) {
    setError("");
    try {
      await setActiveLocalDiffusionRuntime(runtimeId);
      setMessage("已切换生图 Runtime。");
      await refreshPanelSilently();
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : String(activateError));
    }
  }

  async function handleRemoveRuntime(runtimeId: string) {
    setError("");
    try {
      await removeLocalDiffusionRuntime(runtimeId);
      setMessage("已卸载生图 Runtime。");
      await refreshPanelSilently();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : String(removeError));
    }
  }

  async function handleBrowseModelsDirectory() {
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: "选择模型目录",
    });

    if (typeof selectedPath === "string") {
      setSettings((current) => ({ ...current, modelsDirectory: selectedPath }));
    }
  }

  async function handleImportProfileDirectory(profileId: string) {
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: "选择模型文件夹（含 DiT / VAE / LLM 三文件）",
    });

    if (typeof selectedPath !== "string") {
      return;
    }

    setIsProfileBusy(true);
    setBusyProfileId(profileId);
    setActiveTask({
      kind: "model-import",
      label: profileLabelById(profiles, profileId),
      profileId,
      startedAt: Date.now(),
    });
    setError("");
    try {
      await saveLocalInferenceSettings(settings);
      await withActivityTask(
        () => importLocalModelBundleFromDirectory(profileId, selectedPath),
        async () => {
          setMessage("模型文件已从本地目录导入。");
          await refreshProfilesAndLoras();
        },
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setIsProfileBusy(false);
      setBusyProfileId("");
      await finishTaskState();
    }
  }

  async function handleDownloadProfile(profileId: string) {
    setIsProfileBusy(true);
    setBusyProfileId(profileId);
    setActiveTask({
      kind: "model-download",
      label: profileLabelById(profiles, profileId),
      profileId,
      startedAt: Date.now(),
      state: "running",
    });
    setError("");
    let paused = false;
    try {
      await withActivityTask(
        () => downloadLocalModelProfile(profileId),
        async () => {
          setMessage("模型文件下载完成。");
          await refreshProfilesAndLoras();
        },
      );
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : String(downloadError);
      if (message === DOWNLOAD_PAUSED_MESSAGE) {
        paused = true;
        setActiveTask((current) =>
          current ? { ...current, state: "paused" } : current,
        );
        setMessage("模型下载已暂停，可随时恢复。");
      } else if (message === DOWNLOAD_CANCELLED_MESSAGE) {
        setMessage("模型下载已取消，未完成文件已保留，可再次恢复下载。");
      } else {
        setError(message);
      }
    } finally {
      if (paused) {
        await finishTaskState({ keepPaused: true });
      } else {
        setIsProfileBusy(false);
        setBusyProfileId("");
        await finishTaskState();
      }
    }
  }

  async function handlePauseModelDownload() {
    setIsDownloadControlBusy(true);
    setError("");
    try {
      await pauseLocalModelDownload();
      pollActivity();
    } catch (pauseError) {
      setError(pauseError instanceof Error ? pauseError.message : String(pauseError));
    } finally {
      setIsDownloadControlBusy(false);
    }
  }

  async function handleCancelModelDownload() {
    setIsDownloadControlBusy(true);
    setError("");
    try {
      await cancelLocalModelDownload();
      setMessage("下载已取消，未完成文件已保留，可再次恢复下载。");
      setIsProfileBusy(false);
      setBusyProfileId("");
      setIsLoraBusy(false);
      setBusyLoraId("");
      setActiveTask(null);
      pollActivity();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : String(cancelError));
    } finally {
      setIsDownloadControlBusy(false);
    }
  }

  async function handleResumeModelDownload(profileId: string) {
    setIsProfileBusy(true);
    setBusyProfileId(profileId);
    setDownloadTask((current) =>
      current?.profileId === profileId
        ? { ...current, state: "running", canResume: false }
        : current,
    );
    setActiveTask({
      kind: "model-download",
      label: profileLabelById(profiles, profileId),
      profileId,
      startedAt: Date.now(),
      state: "running",
    });
    setError("");
    pollActivity();
    let paused = false;
    try {
      await withActivityTask(
        () => resumeLocalModelDownload(profileId),
        async () => {
          setMessage("模型文件下载完成。");
          await refreshProfilesAndLoras();
        },
      );
    } catch (resumeError) {
      const message = resumeError instanceof Error ? resumeError.message : String(resumeError);
      if (message === DOWNLOAD_PAUSED_MESSAGE) {
        paused = true;
        setActiveTask((current) =>
          current ? { ...current, state: "paused" } : current,
        );
        setMessage("模型下载已暂停，可随时恢复。");
      } else if (message === DOWNLOAD_CANCELLED_MESSAGE) {
        setMessage("模型下载已取消，未完成文件已保留，可再次恢复下载。");
      } else {
        setError(message);
      }
    } finally {
      if (paused) {
        await finishTaskState({ keepPaused: true });
      } else {
        setIsProfileBusy(false);
        setBusyProfileId("");
        await finishTaskState();
      }
    }
  }

  async function handleDownloadLora(loraId: string) {
    setIsLoraBusy(true);
    setBusyLoraId(loraId);
    setActiveTab("download");
    setActiveTask({
      kind: "lora-download",
      label: loraLabelById(loras, loraId),
      loraId,
      startedAt: Date.now(),
      state: "running",
    });
    setError("");
    let paused = false;
    try {
      await withActivityTask(
        () => downloadLocalLora(loraId),
        async () => {
          setMessage("LoRA 下载完成。");
          await refreshProfilesAndLoras();
        },
      );
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : String(downloadError);
      if (message === DOWNLOAD_PAUSED_MESSAGE) {
        paused = true;
        setActiveTask((current) =>
          current ? { ...current, state: "paused" } : current,
        );
        setMessage("LoRA 下载已暂停，可随时恢复。");
      } else if (message === DOWNLOAD_CANCELLED_MESSAGE) {
        setMessage("LoRA 下载已取消，未完成文件已保留，可再次恢复下载。");
      } else {
        setError(message);
      }
    } finally {
      if (paused) {
        await finishTaskState({ keepPaused: true });
      } else {
        setIsLoraBusy(false);
        setBusyLoraId("");
        await finishTaskState();
      }
    }
  }

  async function handleResumeLoraDownload(loraId: string) {
    setIsLoraBusy(true);
    setBusyLoraId(loraId);
    setDownloadTask((current) =>
      current?.loraId === loraId
        ? { ...current, state: "running", canResume: false }
        : current,
    );
    setActiveTask({
      kind: "lora-download",
      label: loraLabelById(loras, loraId),
      loraId,
      startedAt: Date.now(),
      state: "running",
    });
    setError("");
    pollActivity();
    let paused = false;
    try {
      await withActivityTask(
        () => resumeLocalLoraDownload(loraId),
        async () => {
          setMessage("LoRA 下载完成。");
          await refreshProfilesAndLoras();
        },
      );
    } catch (resumeError) {
      const message = resumeError instanceof Error ? resumeError.message : String(resumeError);
      if (message === DOWNLOAD_PAUSED_MESSAGE) {
        paused = true;
        setActiveTask((current) =>
          current ? { ...current, state: "paused" } : current,
        );
        setMessage("LoRA 下载已暂停，可随时恢复。");
      } else if (message === DOWNLOAD_CANCELLED_MESSAGE) {
        setMessage("LoRA 下载已取消，未完成文件已保留，可再次恢复下载。");
      } else {
        setError(message);
      }
    } finally {
      if (paused) {
        await finishTaskState({ keepPaused: true });
      } else {
        setIsLoraBusy(false);
        setBusyLoraId("");
        await finishTaskState();
      }
    }
  }

  async function handleImportLora(loraId: string) {
    const selectedPath = await open({
      filters: [{ extensions: ["safetensors"], name: "LoRA 权重" }],
      multiple: false,
      title: "选择 LoRA 文件",
    });

    if (typeof selectedPath !== "string") {
      return;
    }

    setIsLoraBusy(true);
    setBusyLoraId(loraId);
    setError("");
    try {
      await importLocalLora(loraId, selectedPath);
      setMessage("LoRA 已从本地文件导入。");
      await refreshProfilesAndLoras();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setIsLoraBusy(false);
      setBusyLoraId("");
    }
  }

  async function handleTestGeneration() {
    setIsTesting(true);
    setActiveTask({
      kind: "test",
      label: profileLabelById(profiles, settings.activeProfileId),
      profileId: settings.activeProfileId,
      startedAt: Date.now(),
    });
    setError("");
    setTestPreviewPath("");
    setActiveTab("test");
    try {
      await saveLocalInferenceSettings(settings);
      const result = await testLocalImageGeneration({
        prompt: testPrompt,
        profileId: settings.activeProfileId,
        width: settings.testWidth,
        height: settings.testHeight,
        referenceImagePath: testReferencePath,
        referenceStrength: testReferenceStrength,
      });
      setTestPreviewPath(result.absolutePath);
      setMessage(result.message);
      await refreshPanelSilently();
    } catch (testError) {
      const message = testError instanceof Error ? testError.message : String(testError);
      setError(message);
      await appLogger.error("本地测试出图失败", {
        errorMessage: message,
        profileId: settings.activeProfileId,
        scope: "localModels.test",
      });
    } finally {
      setIsTesting(false);
      await finishTaskState();
    }
  }

  const hasInstalledRuntime = runtimes.some((entry) => entry.installed);
  const hasActiveRuntime = runtimes.some((entry) => entry.active);
  const modelsDirectoryDisplay =
    settings.modelsDirectory.trim() || hardware?.modelsDirectory || "（应用默认目录）";

  return (
    <div className="local-models-shell space-y-4">
      <LocalModelsOverviewStrip
        generationLimits={generationLimits}
        hardware={hardware}
        profiles={profiles}
        runtimes={runtimes}
      />

      {error ? (
        <p className="settings-status" data-error="true">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          正在加载…
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Cpu aria-hidden="true" className="size-4" />
          <span>
            推荐档位：<strong className="text-foreground">{hardware?.recommendedProfileId ?? "—"}</strong>
          </span>
          <Button
            aria-label="重新探测硬件"
            disabled={isProbingHardware || isLoading}
            onClick={() => void handleRefreshHardware()}
            size="icon"
            type="button"
            variant="ghost"
          >
            <RefreshCw aria-hidden="true" className={isProbingHardware ? "animate-spin" : undefined} />
          </Button>
        </div>
      </div>

      <SettingsPanelCard
        description="Runtime、模型档位、下载任务与测试出图"
        icon={HardDrive}
        title="本地生图"
      >
        <Tabs className="local-models-tabs" onValueChange={setActiveTab} value={activeTab}>
          <TabsList className="local-models-tabs-list" variant="line">
            <TabsTrigger className="local-models-tab-trigger" value="runtime">
              运行环境
            </TabsTrigger>
            <TabsTrigger className="local-models-tab-trigger" value="profiles">
              模型管理
            </TabsTrigger>
            <TabsTrigger className="local-models-tab-trigger" value="download">
              <span className="inline-flex items-center gap-1.5">
                下载任务
                {isTaskBusy ? (
                  <Badge className="px-1.5 py-0 text-[10px]" variant="secondary">
                    进行中
                  </Badge>
                ) : null}
              </span>
            </TabsTrigger>
            <TabsTrigger className="local-models-tab-trigger" value="test">
              测试出图
            </TabsTrigger>
          </TabsList>

          <TabsContent className="local-models-tab-panel" value="runtime">
            <LocalModelsRuntimeTab
              activeProfileId={settings.activeProfileId}
              backendLabel={generationLimits?.backendLabel}
              busyRuntimeId={busyRuntimeId}
              capabilities={sdCliCapabilities}
              hasActiveRuntime={hasActiveRuntime}
              hasInstalledRuntime={hasInstalledRuntime}
              isRuntimeBusy={isRuntimeBusy}
              isSaving={isSaving}
              onActivate={(id) => void handleActivateRuntime(id)}
              onDownload={(id) => void handleDownloadRuntime(id)}
              onImportZip={(id) => void handleImportRuntimeZip(id)}
              onRemove={(id) => void handleRemoveRuntime(id)}
              onSaveSettings={() => void handleSaveSettings()}
              onSettingsChange={setSettings}
              runtimeRootDirectory={runtimeRootDirectory}
              runtimes={runtimes}
              settings={settings}
            />
          </TabsContent>

          <TabsContent className="local-models-tab-panel" value="profiles">
            <LocalModelsProfilesTab
              busyProfileId={busyProfileId}
              isProfileBusy={isProfileBusy}
              isSaving={isSaving}
              modelsDirectoryDisplay={modelsDirectoryDisplay}
              onBrowseModelsDirectory={() => void handleBrowseModelsDirectory()}
              onDownloadProfile={(id) => void handleDownloadProfile(id)}
              onImportDirectory={(id) => void handleImportProfileDirectory(id)}
              onResetModelsDirectory={() => setSettings((current) => ({ ...current, modelsDirectory: "" }))}
              onSaveSettings={() => void handleSaveSettings()}
              onSettingsChange={setSettings}
              profiles={profiles}
              settings={settings}
            />
          </TabsContent>

          <TabsContent className="local-models-tab-panel" value="download">
            <LocalModelsDownloadTab
              activeTask={activeTask}
              activity={activity}
              downloadTask={downloadTask}
              isDownloadControlBusy={isDownloadControlBusy}
              modelsDirectoryDisplay={modelsDirectoryDisplay}
              onCancelDownload={() => void handleCancelModelDownload()}
              onPauseDownload={() => void handlePauseModelDownload()}
              onResumeDownload={(profileId) => void handleResumeModelDownload(profileId)}
              onResumeLoraDownload={(loraId) => void handleResumeLoraDownload(loraId)}
            />
          </TabsContent>

          <TabsContent className="local-models-tab-panel" value="test">
            <LocalModelsTestTab
              activity={isTesting ? activity : null}
              busyLoraId={busyLoraId}
              img2imgSupported={generationLimits?.img2imgSupported ?? false}
              isLoraBusy={isLoraBusy}
              isTesting={isTesting}
              loras={loras}
              onDownloadLora={(loraId) => void handleDownloadLora(loraId)}
              onImportLora={(loraId) => void handleImportLora(loraId)}
              onOpenRuntimeTab={() => setActiveTab("runtime")}
              onSettingsChange={setSettings}
              onTest={() => void handleTestGeneration()}
              onTestPromptChange={setTestPrompt}
              onTestReferencePathChange={setTestReferencePath}
              onTestReferenceStrengthChange={setTestReferenceStrength}
              settings={settings}
              testPreviewPath={testPreviewPath}
              testPrompt={testPrompt}
              testReferencePath={testReferencePath}
              testReferenceStrength={testReferenceStrength}
            />
          </TabsContent>
        </Tabs>
      </SettingsPanelCard>

      <SettingsPanelCard description="Phase 2 备选引擎评估记录" icon={Cpu} title="引擎评估">
        <LocalModelsEvaluationList evaluations={evaluations} />
      </SettingsPanelCard>
    </div>
  );
}
