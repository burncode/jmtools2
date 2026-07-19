import { cn } from "@/lib/utils";

import type { BuiltinPaletteDefinition } from "@/features/style-presets/stylePaletteCatalog";

interface PalettePresetPickerProps {
  onSelect: (palette: BuiltinPaletteDefinition) => void;
  palettes: BuiltinPaletteDefinition[];
  selectedId: string;
}

export function PalettePresetPicker({ onSelect, palettes, selectedId }: PalettePresetPickerProps) {
  return (
    <div aria-label="内置色板" className="app-palette-preset-picker" role="listbox">
      {palettes.map((palette) => {
        const selected = palette.id === selectedId;

        return (
          <button
            aria-selected={selected}
            className={cn("app-palette-preset-card", selected && "app-palette-preset-card-selected")}
            key={palette.id}
            onClick={() => onSelect(palette)}
            role="option"
            type="button"
          >
            <div aria-hidden="true" className="app-palette-preset-strip">
              {palette.colors.map((color) => (
                <span key={`${palette.id}-${color}`} style={{ backgroundColor: color }} />
              ))}
            </div>
            <div className="app-palette-preset-meta">
              <strong>{palette.label}</strong>
              <small>{palette.tagline}</small>
            </div>
          </button>
        );
      })}
    </div>
  );
}
