import { useMemo } from "react";

import type { CharacterAssetRecord } from "@/features/characters/types";

import { derivePipelineSegments, getPipelineProgress, type PipelineSegmentId } from "./stageDefinitions";

export function useCharacterPipeline(record?: CharacterAssetRecord) {
  const segments = useMemo(() => derivePipelineSegments(record), [record]);
  const progress = useMemo(() => getPipelineProgress(record), [record]);

  function getSegment(id: PipelineSegmentId) {
    return segments.find((segment) => segment.id === id);
  }

  return {
    getSegment,
    progress,
    segments,
  };
}
