import { invoke } from "@tauri-apps/api/core";

import { invokeWithLog } from "./diagnostics";

export type InferenceBackendKind = "cuda" | "vulkan" | "metal" | "cpu" | "unknown";

export interface HardwareProfile {
  backend: InferenceBackendKind;
  gpuName?: string | null;
  hasNvidiaGpu: boolean;
  os: string;
  totalRamMb: number;
  vramMb?: number | null;
}

export interface ModelProfile {
  backend: string;
  defaultCfgScale: number;
  defaultHeight: number;
  defaultSteps: number;
  defaultWidth: number;
  description: string;
  estimatedSizeMb: number;
  id: string;
  label: string;
  minVramMb: number;
  preset: string;
  weight: string;
}

export interface LocalInferenceSettings {
  activeProfileId: string;
  defaultImg2imgStrength: number;
  defaultLoraStrength: number;
  enabledLoraIds: string[];
  generationCfgScale: number;
  generationHeight: number;
  generationSteps: number;
  generationWidth: number;
  huggingfaceEndpoint: string;
  maxGenerationSide: number;
  maxImg2imgSide: number;
  modelsDirectory: string;
  ollamaApiBase: string;
  runtimeBackend?: string | null;
  runtimeClipOnCpu?: boolean | null;
  runtimeDiffusionFa?: boolean | null;
  runtimeLoraApplyMode?: string | null;
  runtimeOffloadToCpu?: boolean | null;
  runtimeParamsBackend?: string | null;
  runtimeVaeOnCpu: boolean;
  runtimeVaeTileOverlap?: number | null;
  runtimeVaeTiling: boolean;
  testHeight: number;
  testWidth: number;
}

export interface SdCliCapabilities {
  available: boolean;
  img2imgInitFlag?: string | null;
  img2imgModeFlag?: string | null;
  img2imgSupported: boolean;
  runtimeVersion?: string | null;
  supportedFlags: string[];
}

export interface LocalGenerationLimits {
  cappedFrom?: [number, number] | null;
  maxSide: number;
  recommendedHeight: number;
  recommendedWidth: number;
  warnings: string[];
}

export interface EffectiveRuntimeOptions {
  clipOnCpu: boolean;
  clipOnCpuSupported: boolean;
  diffusionFa: boolean;
  loraApplyMode: string;
  offloadToCpu: boolean;
  vaeOnCpu: boolean;
  vaeOnCpuSupported: boolean;
  vaeTileOverlap?: number | null;
  vaeTiling: boolean;
  vaeTilingSupported: boolean;
}

export interface LocalGenerationLimitsResult {
  backendLabel: string;
  effectiveRuntime: EffectiveRuntimeOptions;
  img2imgMaxSide: number;
  img2imgSupported: boolean;
  limits: LocalGenerationLimits;
}

export interface ProfileAssetFileStatus {
  fileName: string;
  present: boolean;
  role: string;
}

export interface LocalModelProfileStatus {
  assetFiles: ProfileAssetFileStatus[];
  detail: string;
  installed: boolean;
  profile: ModelProfile;
  ready: boolean;
  recommended: boolean;
}

export interface LoraAttachment {
  compatiblePresets: string[];
  compatibleProfileIds: string[];
  defaultStrength: number;
  description: string;
  estimatedSizeMb: number;
  fileStem: string;
  hfRepo: string;
  id: string;
  label: string;
  triggerWords: string[];
}

export interface LocalLoraStatus {
  detail: string;
  installed: boolean;
  lora: LoraAttachment;
}

export interface BackendEvaluationStatus {
  id: string;
  integrated: boolean;
  label: string;
  phase: string;
  recommendation: string;
  summary: string;
}

export interface LocalHardwareProbeResult {
  cached: boolean;
  diskUsageMb: number;
  hardware: HardwareProfile;
  modelsDirectory: string;
  probedAt: number;
  recommendedProfileId: string;
}

export type LocalInferencePhase = "downloading" | "generating" | "idle";

export type LocalDownloadTaskState = "running" | "paused" | "cancelled";

export type LocalDownloadTaskKind = "model" | "lora";

export interface LocalDownloadTask {
  activity: LocalInferenceActivity;
  canResume: boolean;
  loraId?: string;
  profileId: string;
  state: LocalDownloadTaskState;
  taskKind?: LocalDownloadTaskKind;
}

export interface LocalInferenceActivity {
  bytesDownloaded?: number | null;
  bytesTotal?: number | null;
  controlState?: string | null;
  message: string;
  phase: LocalInferencePhase;
  profileId?: string | null;
  progressPercent?: number | null;
  speedBytesPerSec?: number | null;
  stage?: string | null;
}

export interface ProbeLocalHardwareInput {
  force?: boolean;
}

export interface TestLocalImageGenerationInput {
  height?: number;
  profileId?: string;
  prompt: string;
  referenceImagePath?: string;
  referenceStrength?: number;
  width?: number;
}

export interface TestLocalImageGenerationResult {
  absolutePath: string;
  height: number;
  message: string;
  width: number;
}

export interface LocalDiffusionRuntimeStatus {
  active: boolean;
  channel: string;
  description: string;
  downloadUrl: string;
  executable: string;
  executablePath?: string | null;
  id: string;
  installDirectory?: string | null;
  installed: boolean;
  installedVersion?: string | null;
  label: string;
  packageVersion: string;
  platform: string;
  recommended: boolean;
  updateAvailable: boolean;
}

