import type { WorkflowDefinition, WorkflowNodeKind, WorkflowRun } from "./types";

export interface WorkflowPreviewImage {
  absolutePath?: string;
  assetId?: string;
  dataUrl?: string;
  id?: string;
  label?: string;
  planId?: string;
  projectRelativePath?: string;
}

export function resolveCandidatePlanId(image: WorkflowPreviewImage, index: number): string {
  return image.planId?.trim() || image.label?.trim() || `plan-${index + 1}`;
}

export interface WorkflowPreviewAssets {
  atlasSummary?: string;
  images: WorkflowPreviewImage[];
  kind: "empty" | "multi" | "single" | "spritesheet";
}

export interface WorkflowMasterPlanPreview {
  candidatePlans: Array<{ focus?: string; id: string; name: string; recommendationScore?: number }>;
  pixelPrompt: string;
  summary: string;
}

function readImagePath(value: unknown): WorkflowPreviewImage | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const absolutePath = typeof record.absolutePath === "string" ? record.absolutePath : undefined;
  const dataUrl = typeof record.dataUrl === "string" && record.dataUrl.trim() ? record.dataUrl.trim() : undefined;
  const projectRelativePath =
    typeof record.projectRelativePath === "string"
      ? record.projectRelativePath
      : typeof record.path === "string"
        ? record.path
        : undefined;

  if (!absolutePath && !projectRelativePath && !dataUrl) {
    return undefined;
  }

  return {
    absolutePath,
    dataUrl,
    id: typeof record.id === "string" ? record.id : undefined,
    projectRelativePath,
  };
}

function readCharacterImageAsset(value: unknown, label?: string): WorkflowPreviewImage | undefined {
  const image = readImagePath(value);
  if (!image) {
    return undefined;
  }

  return {
    ...image,
    label: label ?? image.label,
  };
}

function compactImages(images: Array<WorkflowPreviewImage | undefined>): WorkflowPreviewImage[] {
  return images.filter((item): item is WorkflowPreviewImage => Boolean(item));
}

const VIEW_KIND_LABELS: Record<string, string> = {
  back: "后",
  backLeft: "左后",
  backRight: "右后",
  front: "前",
  frontLeft: "左前",
  frontRight: "右前",
  left: "左",
  right: "右",
  single: "正面",
};

function resolveViewKindLabel(kind: unknown, fallback: string) {
  if (typeof kind !== "string" || !kind.trim()) {
    return fallback;
  }

  return VIEW_KIND_LABELS[kind] ?? kind;
}

function resolveCharacterPreviewImages(
  character: Record<string, unknown>,
  nodeKind?: WorkflowNodeKind,
): WorkflowPreviewImage[] {
  const views = Array.isArray(character.views)
    ? character.views.filter((view): view is Record<string, unknown> => Boolean(view) && typeof view === "object")
    : [];
  const primaryView = views[0];

  const pickViewImage = (field: "normalizedImage" | "transparentImage" | "rawImage", label?: string) => {
    for (const view of views) {
      const image = readCharacterImageAsset(view[field], label ?? (typeof view.kind === "string" ? view.kind : undefined));
      if (image) {
        return image;
      }
    }
    return undefined;
  };

  if (nodeKind === "character.create") {
    return compactImages([
      readCharacterImageAsset(character.masterImage, "母版图"),
      primaryView ? readCharacterImageAsset(primaryView.rawImage, "原始视图") : undefined,
    ]);
  }

  if (nodeKind === "character.removeBackground") {
    return compactImages([
      pickViewImage("rawImage", "原图"),
      pickViewImage("transparentImage", "去背景后"),
      readCharacterImageAsset(character.masterImage, "母版图"),
    ]);
  }

  if (nodeKind === "character.normalize") {
    return compactImages([
      pickViewImage("normalizedImage", "规范化后"),
      pickViewImage("transparentImage", "去背景后"),
      pickViewImage("rawImage", "原图"),
    ]);
  }

  if (nodeKind === "character.analyze") {
    return compactImages([
      pickViewImage("normalizedImage", "预检图"),
      pickViewImage("transparentImage", "去背景后"),
    ]);
  }

  if (nodeKind === "character.generateViews") {
    const images: WorkflowPreviewImage[] = [];
    views.forEach((view, index) => {
      const label = resolveViewKindLabel(view.kind, `视图 ${index + 1}`);
      const image =
        readCharacterImageAsset(view.normalizedImage, label) ??
        readCharacterImageAsset(view.transparentImage, label) ??
        readCharacterImageAsset(view.rawImage, label);
      if (image) {
        images.push(image);
      }
    });
    return images;
  }

  return compactImages([pickViewImage("normalizedImage"), pickViewImage("transparentImage")]);
}

