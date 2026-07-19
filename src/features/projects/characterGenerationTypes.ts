export interface ProjectGenerationTemplate {
  background?: string;
  perspective?: string;
  proportion?: string;
  walkCycleHints?: string;
}

export interface ProjectCharacterGenerationSettings {
  generationTemplate: ProjectGenerationTemplate;
  layoutAnchorCharacterId?: string;
  layoutAnchorDescription?: string;
  styleAnchor?: string;
  styleAnchorVariants?: Record<string, string>;
}

export const emptyProjectCharacterGenerationSettings = (): ProjectCharacterGenerationSettings => ({
  generationTemplate: {},
  layoutAnchorCharacterId: "",
  layoutAnchorDescription: "",
  styleAnchor: "",
  styleAnchorVariants: {},
});
