import type { ExportTarget, ProjectCategory, ProjectTemplate } from "./types";

export interface ProjectTemplateOption {
  description: string;
  label: string;
  value: ProjectTemplate;
}

export interface ExportTargetOption {
  label: string;
  value: ExportTarget;
}

export interface ProjectCategoryOption {
  label: string;
  value: ProjectCategory;
}

export const projectTemplates = [
  {
    description: "只创建标准目录和项目清单，适合从零开始。",
    label: "空项目",
    value: "empty",
  },
  {
    description: "预设角色、瓦片、图集和导出分组。",
    label: "像素风 RPG",
    value: "pixelRpg",
  },
  {
    description: "偏向角色动作、平台瓦片和关卡素材。",
    label: "平台跳跃",
    value: "platformer",
  },
  {
    description: "适合图标、按钮、面板和界面素材。",
    label: "UI 图标包",
    value: "uiPack",
  },
  {
    description: "适合音效、循环音乐和音频转换流程。",
    label: "音效包",
    value: "audioPack",
  },
] as const satisfies ProjectTemplateOption[];

export const exportTargets = [
  { label: "PixiJS", value: "pixijs" },
  { label: "Godot", value: "godot" },
  { label: "Unity", value: "unity" },
  { label: "Phaser", value: "phaser" },
] as const satisfies ExportTargetOption[];

export const projectCategories = [
  { label: "2D RPG", value: "2dRpg" },
  { label: "平台跳跃", value: "platformer" },
  { label: "塔防", value: "towerDefense" },
  { label: "卡牌", value: "card" },
  { label: "动作冒险", value: "actionAdventure" },
  { label: "UI 资源包", value: "uiPack" },
  { label: "音频资源包", value: "audioPack" },
  { label: "其他", value: "other" },
] as const satisfies ProjectCategoryOption[];