export interface InstalledRuntimeRecord {
  executablePath: string;
  installDirectory: string;
  installedAt: number;
  packageVersion: string;
  runtimeId: string;
}

export function listLocalDiffusionRuntimes() {
  return invoke<LocalDiffusionRuntimeStatus[]>("list_local_diffusion_runtimes");
}

export function downloadLocalDiffusionRuntime(runtimeId: string) {
  return invoke<InstalledRuntimeRecord>("download_local_diffusion_runtime", {
    input: { runtimeId },
  });
}

export function importLocalDiffusionRuntimeFromZip(runtimeId: string, zipPath: string) {
  return invoke<InstalledRuntimeRecord>("import_local_diffusion_runtime_from_zip", {
    input: { runtimeId, zipPath },
  });
}

export function removeLocalDiffusionRuntime(runtimeId: string) {
  return invoke<void>("remove_local_diffusion_runtime", {
    input: { runtimeId },
  });
}

export function setActiveLocalDiffusionRuntime(runtimeId: string) {
  return invoke<void>("set_active_local_diffusion_runtime", {
    input: { runtimeId },
  });
}

export function getLocalDiffusionRuntimeDirectory() {
  return invoke<string>("get_local_diffusion_runtime_directory");
}

export function probeLocalHardware(input: ProbeLocalHardwareInput = {}) {
  return invoke<LocalHardwareProbeResult>("probe_local_hardware", { input });
}

export function listLocalModelProfiles() {
  return invoke<LocalModelProfileStatus[]>("list_local_model_profiles").then((rows) =>
    rows.map(normalizeProfileStatus),
  );
}

function normalizeProfileStatus(row: LocalModelProfileStatus): LocalModelProfileStatus {
  return {
    ...row,
    assetFiles: row.assetFiles ?? [],
  };
}

export function listLocalLoras() {
  return invoke<LocalLoraStatus[]>("list_local_loras");
}

export function listCompatibleLocalLoras(profileId: string) {
  return invoke<LoraAttachment[]>("list_compatible_local_loras", {
    input: { profileId },
  });
}

export function downloadLocalLora(loraId: string) {
  return invoke<string>("download_local_lora_command", {
    input: { loraId },
  });
}

export function importLocalLora(loraId: string, sourcePath: string) {
  return invoke<string>("import_local_lora_command", {
    input: { loraId, sourcePath },
  });
}

export function getLocalGenerationLimits(profileId = "") {
  return invoke<LocalGenerationLimitsResult>("get_local_generation_limits", {
    input: { profileId },
  });
}

export function getSdCliCapabilities() {
  return invoke<SdCliCapabilities>("get_sd_cli_capabilities_command");
}

export function getLocalInferenceSettings() {
  return invoke<LocalInferenceSettings>("get_local_inference_settings");
}

export function saveLocalInferenceSettings(settings: LocalInferenceSettings) {
  return invoke<LocalInferenceSettings>("save_local_inference_settings_command", {
    input: { settings },
  });
}

export function listLocalModelCatalog() {
  return invoke<ModelProfile[]>("list_local_model_catalog");
}

export function listLocalBackendEvaluations() {
  return invoke<BackendEvaluationStatus[]>("list_local_backend_evaluations");
}

export function getLocalInferenceActivity() {
  return invoke<LocalInferenceActivity>("get_local_inference_activity_command");
}

export function getLocalDownloadTask() {
  return invoke<LocalDownloadTask | null>("get_local_download_task_command");
}

export function pauseLocalModelDownload() {
  return invoke<void>("pause_local_model_download_command");
}

export function resumeLocalModelDownload(profileId: string) {
  return invoke<void>("resume_local_model_download_command", {
    input: { profileId },
  });
}

export function resumeLocalLoraDownload(loraId: string) {
  return invoke<string>("resume_local_lora_download_command", {
    input: { loraId },
  });
}

export function cancelLocalModelDownload() {
  return invoke<void>("cancel_local_model_download_command");
}

export function deleteLocalModelDownload(profileId: string) {
  return invoke<void>("delete_local_model_download_command", {
    input: { profileId },
  });
}

export const DOWNLOAD_PAUSED_MESSAGE = "下载已暂停";
export const DOWNLOAD_CANCELLED_MESSAGE = "下载已取消";

export function testLocalImageGeneration(input: TestLocalImageGenerationInput) {
  return invokeWithLog<TestLocalImageGenerationResult>(
    "test_local_image_generation",
    { input },
    { profileId: input.profileId, scope: "tauri.command" },
  );
}

export function importLocalModelBundleFromDirectory(profileId: string, sourceDir: string) {
  return invoke<void>("import_local_model_bundle_from_directory", {
    input: { profileId, sourceDir },
  });
}

export function downloadLocalModelProfile(profileId: string) {
  return invoke<void>("download_local_model_profile", {
    input: { profileId },
  });
}

export function formatProbedAt(probedAt: number) {
  if (!probedAt) {
    return "尚未探测";
  }

  const milliseconds = probedAt < 1_000_000_000_000 ? probedAt * 1000 : probedAt;
  return new Date(milliseconds).toLocaleString("zh-CN");
}
