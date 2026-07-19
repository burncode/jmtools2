import { lazy, Suspense } from "react";

import type { CharacterActionId, CharacterAssetRecord } from "../../types";
import type { PreviewDisplaySettings } from "./CharacterPreviewDisplayOptions";

const CharacterPixiPreviewStage = lazy(() =>
  import("../CharacterPixiPreviewStage").then((module) => ({
    default: module.CharacterPixiPreviewStage,
  })),
);

interface CharacterPreviewViewportProps {
  actionId: CharacterActionId;
  actionLabel: string;
  assetMode: "auto" | "original" | "transparent";
  canvasSizeLabel: string;
  direction: string;
  display: PreviewDisplaySettings;
  fps: number;
  frameIndex: number;
  isPlaying: boolean;
  loopMode: "loop" | "once";
  onFrameChange: (frameIndex: number) => void;
  onPlaybackComplete: () => void;
  projectRoot: string;
  record: CharacterAssetRecord;
  totalFrames: number;
  viewKind: string;
  viewKindLabel: string;
  zoom: 100 | 200;
}

export function CharacterPreviewViewport({
  actionId,
  actionLabel,
  assetMode,
  canvasSizeLabel,
  direction,
  display,
  fps,
  frameIndex,
  isPlaying,
  loopMode,
  onFrameChange,
  onPlaybackComplete,
  projectRoot,
  record,
  totalFrames,
  viewKind,
  viewKindLabel,
  zoom,
}: CharacterPreviewViewportProps) {
  return (
    <div className="character-action-preview-viewport">
      <div className="character-action-preview-viewport-stage" data-zoom={zoom}>
        <span className="character-action-preview-viewport-overlay-badge">当前动作：{actionLabel}</span>
        <Suspense fallback={<div className="character-pixi-loading">正在加载 PixiJS 预览...</div>}>
          <CharacterPixiPreviewStage
            actionId={actionId}
            assetMode={assetMode}
            direction={direction}
            fps={fps}
            frameIndex={frameIndex}
            isPlaying={isPlaying}
            loopMode={loopMode}
            onionSkinEnabled={display.onionSkin}
            onFrameChange={onFrameChange}
            onPlaybackComplete={onPlaybackComplete}
            projectRoot={projectRoot}
            record={record}
            totalFrames={totalFrames}
            viewKind={viewKind}
          />
        </Suspense>
      </div>
      <footer className="character-action-preview-viewport-footer">
        {canvasSizeLabel} / {viewKindLabel} / {fps} FPS
      </footer>
    </div>
  );
}