function readAssetEnvelope(outputs: Record<string, unknown>): Record<string, unknown> | undefined {
  const asset = outputs.asset;
  if (!asset || typeof asset !== "object") {
    return undefined;
  }

  return asset as Record<string, unknown>;
}

export interface WorkflowPromptPreview {
  astSummary?: string;
  negativePrompt: string;
  prompt: string;
}

export function resolveMasterPlanPreview(outputs: Record<string, unknown> | undefined): WorkflowMasterPlanPreview | undefined {
  if (!outputs) {
    return undefined;
  }

  const assetEnvelope = readAssetEnvelope(outputs);
  if (assetEnvelope?.kind !== "masterPlan") {
    return undefined;
  }

  const data = assetEnvelope.data;
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const record = data as Record<string, unknown>;
  const summary = typeof record.summary === "string" ? record.summary : "";
  const pixelPrompt = typeof record.pixelPrompt === "string" ? record.pixelPrompt : "";
  const candidatePlansRaw = Array.isArray(record.candidatePlans) ? record.candidatePlans : [];
  const candidatePlans = candidatePlansRaw
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return undefined;
      }
      const plan = item as Record<string, unknown>;
      const id = typeof plan.id === "string" ? plan.id : `plan-${index + 1}`;
      const name = typeof plan.name === "string" ? plan.name : id;
      return {
        focus: typeof plan.focus === "string" ? plan.focus : undefined,
        id,
        name,
        recommendationScore: typeof plan.recommendationScore === "number" ? plan.recommendationScore : undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!summary && !pixelPrompt && candidatePlans.length === 0) {
    return undefined;
  }

  return { candidatePlans, pixelPrompt, summary };
}

export function resolvePromptPreview(outputs: Record<string, unknown> | undefined): WorkflowPromptPreview | undefined {
  if (!outputs) {
    return undefined;
  }

  const assetEnvelope = readAssetEnvelope(outputs);
  if (assetEnvelope?.kind !== "promptBundle") {
    return undefined;
  }

  const data = assetEnvelope.data;
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const record = data as Record<string, unknown>;
  const prompt = typeof record.prompt === "string" ? record.prompt : "";
  const negativePrompt = typeof record.negativePrompt === "string" ? record.negativePrompt : "";
  const ast = Array.isArray(record.ast) ? record.ast : [];
  const astSummary = ast
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }
      const node = item as Record<string, unknown>;
      const slot = typeof node.slot === "string" ? node.slot : "?";
      const value = typeof node.value === "string" ? node.value : "";
      const weight = typeof node.weight === "number" ? node.weight : 1;
      return `[${slot}] ${value} (w=${weight})`;
    })
    .filter(Boolean)
    .join("\n");

  if (!prompt && !negativePrompt) {
    return undefined;
  }

  return {
    astSummary: astSummary || undefined,
    negativePrompt,
    prompt,
  };
}

function buildPreviewResult(images: WorkflowPreviewImage[]): WorkflowPreviewAssets {
  if (images.length === 0) {
    return { images: [], kind: "empty" };
  }

  return {
    images,
    kind: images.length > 1 ? "multi" : "single",
  };
}

