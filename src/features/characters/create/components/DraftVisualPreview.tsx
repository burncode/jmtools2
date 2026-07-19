import type { CharacterWorkshopDraft } from "../../types";
import { entityTypeLabels, roleLabels } from "../../archetypes/defaults";

interface DraftVisualPreviewProps {
  compact?: boolean;
  draft: CharacterWorkshopDraft;
}

export function DraftVisualPreview({ compact = false, draft }: DraftVisualPreviewProps) {
  const sizeLabel = draft.size === "自定义" ? `${draft.customWidth}×${draft.customHeight}` : draft.size;
  const directionLabel =
    draft.direction === "eight" ? "八方向" : draft.direction === "four" ? "四方向" : "单视图";

  return (
    <div className={`character-draft-visual-preview${compact ? " character-draft-visual-preview-compact" : ""}`}>
      <div aria-hidden="true" className="character-draft-preview-canvas">
        <div className="character-draft-preview-spec-frame">
          <span>{sizeLabel}</span>
          <small>{directionLabel}</small>
        </div>
        {draft.referenceImages.length > 0 ? (
          <div className="character-draft-preview-reference-collage">
            {draft.referenceImages.slice(0, compact ? 2 : 4).map((image) => (
              <img alt="" key={image.id} src={image.dataUrl} />
            ))}
          </div>
        ) : (
          <div className="character-draft-preview-placeholder">
            <span>{entityTypeLabels[draft.identity.entityType]}</span>
            <small>{roleLabels[draft.identity.role]}</small>
          </div>
        )}
      </div>

      <div className="character-draft-preview-meta">
        <div aria-label="色板预览" className="character-draft-preview-palette">
          {draft.palette.map((color, index) => (
            <span key={`${color}-${index}`} style={{ backgroundColor: color }} title={color} />
          ))}
        </div>
        {draft.appearanceTraits.length > 0 ? (
          <div className="character-draft-preview-traits">
            {draft.appearanceTraits.slice(0, compact ? 4 : 8).map((trait) => (
              <span key={trait.id}>{trait.label}</span>
            ))}
          </div>
        ) : (
          <p className="character-draft-preview-empty-note">尚未添加外观特征</p>
        )}
      </div>
    </div>
  );
}
