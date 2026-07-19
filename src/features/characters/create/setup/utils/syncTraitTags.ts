import type { AppearanceTrait, CharacterWorkshopDraft } from "../../../types";
import { createAppearanceTrait } from "../components/traitQuickChips";

const MAX_FEATURE_TAGS = 16;
const MAX_APPEARANCE_TRAITS = 24;

export function syncTagsToDraft(
  tags: string[],
  existingTraits: AppearanceTrait[],
): Pick<CharacterWorkshopDraft, "appearanceTraits" | "featureTags"> {
  const featureTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, MAX_FEATURE_TAGS);
  const traitsByLabel = new Map(existingTraits.map((trait) => [trait.label, trait]));

  const appearanceTraits = featureTags
    .map((label) => {
      const existing = traitsByLabel.get(label);
      if (existing) {
        return existing;
      }

      return createAppearanceTrait({
        category: "other",
        label,
        prompt: label,
      });
    })
    .slice(0, MAX_APPEARANCE_TRAITS);

  return { appearanceTraits, featureTags };
}

export function applyTraitTagsChange(
  draft: CharacterWorkshopDraft,
  tags: string[],
): Pick<CharacterWorkshopDraft, "appearanceTraits" | "featureTags"> {
  return syncTagsToDraft(tags, draft.appearanceTraits);
}

export function addTraitTag(
  draft: CharacterWorkshopDraft,
  tag: string,
): Pick<CharacterWorkshopDraft, "appearanceTraits" | "featureTags"> | null {
  const normalizedTag = tag.trim().slice(0, 12);
  if (!normalizedTag || draft.featureTags.includes(normalizedTag)) {
    return null;
  }

  return syncTagsToDraft([...draft.featureTags, normalizedTag], draft.appearanceTraits);
}
