import type { CharacterAssetRecord } from "@/features/characters/types";

export type PipelineSegmentStatus = "complete" | "failed" | "idle" | "running" | "warning";

export type PipelineSegmentId = "concept" | "create" | "process" | "animate" | "export";

export interface PipelineSegmentDefinition {
  id: PipelineSegmentId;
  label: string;
  nodeKinds: string[];
  targetCreatePhase?: "review" | "setup";
  targetMode: "create" | "production";
  targetProductionTab?: "actions";
}

export const pipelineStageDefinitions: PipelineSegmentDefinition[] = [
  {
    id: "concept",
    label: "概念",
    nodeKinds: ["inputSeed", "styleProfile", "outfitProfile"],
    targetCreatePhase: "setup",
    targetMode: "create",
  },
  {
    id: "create",
    label: "入库",
    nodeKinds: ["promptCompiler", "generatePlan", "generateCandidates", "manualGate", "character.create"],
    targetCreatePhase: "review",
    targetMode: "create",
  },
  {
    id: "process",
    label: "后处理",
    nodeKinds: ["generateViews", "removeBackground", "normalize", "analyze"],
    targetMode: "production",
    targetProductionTab: "actions",
  },
  {
    id: "animate",
    label: "动作",
    nodeKinds: ["generateActionFrames"],
    targetMode: "production",
    targetProductionTab: "actions",
  },
  {
    id: "export",
    label: "导出",
    nodeKinds: ["atlasPack", "animationExport", "godotSpriteFrames"],
    targetMode: "production",
    targetProductionTab: "actions",
  },
];

export interface PipelineSegmentState {
  id: PipelineSegmentId;
  label: string;
  message?: string;
  status: PipelineSegmentStatus;
}

function hasGeneratedViews(record: CharacterAssetRecord) {
  return (record.views ?? []).some((view) => view.rawImage || view.transparentImage || view.normalizedImage);
}

function hasProcessing(record: CharacterAssetRecord) {
  return Boolean(record.processing?.backgroundRemoved || record.processing?.normalized);
}

function hasGeneratedActions(record: CharacterAssetRecord) {
  return (record.actions ?? []).some((action) => (action.frames?.length ?? 0) > 0 && action.status === "generated");
}

function hasExports(record: CharacterAssetRecord) {
  return (record.exportProfiles?.length ?? 0) > 0;
}

function hasQcWarnings(record: CharacterAssetRecord) {
  return (record.actions ?? []).some(
    (action) => (action.qualityWarnings?.length ?? 0) > 0 || (action.qualityErrors?.length ?? 0) > 0,
  );
}

export function derivePipelineSegments(record?: CharacterAssetRecord): PipelineSegmentState[] {
  if (!record) {
    return pipelineStageDefinitions.map((stage) => ({
      id: stage.id,
      label: stage.label,
      status: stage.id === "concept" ? "idle" : "idle",
    }));
  }

  const created = Boolean(record.id && record.masterImage);
  const viewsReady = hasGeneratedViews(record);
  const processed = hasProcessing(record);
  const animated = hasGeneratedActions(record);
  const exported = hasExports(record);
  const warnings = hasQcWarnings(record);

  return [
    {
      id: "concept",
      label: "概念",
      status: created ? "complete" : "idle",
    },
    {
      id: "create",
      label: "入库",
      status: created ? "complete" : "idle",
    },
    {
      id: "process",
      label: "后处理",
      message: warnings ? "存在 QC 警告" : undefined,
      status: processed || viewsReady ? (warnings ? "warning" : "complete") : created ? "idle" : "idle",
    },
    {
      id: "animate",
      label: "动作",
      status: animated ? (warnings ? "warning" : "complete") : processed || viewsReady ? "idle" : "idle",
    },
    {
      id: "export",
      label: "导出",
      status: exported ? "complete" : animated ? "idle" : "idle",
    },
  ];
}

export function getPipelineProgress(record?: CharacterAssetRecord) {
  const segments = derivePipelineSegments(record);
  const completed = segments.filter((segment) => segment.status === "complete" || segment.status === "warning").length;
  return Math.round((completed / segments.length) * 100);
}
