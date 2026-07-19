import type {
  CharacterEntityType,
  CharacterIdentityBlock,
  CharacterWorkshopDraft,
} from "../types";

export const defaultIdentity = (): CharacterIdentityBlock => ({
  ageBand: "adult",
  classOrOccupation: "",
  entityType: "humanoid",
  gender: "unknown",
  narrativeTags: [],
  raceOrSpecies: "",
  role: "hero",
});

export const emptyCharacterDraft = {
  appearanceTraits: [],
  backgroundMode: "transparent",
  customHeight: 48,
  customWidth: 32,
  description: "",
  direction: "four",
  elementColors: {},
  featureTags: [],
  generationCount: "4",
  generationOptions: ["transparent-background", "unify-pixel-style"],
  generationQuality: "标准",
  identity: defaultIdentity(),
  moodKeywords: [],
  name: "",
  palette: ["#334155", "#64748b", "#94a3b8", "#cbd5e1"],
  referenceImages: [],
  referenceStrength: 0.6,
  selectedResources: [],
  size: "32x48",
  style: "16bit RPG 像素风格",
  styleAnchorVariantKey: "",
} as const satisfies CharacterWorkshopDraft;

export function normalizeCharacterWorkshopDraft(
  draft: Partial<CharacterWorkshopDraft> & { identity?: Partial<CharacterIdentityBlock> },
): CharacterWorkshopDraft {
  const identity = {
    ...defaultIdentity(),
    ...draft.identity,
  };

  return {
    ...emptyCharacterDraft,
    ...draft,
    appearanceTraits: draft.appearanceTraits ?? emptyCharacterDraft.appearanceTraits,
    elementColors: draft.elementColors ?? emptyCharacterDraft.elementColors,
    featureTags: draft.featureTags ?? emptyCharacterDraft.featureTags,
    generationOptions: draft.generationOptions ?? emptyCharacterDraft.generationOptions,
    identity,
    moodKeywords: draft.moodKeywords ?? emptyCharacterDraft.moodKeywords,
    palette: draft.palette?.length ? draft.palette : [...emptyCharacterDraft.palette],
    referenceImages: draft.referenceImages ?? emptyCharacterDraft.referenceImages,
    selectedResources: draft.selectedResources ?? emptyCharacterDraft.selectedResources,
    referenceStrength:
      typeof draft.referenceStrength === "number" ? draft.referenceStrength : emptyCharacterDraft.referenceStrength,
    styleAnchorVariantKey: draft.styleAnchorVariantKey ?? emptyCharacterDraft.styleAnchorVariantKey,
  };
}

export const entityTypeLabels: Record<CharacterEntityType, string> = {
  boss: "Boss",
  construct: "构造体",
  creature: "怪物/兽形",
  humanoid: "人形",
  spirit: "灵体",
};

export const roleLabels: Record<CharacterIdentityBlock["role"], string> = {
  boss: "Boss",
  enemy: "敌人",
  hero: "主角",
  npc: "NPC",
  pet: "宠物",
};
