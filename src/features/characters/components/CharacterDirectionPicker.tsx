import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { CharacterAssetRecord } from "../types";
import {
  CharacterDirectionGrid,
  getAllApplicableViewKinds,
  getDefaultFacingDirections,
  type DirectionViewKind,
  viewKindToDirectionLabel,
} from "./CharacterDirectionGrid";
import { findViewThumb, getViewReadiness, type ViewReadiness } from "./viewReadiness";

interface CharacterDirectionPickerProps {
  direction: CharacterAssetRecord["direction"];
  onChange: (viewKinds: DirectionViewKind[], previewViewKind: DirectionViewKind) => void;
  previewViewKind: DirectionViewKind;
  projectRoot: string;
  record: CharacterAssetRecord;
  showEightWayHint?: boolean;
  value: DirectionViewKind[];
}

function readinessLabel(readiness: ViewReadiness) {
  if (readiness === "ready") {
    return "已有参考";
  }
  if (readiness === "mirrored") {
    return "镜像推导";
  }
  if (readiness === "missing") {
    return "待生成";
  }
  return "默认";
}

function readinessVariant(readiness: ViewReadiness): "default" | "outline" | "secondary" {
  if (readiness === "ready") {
    return "secondary";
  }
  if (readiness === "missing") {
    return "outline";
  }
  return "default";
}

export function CharacterDirectionPicker({
  direction,
  onChange,
  previewViewKind,
  projectRoot,
  record,
  showEightWayHint = false,
  value,
}: CharacterDirectionPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedCount = value.length;
  const isMulti = selectedCount > 1;
  const label = isMulti ? `已选 ${selectedCount} 个方向` : viewKindToDirectionLabel(value[0] ?? "front");
  const thumb = findViewThumb(record, previewViewKind, projectRoot);
  const readiness = getViewReadiness(record, previewViewKind, projectRoot);

  function handleSelectAll() {
    const all = getAllApplicableViewKinds(direction);
    const preview = all.includes(previewViewKind) ? previewViewKind : all[0];
    onChange(all, preview);
  }

  function handleClear() {
    const defaults = getDefaultFacingDirections(direction);
    onChange(defaults, defaults[0]);
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button className={cn("character-direction-picker-trigger")} type="button" variant="outline">
          {thumb ? (
            <span className="character-direction-picker-thumb">
              <img alt="" src={thumb} />
            </span>
          ) : null}
          <span className="character-direction-picker-label">
            {label}
            {isMulti ? ` · 预览 ${viewKindToDirectionLabel(previewViewKind)}` : null}
          </span>
          <Badge variant={readinessVariant(readiness)}>{readinessLabel(readiness)}</Badge>
          <ChevronDown aria-hidden="true" size={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="character-direction-picker-popover" side="bottom">
        <header className="character-direction-picker-popover-header">
          <strong>选择面向方向</strong>
          <span>可多选；方向参考图用于 AI 动作 img2img</span>
        </header>
        <CharacterDirectionGrid
          className="character-direction-grid--popover"
          direction={direction}
          multiSelect
          onChange={(viewKinds, nextPreview) => onChange(viewKinds, nextPreview)}
          previewViewKind={previewViewKind}
          projectRoot={projectRoot}
          record={record}
          value={value}
        />
        <div className="character-direction-picker-actions">
          <Button onClick={handleSelectAll} size="sm" type="button" variant="outline">
            全选
          </Button>
          <Button onClick={handleClear} size="sm" type="button" variant="ghost">
            清空
          </Button>
        </div>
        <p className="character-direction-picker-hint">
          若该方向尚无参考图，点击「重新生成」时会自动补生成并规范化。
        </p>
        {showEightWayHint ? (
          <p className="character-direction-picker-hint character-direction-picker-hint-sub">
            八方向批量生成请用卡片内「八方向」按钮。
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
