import { cn } from "@/lib/utils";

import type { CharacterActionFrame } from "../../types";
import { resolveCharacterImageSrc } from "../../characterImageSrc";

interface AnimationFrameTileProps {
  frame: CharacterActionFrame;
  onSelect: () => void;
  projectRoot: string;
  selected: boolean;
}

export function AnimationFrameTile({ frame, onSelect, projectRoot, selected }: AnimationFrameTileProps) {
  const frameSrc = resolveCharacterImageSrc(projectRoot, frame.image);

  return (
    <button
      aria-label={`帧 ${frame.index + 1}`}
      aria-pressed={selected}
      className={cn("animation-frame-tile", selected && "animation-frame-tile--selected")}
      data-selected={selected ? "true" : "false"}
      onClick={onSelect}
      type="button"
    >
      <span className="animation-frame-tile-index">{frame.index + 1}</span>
      <span className="animation-frame-tile-thumb">
        {frameSrc ? <img alt="" src={frameSrc} /> : <i>{frame.index + 1}</i>}
      </span>
      <span className="animation-frame-tile-duration">{frame.durationMs}ms</span>
    </button>
  );
}
