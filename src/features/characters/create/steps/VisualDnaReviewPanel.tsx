import { Dna, ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { entityTypeLabels, roleLabels } from "../../archetypes/defaults";
import { appearanceTraitCategoryLabels, directionOptions } from "../../characterFixtures";
import type { CharacterWorkshopDraft } from "../../types";

interface VisualDnaReviewPanelProps {
  draft: CharacterWorkshopDraft;
  onEditSetup?: () => void;
  readOnly?: boolean;
}

export function VisualDnaReviewPanel({ draft, onEditSetup, readOnly = true }: VisualDnaReviewPanelProps) {
  const directionLabel =
    directionOptions.find((option) => option.value === draft.direction)?.label ?? draft.direction;
  const canvasLabel = draft.size === "自定义" ? `${draft.customWidth}x${draft.customHeight}` : draft.size;
  const hasContent = draft.name.trim().length > 0 || draft.description.trim().length > 0;

  return (
    <section aria-label="Visual DNA 摘要" className="character-wizard-panel character-concept-visual-dna character-visual-dna-review">
      <header className="character-panel-title character-panel-title-compact">
        <span className="step-dot">1</span>
        <div>
          <p className="panel-label">创作摘要</p>
          <h3>Visual DNA 预览</h3>
        </div>
        <Dna aria-hidden="true" className="title-accent" size={18} />
      </header>

      {readOnly && onEditSetup ? (
        <Button className="character-edit-setup-button" onClick={onEditSetup} type="button" variant="outline">
          返回修改设定
        </Button>
      ) : null}

      {!hasContent ? (
        <div className="character-preview-empty character-concept-empty">
          <Dna aria-hidden="true" size={32} strokeWidth={1.4} />
          <p>尚未填写角色设定。</p>
        </div>
      ) : (
        <div className="character-concept-visual-dna-body">
          <div className="character-concept-identity">
            <h4>{draft.name.trim() || "未命名角色"}</h4>
            <p>{draft.description.trim() || "暂无描述"}</p>
          </div>

          <div className="character-concept-meta-row">
            <Badge variant="secondary">{entityTypeLabels[draft.identity.entityType]}</Badge>
            <Badge variant="secondary">{roleLabels[draft.identity.role]}</Badge>
            {draft.identity.raceOrSpecies ? <Badge variant="outline">{draft.identity.raceOrSpecies}</Badge> : null}
            {draft.identity.classOrOccupation ? <Badge variant="outline">{draft.identity.classOrOccupation}</Badge> : null}
            <Badge variant="outline">{draft.style}</Badge>
            <Badge variant="outline">{canvasLabel}</Badge>
            <Badge variant="outline">{directionLabel}</Badge>
          </div>

          {draft.identity.narrativeTags.length > 0 ? (
            <section className="character-concept-section">
              <header>
                <strong>叙事标签</strong>
              </header>
              <div className="character-concept-tag-row">
                {draft.identity.narrativeTags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          {draft.moodKeywords.length > 0 ? (
            <section className="character-concept-section">
              <header>
                <strong>情绪关键词</strong>
              </header>
              <div className="character-concept-tag-row">
                {draft.moodKeywords.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          {draft.palette.length > 0 ? (
            <section className="character-concept-section">
              <header>
                <strong>主色板</strong>
              </header>
              <div className="character-concept-palette-row">
                {draft.palette.map((color) => (
                  <span className="character-concept-palette-swatch" key={color} style={{ backgroundColor: color }} title={color} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="character-concept-section">
            <header>
              <strong>外观特征</strong>
              <span>{draft.appearanceTraits.length} 项</span>
            </header>
            {draft.appearanceTraits.length > 0 ? (
              <div className="character-trait-list">
                {draft.appearanceTraits.map((trait) => (
                  <article className="character-trait-item" key={trait.id}>
                    <div className="character-trait-item-head">
                      <Badge variant="secondary">{appearanceTraitCategoryLabels[trait.category]}</Badge>
                      <strong>{trait.label}</strong>
                    </div>
                    <p>{trait.prompt}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="character-setup-hint">未添加结构化特征，将主要使用角色描述生成。</p>
            )}
          </section>

          <section className="character-concept-section">
            <header>
              <strong>参考素材</strong>
              <span>{draft.referenceImages.length} / 4</span>
            </header>
            {draft.referenceImages.length > 0 ? (
              <div className="character-concept-reference-row">
                {draft.referenceImages.map((image) => (
                  <figure className="character-concept-reference-thumb" key={image.id}>
                    <img alt={image.fileName} src={image.dataUrl} />
                  </figure>
                ))}
              </div>
            ) : (
              <div className="character-preview-empty character-preview-empty-compact character-concept-reference-empty">
                <ImageIcon aria-hidden="true" size={20} strokeWidth={1.5} />
                <p>未上传参考图。</p>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
