import motionPresetCatalog from "@shared/character-motion-presets.json";

export interface CharacterMotionPreset {
  actionId: string;
  defaultFrames: number;
  id: string;
  label: string;
  prompt: string;
}

export interface CharacterMotionPresetCategory {
  id: string;
  label: string;
  presets: CharacterMotionPreset[];
}

export interface CharacterMotionPresetCatalog {
  categories: CharacterMotionPresetCategory[];
  version: number;
}

export const characterMotionPresetCatalog = motionPresetCatalog as CharacterMotionPresetCatalog;

export function listMotionPresets(query?: string): CharacterMotionPreset[] {
  const normalized = query?.trim().toLowerCase() ?? "";
  return characterMotionPresetCatalog.categories.flatMap((category) =>
    category.presets.filter((preset) => {
      if (!normalized) {
        return true;
      }
      return (
        preset.label.toLowerCase().includes(normalized) ||
        preset.actionId.toLowerCase().includes(normalized) ||
        preset.prompt.toLowerCase().includes(normalized) ||
        category.label.toLowerCase().includes(normalized)
      );
    }),
  );
}

export function findMotionPresetById(presetId: string): CharacterMotionPreset | undefined {
  for (const category of characterMotionPresetCatalog.categories) {
    const match = category.presets.find((preset) => preset.id === presetId);
    if (match) {
      return match;
    }
  }
  return undefined;
}

export function getMotionPresetCategoryLabel(presetId: string): string | undefined {
  for (const category of characterMotionPresetCatalog.categories) {
    if (category.presets.some((preset) => preset.id === presetId)) {
      return category.label;
    }
  }
  return undefined;
}
