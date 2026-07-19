export type AssetKind = "image" | "sprite" | "tile" | "atlas" | "audio";

export type AssetSource = "imported" | "generated" | "packed" | "converted";

export interface PipelineAsset {
  id: string;
  kind: AssetKind;
  name: string;
  path: string;
  source: AssetSource;
  status: "ready" | "draft" | "queued" | "failed";
  tags: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string | number | boolean>;
}
