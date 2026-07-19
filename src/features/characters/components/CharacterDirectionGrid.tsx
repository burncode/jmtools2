import { Compass } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { CharacterAssetRecord } from "../types";

import { findViewThumb } from "./viewReadiness";

export type DirectionViewKind =
  | "default"
  | "single"
  | "front"
  | "back"
  | "left"
  | "right"
  | "frontLeft"
  | "frontRight"
  | "backLeft"
  | "backRight";

interface DirectionCell {
  enabled: boolean;
  label: string;
  tooltip: string;
  viewKind: DirectionViewKind;
}

const EIGHT_WAY_CELLS: DirectionCell[] = [
  { enabled: true, label: "NW", tooltip: "左前", viewKind: "frontLeft" },
  { enabled: true, label: "N", tooltip: "前", viewKind: "front" },
  { enabled: true, label: "NE", tooltip: "右前", viewKind: "frontRight" },
  { enabled: true, label: "W", tooltip: "左", viewKind: "left" },
  { enabled: false, label: "", tooltip: "八方向", viewKind: "default" },
  { enabled: true, label: "E", tooltip: "右", viewKind: "right" },
  { enabled: true, label: "SW", tooltip: "左后", viewKind: "backLeft" },
  { enabled: true, label: "S", tooltip: "后", viewKind: "back" },
  { enabled: true, label: "SE", tooltip: "右后", viewKind: "backRight" },
];

const FOUR_WAY_CELLS: DirectionCell[] = [
  { enabled: false, label: "", tooltip: "", viewKind: "default" },
  { enabled: true, label: "N", tooltip: "前", viewKind: "front" },
  { enabled: false, label: "", tooltip: "", viewKind: "default" },
  { enabled: true, label: "W", tooltip: "左", viewKind: "left" },
  { enabled: false, label: "", tooltip: "四方向", viewKind: "default" },
  { enabled: true, label: "E", tooltip: "右", viewKind: "right" },
  { enabled: false, label: "", tooltip: "", viewKind: "default" },
  { enabled: true, label: "S", tooltip: "后", viewKind: "back" },
  { enabled: false, label: "", tooltip: "", viewKind: "default" },
];

const SINGLE_WAY_CELLS: DirectionCell[] = Array.from({ length: 9 }).map((_, index) => ({
  enabled: index === 4,
  label: index === 4 ? "正" : "",
  tooltip: index === 4 ? "正面" : "",
  viewKind: "single" as const,
}));

function getCells(direction: CharacterAssetRecord["direction"]): DirectionCell[] {
  if (direction === "eight") {
    return EIGHT_WAY_CELLS;
  }
  if (direction === "four") {
    return FOUR_WAY_CELLS;
  }
  return SINGLE_WAY_CELLS;
}

export function getDefaultFacingDirections(direction: CharacterAssetRecord["direction"]): DirectionViewKind[] {
  if (direction === "single") {
    return ["single"];
  }
  return ["front"];
}

export function getAllApplicableViewKinds(direction: CharacterAssetRecord["direction"]): DirectionViewKind[] {
  return getCells(direction)
    .filter((cell) => cell.enabled)
    .map((cell) => cell.viewKind);
}

export function isAllApplicableViewKindsSelected(
  direction: CharacterAssetRecord["direction"],
  selected: DirectionViewKind[],
): boolean {
  const applicable = getAllApplicableViewKinds(direction);
  if (selected.length !== applicable.length) {
    return false;
  }
  return applicable.every((kind) => selected.includes(kind));
}

interface CharacterDirectionGridBaseProps {
  className?: string;
  direction: CharacterAssetRecord["direction"];
  projectRoot?: string;
  record: CharacterAssetRecord;
}

interface CharacterDirectionGridSingleProps extends CharacterDirectionGridBaseProps {
  multiSelect?: false;
  onChange: (viewKind: DirectionViewKind) => void;
  value: DirectionViewKind;
}

interface CharacterDirectionGridMultiProps extends CharacterDirectionGridBaseProps {
  multiSelect: true;
  onChange: (viewKinds: DirectionViewKind[], previewViewKind: DirectionViewKind) => void;
  previewViewKind: DirectionViewKind;
  value: DirectionViewKind[];
}

type CharacterDirectionGridProps = CharacterDirectionGridSingleProps | CharacterDirectionGridMultiProps;

export function CharacterDirectionGrid(props: CharacterDirectionGridProps) {
  const { className, direction, projectRoot = "", record } = props;
  const cells = getCells(direction);

  function isSelected(viewKind: DirectionViewKind) {
    if (props.multiSelect) {
      return props.value.includes(viewKind);
    }
    return props.value === viewKind;
  }

  function handleCellClick(viewKind: DirectionViewKind) {
    if (props.multiSelect) {
      const current = props.value;
      const alreadySelected = current.includes(viewKind);
      let next: DirectionViewKind[];
      if (alreadySelected) {
        if (current.length <= 1) {
          return;
        }
        next = current.filter((kind) => kind !== viewKind);
      } else {
        next = [...current, viewKind];
      }
      props.onChange(next, viewKind);
      return;
    }
    props.onChange(viewKind);
  }

  return (
    <div aria-label="面向方向" className={cn("character-direction-grid", className)} role="group">
      {cells.map((cell, index) => {
        if (!cell.enabled) {
          const isCenter = index === 4;
          return (
            <span
              aria-hidden={!isCenter}
              className={cn("character-direction-grid-cell", "character-direction-grid-cell--empty")}
              key={`empty-${index}`}
            >
              {isCenter ? (
                <span className="character-direction-grid-center">
                  <Compass aria-hidden="true" size={16} />
                  <small>{direction === "single" ? "单方向" : direction === "four" ? "四方向" : "八方向"}</small>
                </span>
              ) : null}
            </span>
          );
        }

        const selected = isSelected(cell.viewKind);
        const isPreview = props.multiSelect && props.previewViewKind === cell.viewKind;
        const thumb = findViewThumb(record, cell.viewKind, projectRoot);

        return (
          <Tooltip key={cell.viewKind}>
            <TooltipTrigger asChild>
              <button
                aria-label={cell.tooltip}
                aria-pressed={selected}
                className={cn(
                  "character-direction-grid-cell",
                  selected && "character-direction-grid-cell--selected",
                  isPreview && "character-direction-grid-cell--preview",
                )}
                data-selected={selected ? "true" : "false"}
                onClick={() => handleCellClick(cell.viewKind)}
                type="button"
              >
                {thumb ? <img alt="" className="character-direction-grid-thumb" src={thumb} /> : null}
                <span className="character-direction-grid-label">{cell.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{cell.tooltip}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function viewKindToDirectionLabel(viewKind: DirectionViewKind): string {
  const map: Record<DirectionViewKind, string> = {
    back: "后",
    backLeft: "左后",
    backRight: "右后",
    default: "正面",
    front: "前",
    frontLeft: "左前",
    frontRight: "右前",
    left: "左",
    right: "右",
    single: "正面",
  };
  return map[viewKind] ?? "前";
}

export function directionLabelToViewKind(label: string): DirectionViewKind {
  const map: Record<string, DirectionViewKind> = {
    前: "front",
    后: "back",
    左: "left",
    右: "right",
    左前: "frontLeft",
    右前: "frontRight",
    左后: "backLeft",
    右后: "backRight",
    正面: "single",
  };
  return map[label] ?? "default";
}
