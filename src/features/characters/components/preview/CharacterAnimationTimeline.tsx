import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";

import type { CharacterActionFrame } from "../../types";
import { AnimationFrameTile } from "./AnimationFrameTile";

interface CharacterAnimationTimelineProps {
  actionLabel: string;
  activeFrameIndex: number;
  fps: number;
  frames: CharacterActionFrame[];
  loopMode: "loop" | "once";
  onSelectFrame: (index: number) => void;
  projectRoot: string;
}

export function CharacterAnimationTimeline({
  actionLabel,
  activeFrameIndex,
  fps,
  frames,
  loopMode,
  onSelectFrame,
  projectRoot,
}: CharacterAnimationTimelineProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) {
      return;
    }
    const selected = strip.querySelector<HTMLButtonElement>('[data-selected="true"]');
    selected?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeFrameIndex]);

  return (
    <section aria-label="动画时间轴" className="character-action-preview-timeline">
      <header className="character-action-preview-timeline-header">
        <strong>{actionLabel}</strong>
        <div className="character-action-preview-timeline-meta">
          <Badge variant="secondary">{frames.length} 帧</Badge>
          <Badge variant="outline">{fps} FPS</Badge>
          <Badge variant="outline">{loopMode === "loop" ? "循环" : "一次"}</Badge>
        </div>
      </header>
      <div className="character-action-preview-timeline-strip" ref={stripRef}>
        {frames.map((frame) => (
          <AnimationFrameTile
            frame={frame}
            key={frame.id}
            onSelect={() => onSelectFrame(frame.index)}
            projectRoot={projectRoot}
            selected={frame.index === activeFrameIndex}
          />
        ))}
      </div>
    </section>
  );
}
