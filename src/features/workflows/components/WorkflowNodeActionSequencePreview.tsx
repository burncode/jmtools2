import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import type { ActionSequencePreviewAssets } from "../workflowActionSequencePreview";
import { resolvePreviewImageSrc } from "../workflowPreviewPath";

interface WorkflowNodeActionSequencePreviewProps {
  assets: ActionSequencePreviewAssets;
  className?: string;
  projectRoot: string;
}

export function WorkflowNodeActionSequencePreview({
  assets,
  className,
  projectRoot,
}: WorkflowNodeActionSequencePreviewProps) {
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);

  const safeTrackIndex = Math.min(activeTrackIndex, Math.max(assets.tracks.length - 1, 0));
  const activeTrack = assets.tracks[safeTrackIndex];
  const safeFrameIndex = Math.min(activeFrameIndex, Math.max((activeTrack?.frames.length ?? 1) - 1, 0));
  const activeFrame = activeTrack?.frames[safeFrameIndex];
  const activeSrc = useMemo(
    () => resolvePreviewImageSrc(projectRoot, activeFrame),
    [activeFrame, projectRoot],
  );

  if (assets.kind !== "sequence" || !activeTrack || !activeFrame || !activeSrc) {
    return null;
  }

  const showTrackSegments = assets.tracks.length > 1;

  return (
    <div className={cn("workflow-node-inline-preview", className)}>
      {showTrackSegments ? (
        <div className="workflow-node-inline-preview-segments">
          {assets.tracks.map((track, index) => (
            <button
              className="workflow-node-inline-preview-segment"
              data-active={index === safeTrackIndex ? "true" : "false"}
              key={track.id}
              onClick={() => {
                setActiveTrackIndex(index);
                setActiveFrameIndex(0);
              }}
              type="button"
            >
              {track.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="workflow-node-inline-preview-label">{activeTrack.label}</p>
      )}
      <div className="workflow-node-inline-preview-main is-transparent">
        <img alt={activeFrame.label ?? "动作帧预览"} className="workflow-node-inline-preview-image" src={activeSrc} />
      </div>
      {activeTrack.frames.length > 1 ? (
        <div className="workflow-node-inline-preview-thumbs">
          {activeTrack.frames.map((frame, index) => {
            const src = resolvePreviewImageSrc(projectRoot, frame);
            if (!src) {
              return null;
            }

            return (
              <button
                aria-label={frame.label ?? `帧 ${index + 1}`}
                className="workflow-node-inline-preview-thumb"
                data-active={index === safeFrameIndex ? "true" : "false"}
                key={frame.id ?? `${frame.projectRelativePath ?? frame.absolutePath}-${index}`}
                onClick={() => setActiveFrameIndex(index)}
                title={frame.label ?? undefined}
                type="button"
              >
                <img alt="" src={src} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
