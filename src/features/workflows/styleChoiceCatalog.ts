import {
  Box,
  Camera,
  Clapperboard,
  CloudFog,
  CloudSun,
  Gamepad2,
  Grid3x3,
  Lock,
  Paintbrush,
  Pipette,
  Sparkles,
  Sun,
  SwatchBook,
} from "lucide-react";

import type { VisualChoiceOption } from "@/components/shared/VisualChoiceGrid";

export const RENDER_TYPE_CHOICES: VisualChoiceOption[] = [
  { icon: Grid3x3, label: "像素", value: "pixel" },
  { icon: Sparkles, label: "动漫", value: "anime" },
  { icon: Camera, label: "写实", value: "realistic" },
  { icon: Paintbrush, label: "手绘", value: "hand_drawn" },
  { icon: Box, label: "低模", value: "low_poly" },
];

export const LIGHTING_TYPE_CHOICES: VisualChoiceOption[] = [
  { icon: Sun, label: "平光", value: "flat" },
  { icon: CloudSun, label: "柔光", value: "soft" },
  { icon: Clapperboard, label: "电影", value: "cinematic" },
  { icon: CloudFog, label: "体积光", value: "volumetric" },
  { icon: Gamepad2, label: "游戏", value: "game" },
];

export const PALETTE_MODE_CHOICES: VisualChoiceOption[] = [
  { icon: SwatchBook, label: "预设", value: "preset" },
  { icon: Pipette, label: "手动", value: "manual" },
  { icon: Lock, label: "锁定", value: "locked" },
];

export const PIXEL_DENSITY_CHOICES: VisualChoiceOption[] = [
  { label: "16", value: "16x16" },
  { label: "32", value: "32x32" },
  { label: "64", value: "64x64" },
  { label: "无", value: "none" },
];

export const EDGE_STYLE_CHOICES: VisualChoiceOption[] = [
  { label: "硬边", value: "hard" },
  { label: "软边", value: "soft" },
  { label: "无", value: "none" },
];

export const COLOR_THEME_MODE_CHOICES: VisualChoiceOption[] = [
  { label: "预设", value: "preset" },
  { label: "自定义", value: "custom" },
];

export const MATERIAL_STYLE_CHOICES: VisualChoiceOption[] = [
  { label: "平涂", value: "flat" },
  { label: "哑光", value: "matte" },
  { label: "高光", value: "glossy" },
  { label: "水彩", value: "watercolor" },
  { label: "颗粒", value: "grainy" },
];

export const SHADING_STYLE_CHOICES: VisualChoiceOption[] = [
  { label: "硬边明暗", value: "hard_cel" },
  { label: "赛璐璐", value: "cel" },
  { label: "软渐变", value: "soft_gradient" },
  { label: "厚涂", value: "painterly" },
];

export const TEXTURE_STYLE_CHOICES: VisualChoiceOption[] = [
  { label: "平滑", value: "smooth" },
  { label: "颗粒", value: "grain" },
  { label: "笔触", value: "brushstroke" },
  { label: "纸纹", value: "paper" },
];

export const LINE_WEIGHT_CHOICES: VisualChoiceOption[] = [
  { label: "细线", value: "thin" },
  { label: "中线", value: "medium" },
  { label: "粗线", value: "bold" },
  { label: "无线", value: "none" },
];

export const COLOR_THEME_CHOICES: VisualChoiceOption[] = [
  { label: "暗色", value: "dark" },
  { label: "亮色", value: "light" },
  { label: "奇幻", value: "fantasy" },
  { label: "暖色", value: "warm" },
  { label: "冷色", value: "cool" },
  { label: "霓虹", value: "neon" },
  { label: "粉彩", value: "pastel" },
  { label: "大地", value: "earth" },
  { label: "单色", value: "monochrome" },
];

export function getRenderTypeLabel(value: string): string {
  return RENDER_TYPE_CHOICES.find((option) => option.value === value)?.label ?? value;
}

export function getLightingTypeLabel(value: string): string {
  return LIGHTING_TYPE_CHOICES.find((option) => option.value === value)?.label ?? value;
}

export function getMaterialStyleLabel(value: string): string {
  return MATERIAL_STYLE_CHOICES.find((option) => option.value === value)?.label ?? value;
}

export function getShadingStyleLabel(value: string): string {
  return SHADING_STYLE_CHOICES.find((option) => option.value === value)?.label ?? value;
}

export function getTextureStyleLabel(value: string): string {
  return TEXTURE_STYLE_CHOICES.find((option) => option.value === value)?.label ?? value;
}

export function getLineWeightLabel(value: string): string {
  return LINE_WEIGHT_CHOICES.find((option) => option.value === value)?.label ?? value;
}
