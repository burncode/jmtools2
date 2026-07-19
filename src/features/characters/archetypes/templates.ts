import type { CharacterWorkshopDraft } from "../types";
import { emptyCharacterDraft, normalizeCharacterWorkshopDraft } from "./defaults";

export interface ArchetypeTemplate {
  description: string;
  id: string;
  label: string;
  patch: Partial<CharacterWorkshopDraft>;
}

export const archetypeTemplates: ArchetypeTemplate[] = [
  {
    description: "从空表单开始，自行填写全部设定。",
    id: "blank",
    label: "空白角色",
    patch: emptyCharacterDraft,
  },
  {
    description: "国风修仙道士，适合 RPG / 横版动作。",
    id: "daoist_cultivator",
    label: "修仙道士",
    patch: {
      appearanceTraits: [
        {
          category: "costume",
          id: "trait-robes",
          label: "道袍",
          prompt: "blue-white Taoist robe, wide sleeves, readable pixel silhouette",
        },
        {
          category: "weapon",
          id: "trait-whisk",
          label: "拂尘",
          prompt: "horsetail whisk, flowing handle",
        },
        {
          category: "accessory",
          id: "trait-talisman",
          label: "符箓",
          prompt: "talisman papers on belt, glowing seals",
        },
        {
          category: "body",
          id: "trait-hair",
          label: "发髻",
          prompt: "topknot, gray hair, calm expression",
        },
      ],
      description: "清修道士，身着道袍，手持拂尘，腰系符箓，气质庄严，适合国风像素 RPG。",
      featureTags: ["道袍", "拂尘", "符箓", "修仙"],
      identity: {
        ageBand: "elder",
        classOrOccupation: "道士",
        entityType: "humanoid",
        gender: "male",
        narrativeTags: ["修仙", "可对话"],
        raceOrSpecies: "人类",
        role: "npc",
      },
      moodKeywords: ["庄严", "清修"],
      name: "云游道士",
      palette: ["#1e4d6b", "#c9d6e8", "#f6c542", "#f8fafc"],
      size: "32x48",
      style: "像素国风",
    },
  },
  {
    description: "大型 Boss，强调剪影与范围感。",
    id: "demon_boss",
    label: "魔物 Boss",
    patch: {
      appearanceTraits: [
        {
          category: "body",
          id: "trait-size",
          label: "巨型",
          prompt: "towering boss silhouette, fills the frame, imposing scale",
        },
        {
          category: "body",
          id: "trait-armor",
          label: "岩甲",
          prompt: "rocky carapace, cracked magma veins",
        },
        {
          category: "effect",
          id: "trait-shock",
          label: "震波",
          prompt: "ground shock aura, dust particles, menacing presence",
        },
      ],
      customHeight: 64,
      customWidth: 64,
      description: "远古魔物 Boss，巨型岩甲身躯，踏地时产生震波，适合关卡终局战。",
      direction: "single",
      featureTags: ["Boss", "岩甲", "震波"],
      identity: {
        ageBand: "ancient",
        classOrOccupation: "守门 Boss",
        entityType: "boss",
        gender: "na",
        narrativeTags: ["精英怪", "不可对话"],
        raceOrSpecies: "魔龙",
        role: "boss",
      },
      moodKeywords: ["压迫", "邪异"],
      name: "裂岩魔龙",
      palette: ["#7f1d1d", "#ea580c", "#292524", "#57534e"],
      size: "64x64",
      style: "像素魔幻",
    },
  },
  {
    description: "凝胶体小型敌人，轮廓简单清晰。",
    id: "slime_enemy",
    label: "史莱姆",
    patch: {
      appearanceTraits: [
        {
          category: "body",
          id: "trait-body",
          label: "凝胶体",
          prompt: "translucent slime body, bouncy silhouette",
        },
        {
          category: "body",
          id: "trait-eye",
          label: "单眼",
          prompt: "single large eye, cute but hostile",
        },
      ],
      description: "基础史莱姆敌人，凝胶半透明身体，单眼，适合早期关卡杂兵。",
      direction: "four",
      featureTags: ["史莱姆", "凝胶"],
      identity: {
        ageBand: "young",
        classOrOccupation: "杂兵",
        entityType: "creature",
        gender: "na",
        narrativeTags: ["敌人"],
        raceOrSpecies: "史莱姆",
        role: "enemy",
      },
      moodKeywords: ["可爱", "威胁"],
      name: "凝胶史莱姆",
      palette: ["#22c55e", "#86efac", "#14532d", "#f8fafc"],
      size: "32x48",
      style: "16bit RPG 像素风格",
    },
  },
  {
    description: "小型灵宠，发光粒子与悬浮感。",
    id: "spirit_pet",
    label: "灵宠",
    patch: {
      appearanceTraits: [
        {
          category: "effect",
          id: "trait-glow",
          label: "光晕",
          prompt: "soft glowing aura, floating spirit particles",
        },
        {
          category: "body",
          id: "trait-form",
          label: "灵体",
          prompt: "small ethereal creature, semi-transparent body",
        },
      ],
      description: "小型灵宠，半透明灵体，带柔和光晕，适合跟随型宠物。",
      featureTags: ["灵体", "光效"],
      identity: {
        ageBand: "young",
        classOrOccupation: "灵宠",
        entityType: "spirit",
        gender: "unknown",
        narrativeTags: ["宠物", "可对话"],
        raceOrSpecies: "灵体",
        role: "pet",
      },
      moodKeywords: ["神秘", "可爱"],
      name: "萤火灵",
      palette: ["#38bdf8", "#c084fc", "#f8fafc", "#1e293b"],
      size: "32x48",
      style: "像素魔幻",
    },
  },
  {
    description: "经典 RPG 骑士示例，用于参考而非默认。",
    id: "pixel_knight",
    label: "像素骑士",
    patch: {
      appearanceTraits: [
        {
          category: "costume",
          colors: ["#c9d6e8", "#f6c542"],
          id: "trait-armor",
          label: "轻甲",
          prompt: "silver light armor with layered plates and golden trim",
        },
        {
          category: "accessory",
          colors: ["#2f7df6"],
          id: "trait-cape",
          label: "披风",
          prompt: "blue flowing cape, readable silhouette",
        },
        {
          category: "weapon",
          colors: ["#c9d6e8"],
          id: "trait-sword",
          label: "长剑",
          prompt: "long sword with bright silver blade",
        },
        {
          category: "accessory",
          colors: ["#2f7df6", "#f6c542"],
          id: "trait-shield",
          label: "盾牌",
          prompt: "blue and gold knight shield",
        },
      ],
      description: "年轻的骑士，银色铠甲，蓝色披风，手持长剑和盾牌，正义勇敢，守护王国。",
      featureTags: ["盔甲", "披风", "盾牌", "长剑"],
      identity: {
        ageBand: "young",
        classOrOccupation: "骑士",
        entityType: "humanoid",
        gender: "unknown",
        narrativeTags: ["英雄"],
        raceOrSpecies: "人类",
        role: "hero",
      },
      name: "勇者骑士",
      palette: ["#2f7df6", "#c9d6e8", "#f6c542", "#8b5cf6"],
      size: "32x48",
      style: "16bit RPG 像素风格",
    },
  },
];

export function applyArchetypeTemplate(templateId: string): CharacterWorkshopDraft {
  const template = archetypeTemplates.find((item) => item.id === templateId) ?? archetypeTemplates[0];

  return normalizeCharacterWorkshopDraft({
    ...template.patch,
    archetypeTemplateId: template.id,
    identity: {
      ...emptyCharacterDraft.identity,
      ...template.patch.identity,
    },
  });
}

export function getArchetypeTemplate(templateId?: string) {
  return archetypeTemplates.find((item) => item.id === templateId);
}
