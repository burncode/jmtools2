import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  characterMotionPresetCatalog,
  type CharacterMotionPreset,
} from "../motion/motionPresets";

interface MotionPresetPickerProps {
  onSelect: (preset: CharacterMotionPreset) => void;
  selectedPresetId?: string;
}

export function MotionPresetPicker({ onSelect, selectedPresetId }: MotionPresetPickerProps) {
  const [query, setQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState(
    characterMotionPresetCatalog.categories[0]?.id ?? "locomotion",
  );

  const activeCategory = useMemo(
    () =>
      characterMotionPresetCatalog.categories.find((category) => category.id === activeCategoryId) ??
      characterMotionPresetCatalog.categories[0],
    [activeCategoryId],
  );

  const filteredPresets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const presets = activeCategory?.presets ?? [];
    if (!normalized) {
      return presets;
    }
    return presets.filter(
      (preset) =>
        preset.label.toLowerCase().includes(normalized) ||
        preset.actionId.toLowerCase().includes(normalized) ||
        preset.prompt.toLowerCase().includes(normalized),
    );
  }, [activeCategory, query]);

  return (
    <section aria-label="动作预设" className="character-motion-preset-picker">
      <Input
        aria-label="搜索动作预设"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索动作预设…"
        value={query}
      />
      <div className="character-motion-preset-categories" role="tablist">
        {characterMotionPresetCatalog.categories.map((category) => (
          <Button
            aria-pressed={category.id === activeCategory?.id}
            className={cn("character-motion-preset-category", category.id === activeCategory?.id && "active")}
            key={category.id}
            onClick={() => setActiveCategoryId(category.id)}
            size="sm"
            type="button"
            variant="outline"
          >
            {category.label}
          </Button>
        ))}
      </div>
      <div className="character-motion-preset-grid">
        {filteredPresets.map((preset) => (
          <button
            className={cn(
              "character-motion-preset-card",
              selectedPresetId === preset.id && "character-motion-preset-card-active",
            )}
            key={preset.id}
            onClick={() => onSelect(preset)}
            type="button"
          >
            <strong>{preset.label}</strong>
            <span>{preset.prompt}</span>
            <Badge variant="outline">{preset.defaultFrames} 帧</Badge>
          </button>
        ))}
      </div>
    </section>
  );
}
