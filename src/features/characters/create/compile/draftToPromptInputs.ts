import type { CharacterWorkshopDraft } from "../../types";
import { entityTypeLabels, roleLabels } from "../../archetypes/defaults";

export interface PromptSection {
  locked: boolean;
  title: string;
  value: string;
}

export function compileDraftPromptSections(draft: CharacterWorkshopDraft): PromptSection[] {
  const size = draft.size === "自定义" ? `${draft.customWidth}x${draft.customHeight}` : draft.size;
  const directionLabel =
    draft.direction === "eight" ? "八方向参考" : draft.direction === "four" ? "前后左右四方向" : "单张正面母版";
  const backgroundLabel = getBackgroundLabel(draft.backgroundMode);
  const identity = draft.identity;

  return [
    {
      locked: false,
      title: "Identity 身份",
      value: [
        `${draft.name || "未命名"}`,
        `${entityTypeLabels[identity.entityType]} · ${roleLabels[identity.role]}`,
        identity.raceOrSpecies ? `种族/物种：${identity.raceOrSpecies}` : "",
        identity.classOrOccupation ? `职业/定位：${identity.classOrOccupation}` : "",
        draft.description.trim() || "未填写角色描述",
        identity.narrativeTags.length > 0 ? `叙事标签：${identity.narrativeTags.join("、")}` : "",
      ]
        .filter(Boolean)
        .join("；"),
    },
    {
      locked: false,
      title: "Style 风格",
      value: [
        draft.style,
        draft.stylePresetId ? `风格预设：${draft.stylePresetId}` : "",
        draft.styleAnchorVariantKey ? `风格锚点变体：${draft.styleAnchorVariantKey}` : "",
        draft.moodKeywords.length > 0 ? `情绪：${draft.moodKeywords.join("、")}` : "",
        `色板：${draft.palette.join(" / ")}`,
        draft.referenceStrength > 0 ? `参考图权重：${Math.round(draft.referenceStrength * 100)}%` : "",
      ]
        .filter(Boolean)
        .join("；"),
    },
    {
      locked: false,
      title: "Outfit 外观特征",
      value: formatAppearanceTraits(draft),
    },
    {
      locked: true,
      title: "Generation 生成约束",
      value: `${size} 像素画布，${directionLabel}，${backgroundLabel}，${draft.generationQuality}质量，候选 ${draft.generationCount} 张。`,
    },
    {
      locked: true,
      title: "Negative 排除项",
      value: "blurry, low quality, deformed limbs, extra limbs, text, watermark, ui frame",
    },
  ];
}

export function compileDraftPromptText(draft: CharacterWorkshopDraft) {
  return compileDraftPromptSections(draft)
    .map((section) => `${section.title}: ${section.value}`)
    .join("\n");
}

function formatAppearanceTraits(draft: CharacterWorkshopDraft) {
  if (draft.appearanceTraits.length > 0) {
    return draft.appearanceTraits
      .map((trait) => {
        const colors = trait.colors?.length ? `，色=${trait.colors.join("/")}` : "";
        return `[${trait.category}] ${trait.label}：${trait.prompt}${colors}`;
      })
      .join("；");
  }

  if (draft.selectedResources.length > 0) {
    return draft.selectedResources.map((resource) => `${resource.label}：${resource.prompt}`).join("；");
  }

  return "未添加外观特征，生成将主要依赖角色描述。";
}

function getBackgroundLabel(backgroundMode: CharacterWorkshopDraft["backgroundMode"]) {
  if (backgroundMode === "checker") {
    return "棋盘格背景";
  }

  if (backgroundMode === "solid") {
    return "纯白背景";
  }

  if (backgroundMode === "chroma") {
    return "抠图绿背景";
  }

  return "透明背景";
}
