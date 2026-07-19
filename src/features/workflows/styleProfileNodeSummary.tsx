import { Box, Lock, Palette, Sun } from "lucide-react";

import {
  findStylePreset,
  getSharedStylePresets,
  useStylePresets,
} from "@/features/style-presets/useStylePresets";
import { buildStylePresetSummary } from "@/features/style-presets/buildStylePresetSummary";
import {
  hasLegacyInlineStyleParams,
  resolvePresetId,
  resolveStyleParamsForPreview,
} from "@/features/style-presets/types";

import type { WorkflowNode } from "./types";
import { getLightingTypeLabel, getRenderTypeLabel } from "./styleProfilePreview";
import { getStylePreset, getStylePresetThumbnail, toStylePresetDefinition } from "./stylePresets";

function readNumber(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function resolvePresetRecord(presetId: string) {
  const fromStore = findStylePreset(getSharedStylePresets(), presetId);
  if (fromStore) {
    return fromStore;
  }

  const builtin = getStylePreset(presetId);
  if (builtin) {
    return toStylePresetDefinition(builtin);
  }

  return undefined;
}

export function getStyleProfileNodeSummary(node: WorkflowNode): string {
  const presetId = resolvePresetId(node.params);
  const preset = resolvePresetRecord(presetId);
  const params = resolveStyleParamsForPreview(node.params, preset?.params);
  return buildStylePresetSummary(params);
}

export function StyleProfileNodeSummary({ node }: { node: WorkflowNode }) {
  const { presets } = useStylePresets();
  const presetId = resolvePresetId(node.params);
  const preset = findStylePreset(presets, presetId) ?? resolvePresetRecord(presetId);
  const params = resolveStyleParamsForPreview(node.params, preset?.params);
  const summaryLine = buildStylePresetSummary(params);
  const isLegacy = hasLegacyInlineStyleParams(node.params);
  const thumbnail = getStylePresetThumbnail(preset?.thumbnail ?? presetId);
  const consistency = readNumber(params, "consistencyStrength", 0.85);

  return (
    <div className="workflow-style-node-summary">
      <div className="workflow-style-node-summary-header">
        <strong>{preset?.label ?? presetId}</strong>
        <span className="workflow-style-node-summary-status" data-legacy={isLegacy ? "true" : "false"} />
      </div>
      <p className="workflow-style-node-summary-tagline">{summaryLine}</p>
      <div className="workflow-style-node-summary-preview">
        <img alt="" src={thumbnail} />
      </div>
      <dl className="workflow-style-node-summary-meta">
        <div>
          <dt>
            <Box aria-hidden="true" />
            渲染
          </dt>
          <dd>{getRenderTypeLabel(String(params.renderType ?? "pixel"))}</dd>
        </div>
        <div>
          <dt>
            <Palette aria-hidden="true" />
            色板
          </dt>
          <dd>{Math.round(readNumber(params, "maxColors", 16))} 色</dd>
        </div>
        <div>
          <dt>
            <Sun aria-hidden="true" />
            光照
          </dt>
          <dd>{getLightingTypeLabel(String(params.lightingType ?? "flat"))}</dd>
        </div>
        <div>
          <dt>
            <Lock aria-hidden="true" />
            一致性
          </dt>
          <dd>{Math.round(consistency * 100)}%</dd>
        </div>
      </dl>
    </div>
  );
}
