import { useState } from "react";

import { AppToolbarRow, SegmentedControl } from "@/components/shared";
import { Button } from "@/components/ui/button";

import type { CharacterActionFrame, CharacterActionId, CharacterAssetRecord } from "../../types";
import type { ActionCardDraft } from "../CharacterActionCard";
import type { CharacterActionCardItem } from "../CharacterActionCard";
import { CharacterAnimationTimeline } from "./CharacterAnimationTimeline";
import {
  CharacterPreviewDisplayOptions,
  defaultPreviewDisplaySettings,
  type PreviewDisplaySettings,
} from "./CharacterPreviewDisplayOptions";
import { CharacterPreviewTransport } from "./CharacterPreviewTransport";
import { CharacterPreviewViewport } from "./CharacterPreviewViewport";

type PreviewSurfaceMode = "animation" | "spritesheet";
type AssetPreviewMode = "auto" | "original" | "transparent";

interface CharacterActionPreviewPanelProps {
  activeAction: CharacterActionCardItem;
  activeFrameIndex: number;
  actionId: CharacterActionId;
  activeDirection: string;
  activeViewKind: string;
  assetPreviewMode: AssetPreviewMode;
  draft: ActionCardDraft;
  isPlaying: boolean;
  onAssetPreviewModeChange: (mode: AssetPreviewMode) => void;
  onFrameChange: (index: number) => void;
  onPlaybackComplete: () => void;
  onPlayToggle: () => void;
  previewFrames: CharacterActionFrame[];
  previewSurfaceMode: PreviewSurfaceMode;
  projectRoot: string;
  record: CharacterAssetRecord;
  setPreviewSurfaceMode: (mode: PreviewSurfaceMode) => void;
  viewKindLabel: string;
}

export function CharacterActionPreviewPanel({
  activeAction,
  activeFrameIndex,
  actionId,
  activeDirection,
  activeViewKind,
  assetPreviewMode,
  draft,
  isPlaying,
  onAssetPreviewModeChange,
  onFrameChange,
  onPlaybackComplete,
  onPlayToggle,
  previewFrames,
  previewSurfaceMode,
  projectRoot,
  record,
  setPreviewSurfaceMode,
  viewKindLabel,
}: CharacterActionPreviewPanelProps) {
  const [zoom, setZoom] = useState<100 | 200>(100);
  const [display, setDisplay] = useState<PreviewDisplaySettings>(defaultPreviewDisplaySettings);
  const totalFrames = Math.max(1, previewFrames.length);
  const maxIndex = totalFrames - 1;

  function seekFrame(index: number) {
    onFrameChange(Math.max(0, Math.min(maxIndex, index)));
  }

  return (
    <section aria-label="动作预览" className="character-action-preview-panel app-canvas-panel">
      <header className="character-action-preview-panel-header">
        <AppToolbarRow
          end={
            previewSurfaceMode === "animation" ? (
              <>
                <Button
                  onClick={() => setZoom((current) => (current === 100 ? 200 : 100))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {zoom}%
                </Button>
                <CharacterPreviewDisplayOptions
                  assetPreviewMode={assetPreviewMode}
                  onAssetPreviewModeChange={onAssetPreviewModeChange}
                  onChange={(patch) => setDisplay((current) => ({ ...current, ...patch }))}
                  value={display}
                />
              </>
            ) : null
          }
          start={
            <SegmentedControl
              ariaLabel="预览表面"
              className="app-segmented-control--compact character-action-preview-surface-segment"
              onValueChange={(value) => setPreviewSurfaceMode(value as PreviewSurfaceMode)}
              options={[
                { label: "动画", value: "animation" },
                { label: "精灵图", value: "spritesheet" },
              ]}
              value={previewSurfaceMode}
            />
          }
        />
      </header>
      {previewSurfaceMode === "spritesheet" ? (
        <div className="character-action-preview-spritesheet-placeholder">
          精灵图预览将在导出后可用；请使用顶栏「导出」生成 sprite-sheet。
        </div>
      ) : (
        <>
          <CharacterPreviewViewport
            actionId={actionId}
            actionLabel={activeAction.label}
            assetMode={assetPreviewMode}
            canvasSizeLabel={record.size}
            direction={activeDirection}
            display={display}
            fps={draft.previewFps}
            frameIndex={activeFrameIndex}
            isPlaying={isPlaying}
            loopMode={draft.loopMode}
            onFrameChange={onFrameChange}
            onPlaybackComplete={onPlaybackComplete}
            projectRoot={projectRoot}
            record={record}
            totalFrames={totalFrames}
            viewKind={activeViewKind}
            viewKindLabel={viewKindLabel}
            zoom={zoom}
          />
          <CharacterPreviewTransport
            activeFrameIndex={activeFrameIndex}
            isPlaying={isPlaying}
            onFirstFrame={() => seekFrame(0)}
            onLastFrame={() => seekFrame(maxIndex)}
            onNextFrame={() => seekFrame(activeFrameIndex + 1)}
            onPlayToggle={onPlayToggle}
            onPrevFrame={() => seekFrame(activeFrameIndex - 1)}
            onSeek={seekFrame}
            totalFrames={totalFrames}
          />
          <CharacterAnimationTimeline
            actionLabel={activeAction.label}
            activeFrameIndex={activeFrameIndex}
            fps={draft.previewFps}
            frames={previewFrames}
            loopMode={draft.loopMode}
            onSelectFrame={seekFrame}
            projectRoot={projectRoot}
          />
        </>
      )}
    </section>
  );
}

export type { AssetPreviewMode, PreviewSurfaceMode };
