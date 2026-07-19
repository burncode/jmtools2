import { Settings2 } from "lucide-react";

import { InspectorField, SegmentedControl } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface PreviewDisplaySettings {
  grid: boolean;
  groundLine: boolean;
  onionAhead: boolean;
  onionBehind: boolean;
  onionSkin: boolean;
}

type AssetPreviewMode = "auto" | "original" | "transparent";

interface CharacterPreviewDisplayOptionsProps {
  assetPreviewMode: AssetPreviewMode;
  onAssetPreviewModeChange: (mode: AssetPreviewMode) => void;
  onChange: (patch: Partial<PreviewDisplaySettings>) => void;
  value: PreviewDisplaySettings;
}

export function CharacterPreviewDisplayOptions({
  assetPreviewMode,
  onAssetPreviewModeChange,
  onChange,
  value,
}: CharacterPreviewDisplayOptionsProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button aria-label="显示选项" size="sm" type="button" variant="outline">
          <Settings2 aria-hidden="true" size={14} />
          显示
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="character-preview-display-options" side="bottom">
        <strong className="character-preview-display-options-title">显示选项</strong>
        <InspectorField label="来源">
          <SegmentedControl
            ariaLabel="预览来源"
            onValueChange={(next) => onAssetPreviewModeChange(next as AssetPreviewMode)}
            options={[
              { label: "自动", value: "auto" },
              { label: "原图", value: "original" },
              { label: "透明", value: "transparent" },
            ]}
            value={assetPreviewMode}
          />
        </InspectorField>
        <label className="character-preview-display-option">
          <Checkbox checked={value.onionSkin} onCheckedChange={(checked) => onChange({ onionSkin: checked === true })} />
          <Label>洋葱皮</Label>
        </label>
        <label className="character-preview-display-option">
          <Checkbox checked={value.onionBehind} onCheckedChange={(checked) => onChange({ onionBehind: checked === true })} />
          <Label>前一帧</Label>
        </label>
        <label className="character-preview-display-option">
          <Checkbox checked={value.onionAhead} onCheckedChange={(checked) => onChange({ onionAhead: checked === true })} />
          <Label>后一帧</Label>
        </label>
        <label className="character-preview-display-option">
          <Checkbox checked={value.grid} onCheckedChange={(checked) => onChange({ grid: checked === true })} />
          <Label>网格</Label>
        </label>
        <label className="character-preview-display-option">
          <Checkbox checked={value.groundLine} onCheckedChange={(checked) => onChange({ groundLine: checked === true })} />
          <Label>地面线</Label>
        </label>
      </PopoverContent>
    </Popover>
  );
}

export const defaultPreviewDisplaySettings: PreviewDisplaySettings = {
  grid: true,
  groundLine: true,
  onionAhead: true,
  onionBehind: true,
  onionSkin: false,
};
