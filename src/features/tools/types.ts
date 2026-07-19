import type { LucideIcon } from "lucide-react";

import type { AppSettings } from "@/lib/tauri/commands";
import type { BoundingBox } from "@/features/characters/types";

export type ProductionToolCategory = "asset-cleanup" | "asset-transform" | "asset-slicing" | "preview";

export type ProductionToolStatus = "planned" | "designing" | "available";

export type ProductionToolInputKind =
  | "character-candidate"
  | "image"
  | "sprite-sheet"
  | "transparent-image";

export type ProductionToolOutputKind =
  | "character-view-set"
  | "clean-image"
  | "sliced-assets"
  | "style-variant"
  | "transparent-image";

export interface ProductionToolDefinition {
  category: ProductionToolCategory;
  description: string;
  icon: LucideIcon;
  id: string;
  inputKinds: ProductionToolInputKind[];
  label: string;
  outputKinds: ProductionToolOutputKind[];
  route: "asset-tools";
  supportsBatch: boolean;
  supportsStandalone: boolean;
  status: ProductionToolStatus;
}

export type AssetToolId = "background-removal";

export interface AssetToolSource {
  kind: "absolutePath" | "projectRelativePath";
  path: string;
}

export interface BackgroundRemovalToolOptions {
  alphaMatting: boolean;
  cleanupStrength: "off" | "soft" | "standard" | "strict";
  edgeOffset: number;
  edgeSoftness: number;
  engine: "chroma" | "rembg";
  executablePath: string;
  holeFillMaxPixels: number;
  manualBackgroundSamples: string[];
  modelPath: string;
  preserveSmallParts: boolean;
  rembgModel: AppSettings["backgroundRemovalModel"];
  spillSuppression: number;
  tolerance: number;
}

export interface RunAssetToolInput {
  backgroundRemoval?: BackgroundRemovalToolOptions;
  projectRoot: string;
  source: AssetToolSource;
  toolId: AssetToolId;
}

export interface LoadAssetToolSourcePreviewInput {
  projectRoot: string;
  source: AssetToolSource;
}

export interface AssetToolSourcePreview {
  dataUrl: string;
  height: number;
  sourcePath: string;
  width: number;
}

export interface AssetToolImage {
  absolutePath: string;
  dataUrl: string;
  height: number;
  projectRelativePath: string;
  width: number;
}

export interface AssetToolResult {
  bbox?: BoundingBox;
  createdAt: string;
  id: string;
  optionsSnapshot: Record<string, unknown>;
  outputImage: AssetToolImage;
  score?: number;
  sourcePath: string;
  toolId: AssetToolId;
  warnings: string[];
}
