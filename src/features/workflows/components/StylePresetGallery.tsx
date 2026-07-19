import { cn } from "@/lib/utils";

import { StylePresetCard } from "@/components/shared/StylePresetCard";

import type { StylePresetDefinition } from "../stylePresets";

interface StylePresetGalleryProps {
  onOpenLibrary?: () => void;
  onSelect: (presetId: string) => void;
  presets: StylePresetDefinition[];
  selectedId: string;
  variant?: "compact" | "library";
}

export function StylePresetGallery({
  onOpenLibrary,
  onSelect,
  presets,
  selectedId,
  variant = "compact",
}: StylePresetGalleryProps) {
  return (
    <div className="workflow-style-preset-gallery" data-variant={variant}>
      {onOpenLibrary ? (
        <div
          className={cn(
            "workflow-style-preset-gallery-header",
            variant === "compact" && "workflow-style-preset-gallery-header--compact",
          )}
        >
          {variant !== "compact" ? (
            <span className="workflow-style-preset-gallery-title">风格预设库</span>
          ) : null}
          <button className="workflow-style-preset-gallery-link" onClick={onOpenLibrary} type="button">
            全部预设 &gt;
          </button>
        </div>
      ) : null}
      <div className="workflow-style-preset-gallery-grid">
        {presets.map((preset) => (
          <StylePresetCard
            key={preset.id}
            onSelect={() => onSelect(preset.id)}
            selected={preset.id === selectedId}
            tagline={preset.tagline}
            thumbnail={preset.thumbnail}
            title={preset.label}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}
