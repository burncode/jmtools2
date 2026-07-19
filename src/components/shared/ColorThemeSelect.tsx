import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ColorThemeDefinition } from "@/features/style-presets/colorThemeCatalog";

interface ColorThemeSelectProps {
  onSelect: (theme: ColorThemeDefinition) => void;
  selectedId: string;
  themes: ColorThemeDefinition[];
}

function ColorThemePreview({ gradient }: { gradient: string }) {
  return (
    <span
      aria-hidden="true"
      className="app-color-theme-select-preview"
      style={{ background: gradient }}
    />
  );
}

export function ColorThemeSelect({ onSelect, selectedId, themes }: ColorThemeSelectProps) {
  const selected = themes.find((theme) => theme.id === selectedId) ?? themes[0];

  return (
    <Select
      onValueChange={(value) => {
        const theme = themes.find((item) => item.id === value);
        if (theme) {
          onSelect(theme);
        }
      }}
      value={selected?.id}
    >
      <SelectTrigger aria-label="配色主题">
        <SelectValue>
          <span className="app-color-theme-select-value">
            {selected ? <ColorThemePreview gradient={selected.gradient} /> : null}
            <span>{selected?.label ?? "选择配色主题"}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {themes.map((theme) => (
          <SelectItem key={theme.id} value={theme.id}>
            <span className="app-color-theme-select-option">
              <ColorThemePreview gradient={theme.gradient} />
              <span>{theme.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
