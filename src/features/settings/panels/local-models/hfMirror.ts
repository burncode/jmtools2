export const HF_MIRROR_CN_ENDPOINT = "https://hf-mirror.com";

export type HuggingFaceEndpointPreset = "official" | "mirror" | "custom";

export function detectHuggingFaceEndpointPreset(endpoint: string): HuggingFaceEndpointPreset {
  const normalized = endpoint.trim().replace(/\/+$/, "");
  if (!normalized) {
    return "official";
  }

  if (normalized === HF_MIRROR_CN_ENDPOINT) {
    return "mirror";
  }

  return "custom";
}

export function huggingFaceEndpointFromPreset(preset: HuggingFaceEndpointPreset, customEndpoint: string) {
  switch (preset) {
    case "official":
      return "";
    case "mirror":
      return HF_MIRROR_CN_ENDPOINT;
    case "custom":
      return customEndpoint.trim().replace(/\/+$/, "");
    default:
      return "";
  }
}

export const HUGGINGFACE_ENDPOINT_PRESET_OPTIONS = [
  { label: "官方（huggingface.co）", value: "official" as const },
  { label: "国内镜像（hf-mirror.com）", value: "mirror" as const },
  { label: "自定义", value: "custom" as const },
];
