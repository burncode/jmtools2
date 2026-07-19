import type { AppearanceTrait, AppearanceTraitCategory, CharacterEntityType } from "../../../types";

export const traitQuickChipsByEntityType: Record<
  CharacterEntityType,
  Array<{ category: AppearanceTraitCategory; label: string; prompt: string }>
> = {
  boss: [
    { category: "body", label: "巨型", prompt: "towering boss silhouette, fills the frame" },
    { category: "body", label: "多段躯体", prompt: "multi-segment body, readable boss anatomy" },
    { category: "effect", label: "范围光环", prompt: "large aura effect, environmental pressure" },
    { category: "effect", label: "阶段特征", prompt: "phase-change visual cue, cracked armor or glowing core" },
  ],
  construct: [
    { category: "body", label: "金属材质", prompt: "metallic plates, bolt joints, industrial silhouette" },
    { category: "body", label: "核心模块", prompt: "visible power core, glowing center" },
    { category: "weapon", label: "武器模块", prompt: "attached weapon module, readable from distance" },
    { category: "accessory", label: "关节", prompt: "articulated joints, mechanical movement hints" },
  ],
  creature: [
    { category: "body", label: "鳞片皮肤", prompt: "scaled skin texture, readable pixel clusters" },
    { category: "body", label: "利爪", prompt: "sharp claws, clear attack silhouette" },
    { category: "body", label: "尾巴", prompt: "distinct tail shape, helps direction read" },
    { category: "body", label: "双角", prompt: "horns, strong head silhouette" },
  ],
  humanoid: [
    { category: "body", label: "发型", prompt: "readable hair silhouette, distinct head shape" },
    { category: "costume", label: "服装", prompt: "clear costume layers, game-readable outfit" },
    { category: "weapon", label: "武器", prompt: "held weapon with clean pixel outline" },
    { category: "accessory", label: "配饰", prompt: "distinct accessory, supports character identity" },
    { category: "body", label: "面部", prompt: "simple readable face, limited pixel detail" },
  ],
  spirit: [
    { category: "effect", label: "光效", prompt: "soft glow, floating light particles" },
    { category: "body", label: "半透明", prompt: "semi-transparent body, ethereal form" },
    { category: "effect", label: "粒子", prompt: "particle trail, magical motes" },
    { category: "effect", label: "悬浮", prompt: "floating posture, no grounded feet emphasis" },
  ],
};

export function createAppearanceTrait(input: {
  category: AppearanceTraitCategory;
  colors?: string[];
  label: string;
  prompt?: string;
}): AppearanceTrait {
  return {
    category: input.category,
    colors: input.colors,
    id: `trait-${crypto.randomUUID().slice(0, 8)}`,
    label: input.label,
    prompt: input.prompt ?? `${input.label}, pixel art game character detail`,
  };
}
