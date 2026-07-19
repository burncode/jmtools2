import { Box, Layers, Lock, Palette, Sun } from "lucide-react";

import {
  getLightingTypeLabel,
  getMaterialStyleLabel,
  getRenderTypeLabel,
  getShadingStyleLabel,
} from "../workflows/styleChoiceCatalog";

interface VisualDnaSummaryProps {
  params: Record<string, unknown>;
}

function readNumber(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function VisualDnaSummary({ params }: VisualDnaSummaryProps) {
  const consistency = readNumber(params, "consistencyStrength", 0.85);

  return (
    <div className="style-preset-dna-summary">
      <div className="style-preset-dna-chip">
        <Box aria-hidden="true" />
        <span className="style-preset-dna-label">渲染</span>
        <strong>{getRenderTypeLabel(String(params.renderType ?? "pixel"))}</strong>
      </div>
      <div className="style-preset-dna-chip">
        <Layers aria-hidden="true" />
        <span className="style-preset-dna-label">材质</span>
        <strong>{getMaterialStyleLabel(String(params.materialStyle ?? "flat"))}</strong>
      </div>
      <div className="style-preset-dna-chip">
        <Palette aria-hidden="true" />
        <span className="style-preset-dna-label">色板</span>
        <strong>{Math.round(readNumber(params, "maxColors", 16))} 色</strong>
      </div>
      <div className="style-preset-dna-chip">
        <Sun aria-hidden="true" />
        <span className="style-preset-dna-label">光照</span>
        <strong>{getLightingTypeLabel(String(params.lightingType ?? "flat"))}</strong>
      </div>
      <div className="style-preset-dna-chip">
        <Layers aria-hidden="true" />
        <span className="style-preset-dna-label">明暗</span>
        <strong>{getShadingStyleLabel(String(params.shadingStyle ?? "hard_cel"))}</strong>
      </div>
      <div className="style-preset-dna-chip">
        <Lock aria-hidden="true" />
        <span className="style-preset-dna-label">一致性</span>
        <strong>{Math.round(consistency * 100)}%</strong>
      </div>
    </div>
  );
}
