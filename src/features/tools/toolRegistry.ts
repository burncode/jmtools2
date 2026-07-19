import { Eraser, Grid3X3, Images, WandSparkles } from "lucide-react";

import type { ProductionToolDefinition } from "./types";

export const productionToolDefinitions = [
  {
    category: "asset-cleanup",
    description: "移除角色候选图或素材图背景，输出透明 PNG，供后续入库、切割和动画生产使用。",
    icon: Eraser,
    id: "background-removal",
    inputKinds: ["character-candidate", "image"],
    label: "去背景工具",
    outputKinds: ["clean-image", "transparent-image"],
    route: "asset-tools",
    supportsBatch: false,
    supportsStandalone: true,
    status: "available",
  },
  {
    category: "asset-transform",
    description: "基于正面角色图生成统一视图风格参考，用于后续前后左右或八方向素材生产。",
    icon: Images,
    id: "view-style-transfer",
    inputKinds: ["character-candidate", "transparent-image"],
    label: "视图风格",
    outputKinds: ["character-view-set", "style-variant"],
    route: "asset-tools",
    supportsBatch: false,
    supportsStandalone: false,
    status: "available",
  },
  {
    category: "asset-slicing",
    description: "将角色多视图、spritesheet 或普通素材图按网格、透明边界或手动规则切割为独立资产。",
    icon: Grid3X3,
    id: "asset-slicing",
    inputKinds: ["image", "sprite-sheet", "transparent-image"],
    label: "切割素材",
    outputKinds: ["sliced-assets"],
    route: "asset-tools",
    supportsBatch: true,
    supportsStandalone: true,
    status: "planned",
  },
  {
    category: "preview",
    description: "在 PixiJS 预览器中检查透明背景、缩放、像素锐度和候选素材的一致性。",
    icon: WandSparkles,
    id: "asset-preview-check",
    inputKinds: ["character-candidate", "image", "sprite-sheet", "transparent-image"],
    label: "素材预检",
    outputKinds: ["clean-image"],
    route: "asset-tools",
    supportsBatch: true,
    supportsStandalone: true,
    status: "planned",
  },
] as const satisfies ProductionToolDefinition[];

export type ProductionToolId = (typeof productionToolDefinitions)[number]["id"];

export function getProductionToolDefinition(toolId: ProductionToolId) {
  return productionToolDefinitions.find((tool) => tool.id === toolId);
}

export function getProductionToolsByCategory(category: ProductionToolDefinition["category"]) {
  return productionToolDefinitions.filter((tool) => tool.category === category);
}
