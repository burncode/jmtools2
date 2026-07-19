import type { AssetKind, PipelineAsset } from "./types";

export const assetKindLabels = {
  atlas: "图集",
  audio: "音频",
  image: "图片",
  sprite: "动画",
  tile: "瓦片",
} as const satisfies Record<AssetKind, string>;

export const starterAssets = [
  {
    createdAt: "2026-05-27T00:00:00.000Z",
    id: "asset-character-concept",
    kind: "image",
    metadata: {
      height: 1024,
      width: 1024,
    },
    name: "角色概念图",
    path: "assets/images/character_concept.png",
    source: "generated",
    status: "draft",
    tags: ["角色", "概念"],
    updatedAt: "2026-05-27T00:00:00.000Z",
  },
  {
    createdAt: "2026-05-27T00:00:00.000Z",
    id: "asset-hero-idle",
    kind: "sprite",
    metadata: {
      frames: 8,
      fps: 12,
    },
    name: "主角待机动画",
    path: "assets/sprites/hero_idle.png",
    source: "imported",
    status: "ready",
    tags: ["角色", "序列帧"],
    updatedAt: "2026-05-27T00:00:00.000Z",
  },
  {
    createdAt: "2026-05-27T00:00:00.000Z",
    id: "asset-grass-tiles",
    kind: "tile",
    metadata: {
      size: 32,
      variants: 16,
    },
    name: "草地瓦片组",
    path: "assets/tiles/grass_tiles.png",
    source: "generated",
    status: "draft",
    tags: ["地图", "地形"],
    updatedAt: "2026-05-27T00:00:00.000Z",
  },
] as const satisfies PipelineAsset[];
