import type { Graphics } from "pixi.js";

import type { BoundingBox, CharacterAssetRecord } from "@/features/characters/types";

export type PreviewLayerId = "bbox" | "checker" | "footLine" | "normalized" | "original" | "transparent";

export interface PreviewLayerState {
  bbox?: BoundingBox;
  footLineY?: number;
  id: PreviewLayerId;
  imageUrl?: string;
  visible: boolean;
}

export function resolvePreviewLayers(
  record: CharacterAssetRecord,
  viewKind: string,
  visibleLayers: PreviewLayerId[],
): PreviewLayerState[] {
  const view = (record.views ?? []).find((item) => item.kind === viewKind) ?? record.views?.[0];
  const processing = record.processing;

  const layers: PreviewLayerState[] = [
    { id: "checker", visible: visibleLayers.includes("checker") },
    {
      id: "original",
      imageUrl: view?.rawImage?.dataUrl || record.masterImage?.dataUrl,
      visible: visibleLayers.includes("original"),
    },
    {
      id: "transparent",
      imageUrl: view?.transparentImage?.dataUrl,
      visible: visibleLayers.includes("transparent"),
    },
    {
      id: "normalized",
      imageUrl: view?.normalizedImage?.dataUrl,
      visible: visibleLayers.includes("normalized"),
    },
    {
      bbox: view?.bbox ?? processing?.bbox,
      footLineY: processing?.footLineY,
      id: "bbox",
      visible: visibleLayers.includes("bbox"),
    },
    {
      footLineY: processing?.footLineY,
      id: "footLine",
      visible: visibleLayers.includes("footLine"),
    },
  ];

  return layers;
}

export function drawBBoxOverlay(graphics: Graphics, bbox: BoundingBox, canvasWidth: number, canvasHeight: number) {
  graphics.clear();
  graphics.rect(bbox.x, bbox.y, bbox.width, bbox.height);
  graphics.stroke({ color: 0x5b6ff5, width: 1 });
  graphics.moveTo(0, canvasHeight - 1);
  graphics.lineTo(canvasWidth, canvasHeight - 1);
  graphics.stroke({ color: 0x22c55e, width: 1 });
}

export function drawFootLineOverlay(graphics: Graphics, footLineY: number, canvasWidth: number) {
  graphics.clear();
  graphics.moveTo(0, footLineY);
  graphics.lineTo(canvasWidth, footLineY);
  graphics.stroke({ color: 0xf59e0b, width: 1 });
}
