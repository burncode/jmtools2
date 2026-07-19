import { Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface CharacterPreviewTransportProps {
  activeFrameIndex: number;
  isPlaying: boolean;
  onFirstFrame: () => void;
  onLastFrame: () => void;
  onNextFrame: () => void;
  onPlayToggle: () => void;
  onPrevFrame: () => void;
  onSeek: (frameIndex: number) => void;
  totalFrames: number;
}

export function CharacterPreviewTransport({
  activeFrameIndex,
  isPlaying,
  onFirstFrame,
  onLastFrame,
  onNextFrame,
  onPlayToggle,
  onPrevFrame,
  onSeek,
  totalFrames,
}: CharacterPreviewTransportProps) {
  const maxIndex = Math.max(0, totalFrames - 1);

  return (
    <div aria-label="播放控制" className="character-action-preview-transport" role="group">
      <div className="character-action-preview-transport-buttons">
        <Button aria-label="首帧" onClick={onFirstFrame} size="sm" type="button" variant="ghost">
          <SkipBack aria-hidden="true" size={14} />
        </Button>
        <Button aria-label="上一帧" onClick={onPrevFrame} size="sm" type="button" variant="ghost">
          <StepBack aria-hidden="true" size={14} />
        </Button>
        <Button aria-label={isPlaying ? "暂停" : "播放"} onClick={onPlayToggle} size="sm" type="button" variant="outline">
          {isPlaying ? <Pause aria-hidden="true" size={14} /> : <Play aria-hidden="true" size={14} />}
        </Button>
        <Button aria-label="下一帧" onClick={onNextFrame} size="sm" type="button" variant="ghost">
          <StepForward aria-hidden="true" size={14} />
        </Button>
        <Button aria-label="末帧" onClick={onLastFrame} size="sm" type="button" variant="ghost">
          <SkipForward aria-hidden="true" size={14} />
        </Button>
      </div>
      <span className="character-action-preview-transport-counter">
        {activeFrameIndex + 1} / {totalFrames}
      </span>
      <Slider
        aria-label="帧进度"
        className="app-slider-control character-action-preview-transport-slider"
        max={maxIndex}
        min={0}
        onValueChange={(values) => onSeek(values[0] ?? 0)}
        step={1}
        value={[activeFrameIndex]}
      />
    </div>
  );
}
