import { invoke } from "@tauri-apps/api/core";

import type { ProjectCharacterGenerationSettings } from "@/features/projects/characterGenerationTypes";

export function getProjectCharacterGeneration(projectRoot: string) {
  return invoke<ProjectCharacterGenerationSettings>("get_project_character_generation", { projectRoot });
}

export function updateProjectCharacterGeneration(
  projectRoot: string,
  settings: ProjectCharacterGenerationSettings,
) {
  return invoke<ProjectCharacterGenerationSettings>("update_project_character_generation", {
    projectRoot,
    settings,
  });
}

export function setProjectLayoutAnchorCharacter(projectRoot: string, characterId?: string) {
  return invoke<ProjectCharacterGenerationSettings>("set_project_layout_anchor_character", {
    projectRoot,
    characterId: characterId ?? null,
  });
}

export interface ReextractFilmstripFramesInput {
  actionId: string;
  characterId: string;
  cutPositions: number[];
  projectRoot: string;
}

export function reextractFilmstripFrames(input: ReextractFilmstripFramesInput) {
  return invoke<import("@/features/characters/types").CharacterAssetRecord>("reextract_filmstrip_frames", {
    input,
  });
}