export function resolveNodePreviewAssets(
  outputs: Record<string, unknown> | undefined,
  nodeKind?: WorkflowNodeKind,
): WorkflowPreviewAssets {
  if (!outputs) {
    return { images: [], kind: "empty" };
  }

  const character = outputs.character;
  if (character && typeof character === "object") {
    const characterImages = resolveCharacterPreviewImages(character as Record<string, unknown>, nodeKind);
    if (characterImages.length > 0) {
      return buildPreviewResult(characterImages);
    }
  }

  const assetEnvelope = readAssetEnvelope(outputs);
  const assetKind = typeof assetEnvelope?.kind === "string" ? assetEnvelope.kind : undefined;
  const assetData = assetEnvelope?.data;

  if (assetKind === "candidateImages" && assetData && typeof assetData === "object") {
    const items = (assetData as Record<string, unknown>).items;
    if (Array.isArray(items)) {
      const images: WorkflowPreviewImage[] = [];

      items.forEach((item, index) => {
        if (!item || typeof item !== "object") {
          return;
        }

        const record = item as Record<string, unknown>;
        const image = readImagePath(record.image);
        if (!image) {
          return;
        }

        const planId = typeof record.planId === "string" ? record.planId.trim() : `候选 ${index + 1}`;
        images.push({
          ...image,
          assetId: image.id,
          id: planId,
          label: planId,
          planId,
        });
      });

      if (images.length > 0) {
        return buildPreviewResult(images);
      }
    }
  }

  if (assetKind === "spritesheet" || (outputs.asset && typeof outputs.asset === "object" && (outputs.asset as Record<string, unknown>).kind === "spritesheet")) {
    const spritesheetAsset = (assetEnvelope ?? outputs.asset) as Record<string, unknown>;
    const image = readImagePath(outputs.image) ?? readImagePath(spritesheetAsset);
    const width = typeof (outputs.image as Record<string, unknown> | undefined)?.width === "number" ? (outputs.image as Record<string, number>).width : undefined;
    const height = typeof (outputs.image as Record<string, unknown> | undefined)?.height === "number" ? (outputs.image as Record<string, number>).height : undefined;
    const summary = width && height ? `Atlas ${width}×${height}` : "Atlas 预览";

    if (image) {
      return {
        atlasSummary: summary,
        images: [image],
        kind: "spritesheet",
      };
    }
  }

  const directImage = readImagePath(outputs.image);
  if (directImage) {
    return buildPreviewResult([directImage]);
  }

  const toolImage = readImagePath((outputs.toolResult as Record<string, unknown> | undefined)?.outputImage);
  if (toolImage) {
    return buildPreviewResult([toolImage]);
  }

  return { images: [], kind: "empty" };
}

const IMAGE_PREVIEW_NODE_KINDS = new Set<WorkflowNodeKind>([
  "character.create",
  "character.generateCandidates",
  "character.generateViews",
  "character.normalize",
  "character.removeBackground",
  "ai.imageGenerate",
  "preview.image",
  "tool.backgroundRemoval",
  "output.atlasPack",
  "output.spriteSplit",
  "output.spritesheet",
  "image.input",
]);

export function isImagePreviewCapableKind(kind: WorkflowNodeKind): boolean {
  return IMAGE_PREVIEW_NODE_KINDS.has(kind);
}

export function resolveUpstreamCandidateAssets(
  definition: WorkflowDefinition,
  nodeId: string,
  selectedRun?: WorkflowRun,
): WorkflowPreviewAssets {
  const edge = definition.edges.find(
    (item) => item.toNodeId === nodeId && item.toPort === "candidateImages",
  );
  if (!edge || !selectedRun) {
    return { images: [], kind: "empty" };
  }

  const upstreamRun = selectedRun.nodeRuns.find((nodeRun) => nodeRun.nodeId === edge.fromNodeId);
  return resolveNodePreviewAssets(
    upstreamRun?.outputs as Record<string, unknown> | undefined,
    upstreamRun?.nodeKind,
  );
}

export function resolveUpstreamCandidateTaskId(
  definition: WorkflowDefinition,
  nodeId: string,
  selectedRun?: WorkflowRun,
): string | undefined {
  const edge = definition.edges.find(
    (item) => item.toNodeId === nodeId && item.toPort === "candidateImages",
  );
  if (!edge || !selectedRun) {
    return undefined;
  }

  const upstreamRun = selectedRun.nodeRuns.find((nodeRun) => nodeRun.nodeId === edge.fromNodeId);
  const outputs = upstreamRun?.outputs as Record<string, unknown> | undefined;
  if (!outputs) {
    return undefined;
  }

  const assetEnvelope = readAssetEnvelope(outputs);
  const data = assetEnvelope?.data;
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const taskId = (data as Record<string, unknown>).taskId;
  return typeof taskId === "string" && taskId.trim() ? taskId.trim() : undefined;
}
