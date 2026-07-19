import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/shared";
import {
  deleteProjectCharacterArchetype,
  listProjectCharacterArchetypes,
  saveProjectCharacterArchetype,
  type ProjectCharacterArchetype,
} from "@/lib/tauri/commands";

import { applyArchetypeTemplate, archetypeTemplates } from "../../../archetypes/templates";
import { emptyCharacterDraft, normalizeCharacterWorkshopDraft } from "../../../archetypes/defaults";
import { entityTypeOptions, roleOptions } from "../../../characterFixtures";
import type { CharacterEntityType, CharacterIdentityBlock, CharacterWorkshopDraft } from "../../../types";

interface TemplateTypeTabProps {
  draft: CharacterWorkshopDraft;
  onDraftChange: (draft: Partial<CharacterWorkshopDraft>) => void;
  projectRoot: string;
}

export function TemplateTypeTab({ draft, onDraftChange, projectRoot }: TemplateTypeTabProps) {
  const [projectTemplates, setProjectTemplates] = useState<ProjectCharacterArchetype[]>([]);
  const [projectTemplatesError, setProjectTemplatesError] = useState<string>();
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

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

  function handleTemplateSelect(templateId: string) {
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

  function patchIdentity(patch: Partial<CharacterIdentityBlock>) {
    onDraftChange({
      identity: {
        ...draft.identity,
        ...patch,
      },
    });
  }

  async function handleSaveProjectTemplate() {
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

  return (
    <div className="character-setup-tab-panel">
      <section className="character-concept-section">
        <header>
          <strong>快速开始</strong>
          <span>内置模板</span>
        </header>
        <div className="character-template-grid">
          {archetypeTemplates.map((template) => (
            <Button
              data-active={draft.archetypeTemplateId === template.id}
              key={template.id}
              onClick={() => handleTemplateSelect(template.id)}
              type="button"
              variant={draft.archetypeTemplateId === template.id ? "default" : "outline"}
            >
              <span>{template.label}</span>
              <small>{template.description}</small>
            </Button>
          ))}
        </div>
      </section>

      {projectTemplates.length > 0 ? (
        <section className="character-concept-section">
          <header>
            <strong>项目模板</strong>
            <Button disabled={isSavingTemplate} onClick={() => void handleSaveProjectTemplate()} size="sm" type="button" variant="outline">
              {isSavingTemplate ? "保存中..." : "保存当前设定"}
            </Button>
          </header>
          <div className="character-template-grid">
            {projectTemplates.map((template) => (
              <div className="character-project-template-card" key={template.id}>
                <Button
                  data-active={draft.archetypeTemplateId === template.id}
                  onClick={() => handleProjectTemplateSelect(template)}
                  type="button"
                  variant={draft.archetypeTemplateId === template.id ? "default" : "outline"}
                >
                  <span>{template.label}</span>
                  <small>{template.description || "项目自定义模板"}</small>
                </Button>
                <Button
                  aria-label={`删除项目模板 ${template.label}`}
                  onClick={() => void handleDeleteProjectTemplate(template.id)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  删除
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="character-concept-section">
          <header>
            <strong>项目模板</strong>
            <Button disabled={isSavingTemplate} onClick={() => void handleSaveProjectTemplate()} size="sm" type="button" variant="outline">
              {isSavingTemplate ? "保存中..." : "保存当前设定为项目模板"}
            </Button>
          </header>
        </section>
      )}
      {projectTemplatesError ? <p className="character-template-load-error">{projectTemplatesError}</p> : null}

      <section className="character-concept-section">
        <header>
          <strong>实体类型</strong>
        </header>
        <SegmentedControl
          ariaLabel="实体类型"
          className="character-entity-type-control"
          onValueChange={(value) => patchIdentity({ entityType: value as CharacterEntityType })}
          options={entityTypeOptions.map((option) => ({
            description: option.description,
            label: option.label,
            value: option.value,
          }))}
          value={draft.identity.entityType}
        />
      </section>

      <section className="character-concept-section">
        <header>
          <strong>游戏职能</strong>
        </header>
        <div className="character-concept-tag-row">
          {roleOptions.map((option) => (
            <Badge
              aria-pressed={draft.identity.role === option.value}
              className="character-role-chip"
              data-active={draft.identity.role === option.value}
              key={option.value}
              onClick={() => patchIdentity({ role: option.value })}
              role="button"
              tabIndex={0}
              variant={draft.identity.role === option.value ? "default" : "outline"}
            >
              {option.label}
            </Badge>
          ))}
        </div>
      </section>
    </div>
  );
}
