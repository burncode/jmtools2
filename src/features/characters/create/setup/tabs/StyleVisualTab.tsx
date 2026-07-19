import { useEffect, useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { AppSelect, AppTagInput, InspectorField, PanelSection } from "@/components/shared";
import { VisualDnaSummary } from "@/features/style-presets/VisualDnaSummary";
import { findStylePreset, useStylePresets } from "@/features/style-presets/useStylePresets";
import { getProjectCharacterGeneration } from "@/lib/tauri/projectCharacterGeneration";

import { generationOptions, moodKeywordSuggestions } from "../../../characterFixtures";
import type { CharacterWorkshopDraft } from "../../../types";

const NONE_STYLE_ANCHOR_VARIANT = "__default__";

interface StyleVisualTabProps {
  draft: CharacterWorkshopDraft;
  onDraftChange: (draft: Partial<CharacterWorkshopDraft>) => void;
  projectRoot: string;
  stylePresets: Array<{ label: string; value: string }>;
}

export function StyleVisualTab({ draft, onDraftChange, projectRoot, stylePresets }: StyleVisualTabProps) {
  const [variantOptions, setVariantOptions] = useState<Array<{ label: string; value: string }>>([]);

  useEffect(() => {
    void getProjectCharacterGeneration(projectRoot)
      .then((settings) => {
        const options = Object.keys(settings.styleAnchorVariants ?? {}).map((key) => ({
          label: key,
          value: key,
        }));
        setVariantOptions(options);
      })
      .catch(() => setVariantOptions([]));
  }, [projectRoot]);
  const { presets } = useStylePresets();
  const enabledPresets = useMemo(
    () => presets.filter((preset) => preset.label.trim()),
    [presets],
  );
  const selectedPreset = draft.stylePresetId ? findStylePreset(enabledPresets, draft.stylePresetId) : undefined;

  function updatePaletteColor(index: number, color: string) {
    const palette = [...draft.palette];
    palette[index] = color;
    onDraftChange({ palette });
  }

  function addPaletteColor() {
    if (draft.palette.length >= 8) {
      return;
    }

    onDraftChange({ palette: [...draft.palette, "#64748b"] });
  }

  function handleStylePresetChange(presetId: string) {
    const preset = findStylePreset(enabledPresets, presetId);
    if (!preset) {
      onDraftChange({ stylePresetId: undefined });
      return;
    }

    onDraftChange({
      style: preset.label,
      stylePresetId: preset.id,
    });
  }

  return (
    <div className="character-setup-tab-panel">
      <PanelSection description="风格与色板决定整体视觉方向" title="风格与配色">
        <InspectorField label="风格预设">
          <AppSelect
            ariaLabel="风格预设"
            onValueChange={handleStylePresetChange}
            options={enabledPresets.map((preset) => ({
              label: preset.label,
              value: preset.id,
            }))}
            placeholder="选择项目/全局风格预设"
            value={draft.stylePresetId ?? ""}
          />
          {selectedPreset ? <VisualDnaSummary params={selectedPreset.params} /> : null}
        </InspectorField>

        {variantOptions.length > 0 ? (
          <InspectorField label="风格锚点变体">
            <AppSelect
              ariaLabel="风格锚点变体"
              onValueChange={(value) =>
                onDraftChange({
                  styleAnchorVariantKey: value === NONE_STYLE_ANCHOR_VARIANT ? "" : value,
                })
              }
              options={[{ label: "使用项目默认锚点", value: NONE_STYLE_ANCHOR_VARIANT }, ...variantOptions]}
              placeholder="选择项目风格变体（可选）"
              value={
                draft.styleAnchorVariantKey?.trim()
                  ? draft.styleAnchorVariantKey
                  : NONE_STYLE_ANCHOR_VARIANT
              }
            />
          </InspectorField>
        ) : null}

        <InspectorField label="像素风格 *">
          <AppSelect
            ariaLabel="像素风格"
            onValueChange={(style) => onDraftChange({ style })}
            options={stylePresets}
            value={draft.style}
          />
        </InspectorField>

        <InspectorField label="情绪 / 光照关键词">
          <AppTagInput
            onValueChange={(moodKeywords) => onDraftChange({ moodKeywords })}
            placeholder={moodKeywordSuggestions.join("、")}
            value={draft.moodKeywords}
          />
        </InspectorField>

        <InspectorField label="主色板">
          <div className="character-concept-palette-row">
            {draft.palette.map((color, index) => (
              <label className="character-palette-input" key={`palette-${index}`}>
                <input onChange={(event) => updatePaletteColor(index, event.target.value)} type="color" value={color} />
              </label>
            ))}
            {draft.palette.length < 8 ? (
              <button className="character-palette-add" onClick={addPaletteColor} type="button">
                +
              </button>
            ) : null}
          </div>
        </InspectorField>

        <div className="generation-option-list">
          {generationOptions
            .filter((option) => option.value.includes("pixel") || option.value.includes("style") || option.value.includes("background"))
            .map((option) => (
              <label key={option.label}>
                <Checkbox
                  checked={draft.generationOptions.includes(option.value)}
                  onCheckedChange={() =>
                    onDraftChange({
                      generationOptions: toggleStringValue(draft.generationOptions, option.value),
                    })
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
        </div>
      </PanelSection>
    </div>
  );
}

function toggleStringValue(values: string[], value: string) {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }

  return [...values, value];
}
