import { useEffect, useMemo, useState } from "react";

import {
  deleteProjectCharacterArchetype,
  listProjectCharacterArchetypes,
  saveProjectCharacterArchetype,
  type ProjectCharacterArchetype,
} from "@/lib/tauri/commands";

import { applyArchetypeTemplate, archetypeTemplates } from "../../../archetypes/templates";
import { emptyCharacterDraft, normalizeCharacterWorkshopDraft } from "../../../archetypes/defaults";
import type { CharacterWorkshopDraft } from "../../../types";

export const PRIMARY_PRESET_IDS = ["blank", "daoist_cultivator", "demon_boss", "slime_enemy"] as const;

export type PrimaryPresetId = (typeof PRIMARY_PRESET_IDS)[number];

export function useCharacterPresetLoader(
  projectRoot: string,
  onDraftChange: (patch: Partial<CharacterWorkshopDraft>) => void,
) {
  const [projectTemplates, setProjectTemplates] = useState<ProjectCharacterArchetype[]>([]);
  const [projectTemplatesError, setProjectTemplatesError] = useState<string>();
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const primaryPresets = useMemo(
    () => archetypeTemplates.filter((template) => PRIMARY_PRESET_IDS.includes(template.id as PrimaryPresetId)),
    [],
  );

  const secondaryPresets = useMemo(
    () => archetypeTemplates.filter((template) => !PRIMARY_PRESET_IDS.includes(template.id as PrimaryPresetId)),
    [],
  );

  async function refreshProjectTemplates() {
    try {
      const templates = await listProjectCharacterArchetypes(projectRoot);
      setProjectTemplates(templates);
      setProjectTemplatesError(undefined);
    } catch (error) {
      setProjectTemplates([]);
      setProjectTemplatesError(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    void refreshProjectTemplates();
  }, [projectRoot]);

  function handleBuiltinTemplateSelect(templateId: string) {
    onDraftChange(applyArchetypeTemplate(templateId));
  }

  function handleProjectTemplateSelect(template: ProjectCharacterArchetype) {
    onDraftChange(
      normalizeCharacterWorkshopDraft({
        ...template.patch,
        archetypeTemplateId: template.id,
        identity: {
          ...emptyCharacterDraft.identity,
          ...template.patch.identity,
        },
      }),
    );
  }

  async function handleSaveProjectTemplate(draft: CharacterWorkshopDraft) {
    const label = draft.name.trim() || "项目模板";
    setIsSavingTemplate(true);

    try {
      const templateId = `project-${label.replace(/\s+/g, "-").toLowerCase()}`;
      await saveProjectCharacterArchetype(projectRoot, {
        description: draft.description.slice(0, 160),
        id: templateId,
        label,
        patch: {
          appearanceTraits: draft.appearanceTraits,
          description: draft.description,
          featureTags: draft.featureTags,
          identity: draft.identity,
          moodKeywords: draft.moodKeywords,
          palette: draft.palette,
          size: draft.size,
          style: draft.style,
          stylePresetId: draft.stylePresetId,
        },
      });
      await refreshProjectTemplates();
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function handleDeleteProjectTemplate(templateId: string) {
    await deleteProjectCharacterArchetype(projectRoot, templateId);
    await refreshProjectTemplates();
  }

  return {
    handleBuiltinTemplateSelect,
    handleDeleteProjectTemplate,
    handleProjectTemplateSelect,
    handleSaveProjectTemplate,
    isSavingTemplate,
    primaryPresets,
    projectTemplates,
    projectTemplatesError,
    secondaryPresets,
  };
}
