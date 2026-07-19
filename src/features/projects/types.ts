import type { PipelineAsset } from "../assets/types";
import type { ProjectCharacterGenerationSettings } from "./characterGenerationTypes";

export const projectManifestFileName = "jmproject.json";

export type ExportTarget = "pixijs" | "godot" | "unity" | "phaser";

export type ProjectTemplate = "empty" | "pixelRpg" | "platformer" | "uiPack" | "audioPack";

export type ProjectCategory = "2dRpg" | "platformer" | "towerDefense" | "card" | "actionAdventure" | "uiPack" | "audioPack" | "other";

export interface PipelineProject {
  version: 1;
  name: string;
  slug: string;
  category: ProjectCategory;
  tags: string[];
  description: string;
  rootPath: string;
  template: ProjectTemplate;
  coverImage?: string;
  createdAt: string;
  updatedAt: string;
  assets: PipelineAsset[];
  generators: string[];
  exportTargets: ExportTarget[];
  characterGeneration?: ProjectCharacterGenerationSettings;
}

export interface RecentProject {
  name: string;
  path: string;
  slug: string;
  category: ProjectCategory;
  coverImage?: string;
  template: ProjectTemplate;
  updatedAt: string;
}
