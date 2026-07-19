import type { CreateSetupSection } from "../../types";

export function resolvePromptSectionFocus(title: string): CreateSetupSection | undefined {
  const normalized = title.toLowerCase();

  if (normalized.includes("negative") || normalized.includes("排除")) {
    return "advanced";
  }

  if (normalized.includes("generation") || normalized.includes("生成约束") || normalized.includes("生成模板")) {
    return normalized.includes("template") || normalized.includes("模板") ? "preset" : "output";
  }

  if (
    normalized.includes("identity") ||
    normalized.includes("身份") ||
    normalized.includes("outfit") ||
    normalized.includes("外观")
  ) {
    return "concept";
  }

  if (
    normalized.includes("style") ||
    normalized.includes("风格") ||
    normalized.includes("anchor") ||
    normalized.includes("锚点") ||
    normalized.includes("variant") ||
    normalized.includes("layout")
  ) {
    return "preset";
  }

  return undefined;
}
