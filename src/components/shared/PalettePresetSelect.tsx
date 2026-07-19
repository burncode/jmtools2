import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { BuiltinPaletteDefinition } from "@/features/style-presets/stylePaletteCatalog";

interface PalettePresetSelectProps {
  onSelect: (palette: BuiltinPaletteDefinition) => void;
  palettes: BuiltinPaletteDefinition[];
  selectedId: string;
}

function PaletteColorStrip({ colors }: { colors: string[] }) {
  return (
    <div aria-hidden="true" className="app-palette-preset-strip">
      {colors.map((color) => (
        <span key={color} style={{ backgroundColor: color }} />
      ))}
    </div>
  );
}

export function PalettePresetSelect({ onSelect, palettes, selectedId }: PalettePresetSelectProps) {
  const selected = palettes.find((palette) => palette.id === selectedId) ?? palettes[0];

  return (
    <Select
      onValueChange={(value) => {
        const palette = palettes.find((item) => item.id === value);
        if (palette) {
          onSelect(palette);
        }
      }}
      value={selected?.id}
    >
      <SelectTrigger aria-label="内置色板">
        <SelectValue>
          <span className="app-palette-preset-select-value">
            {selected ? <PaletteColorStrip colors={selected.colors} /> : null}
            <span>{selected?.label ?? "选择色板"}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {palettes.map((palette) => (
          <SelectItem key={palette.id} value={palette.id}>
            <span className="app-palette-preset-select-option">
              <PaletteColorStrip colors={palette.colors} />
              <span className="app-palette-preset-select-option-text">
                <strong>{palette.label}</strong>
                <small>{palette.tagline}</small>
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
