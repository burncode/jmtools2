import type { CharacterCandidatePlan, CharacterGenerationOption, CharacterWorkshopDraft } from "./types";
import { applyArchetypeTemplate } from "./archetypes/templates";
import { emptyCharacterDraft } from "./archetypes/defaults";

export { emptyCharacterDraft };

/** @deprecated 使用 applyArchetypeTemplate('pixel_knight') 或模板库 */
export const characterDraft = applyArchetypeTemplate("pixel_knight") satisfies CharacterWorkshopDraft;

export const canvasSizeOptions = ["32x48", "48x48", "64x64", "自定义"] as const;

export const directionOptions = [
  { description: "只生成正面或单张母版，适合头像、立绘和快速草稿。", label: "单视图", value: "single" },
  { description: "生成前后左右四方向，适合 RPG 角色移动。", label: "四方向", value: "four" },
  { description: "生成八方向参考，适合更完整的俯视角动作系统。", label: "八方向", value: "eight" },
] as const;

export const defaultStylePresets = [
  { label: "16bit RPG", value: "16bit RPG 像素风格" },
  { label: "8bit NES", value: "8bit NES 像素风格" },
  { label: "像素国风", value: "像素国风" },
  { label: "像素魔幻", value: "像素魔幻" },
] as const;

export const defaultFeaturePresets = ["盔甲", "披风", "盾牌", "长剑", "头盔", "角", "翅膀", "法杖"] as const;

export const defaultPaletteColors = ["#2f7df6", "#c9d6e8", "#f6c542", "#8b5cf6"] as const;

export const generationCountOptions = ["2", "4", "6", "8"] as const;

export const generationQualityOptions = ["快速", "标准", "高质量"] as const;

export const candidatePlans = [
  { id: "A", name: "方案 A", note: "推荐", selected: false },
  { id: "B", name: "方案 B", note: "当前方案", selected: true },
  { id: "C", name: "方案 C", note: undefined, selected: false },
  { id: "D", name: "方案 D", note: undefined, selected: false },
] as const satisfies CharacterCandidatePlan[];

export const generationOptions = [
  { checked: true, label: "保持透明背景", value: "transparent-background" },
  { checked: true, label: "自动统一像素风格", value: "unify-pixel-style" },
  { checked: true, label: "生成角色参考图", value: "master-reference" },
  { checked: false, label: "强化动作可拆分", value: "action-ready" },
] as const satisfies CharacterGenerationOption[];

export const backgroundModeOptions = [
  { label: "透明", value: "transparent" },
  { label: "棋盘格", value: "checker" },
  { label: "纯白", value: "solid" },
  { label: "抠图绿", value: "chroma" },
] as const;

export const raceSpeciesSuggestions = ["人类", "妖兽", "魔龙", "机械", "灵体", "僵尸"] as const;

export const classOccupationSuggestions = ["道士", "剑修", "商人", "精英怪", "守门 Boss", "杂兵"] as const;

export const moodKeywordSuggestions = ["庄严", "邪异", "可爱", "压迫", "清修", "神秘"] as const;

export const previewAngles = ["前视", "后视", "左视", "右视"] as const;

export const referenceThumbs = ["角色", "盾牌", "场景", "姿态"] as const;

export const entityTypeOptions = [
  { description: "人类、道士、骑士等双足角色。", label: "人形", value: "humanoid" },
  { description: "史莱姆、野兽、妖兽等非人形敌人。", label: "怪物/兽形", value: "creature" },
  { description: "大型关卡 Boss，强调剪影与压迫感。", label: "Boss", value: "boss" },
  { description: "灵宠、幽灵、元素体等半透明存在。", label: "灵体", value: "spirit" },
  { description: "傀儡、魔像、机械构造体。", label: "构造体", value: "construct" },
] as const;

export const roleOptions = [
  { label: "主角", value: "hero" },
  { label: "NPC", value: "npc" },
  { label: "敌人", value: "enemy" },
  { label: "Boss", value: "boss" },
  { label: "宠物", value: "pet" },
] as const;

export const appearanceTraitCategoryLabels = {
  accessory: "配饰",
  body: "身体",
  costume: "服装",
  effect: "效果",
  other: "其他",
  weapon: "武器",
} as const;
