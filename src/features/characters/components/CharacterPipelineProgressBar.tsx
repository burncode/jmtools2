import type { PipelineSegmentState } from "@/features/characters/pipeline/stageDefinitions";

import "./CharacterPipelineProgressBar.css";

interface CharacterPipelineProgressBarProps {
  compact?: boolean;
  interactive?: boolean;
  onSegmentSelect?: (segmentId: PipelineSegmentState["id"]) => void;
  segments: PipelineSegmentState[];
  variant?: "default" | "full";
}

export function CharacterPipelineProgressBar({
  compact = false,
  interactive = true,
  onSegmentSelect,
  segments,
  variant = "default",
}: CharacterPipelineProgressBarProps) {
  const isStepper = variant === "full";
  const isInteractive = interactive && Boolean(onSegmentSelect);

  return (
    <div
      aria-label="角色产线进度"
      className={[
        "character-pipeline-progress",
        isStepper ? "character-pipeline-progress--full character-pipeline-progress--stepper" : "",
        compact && isStepper ? "character-pipeline-progress--compact" : "",
        isStepper && !isInteractive ? "character-pipeline-progress--readonly" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="list"
    >
      {segments.map((segment, index) => {
        const content = isStepper ? (
          <span className="character-pipeline-segment-body">
            {!compact ? <span className="character-pipeline-segment-index">{index + 1}</span> : null}
            <strong>{segment.label}</strong>
          </span>
        ) : (
          <>
            <span className="character-pipeline-segment-index">{index + 1}</span>
            <strong>{segment.label}</strong>
            {segment.message ? <small>{segment.message}</small> : null}
          </>
        );

        if (!isInteractive) {
          return (
            <div
              aria-label={segment.message ? `${segment.label}：${segment.message}` : segment.label}
              className="character-pipeline-segment"
              data-status={segment.status}
              key={segment.id}
              role="listitem"
              title={segment.message}
            >
              {content}
            </div>
          );
        }

        return (
          <button
            className="character-pipeline-segment"
            data-status={segment.status}
            key={segment.id}
            onClick={() => onSegmentSelect?.(segment.id)}
            role="listitem"
            title={segment.message}
            type="button"
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
