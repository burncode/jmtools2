import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo } from "react";

import { AppSlider, PanelSection } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

import { StylePresetGallery } from "../components/StylePresetGallery";
import { getStylePresetThumbnail } from "../stylePresets";
import type { WorkflowDefinition, WorkflowNode } from "../types";

import { buildStylePresetSummary } from "@/features/style-presets/buildStylePresetSummary";
import { openStylePresetLibrary } from "@/features/style-presets/stylePresetLibraryWindow";
import {
  findStylePreset,
  getFeaturedPresets,
  useStylePresets,
} from "@/features/style-presets/useStylePresets";
import {
  hasLegacyInlineStyleParams,
  resolvePresetId,
  resolveStyleParamsForPreview,
  stripInlineStyleParamKeys,
} from "@/features/style-presets/types";

interface StyleProfileNodeInspectorProps {
  definition: WorkflowDefinition;
  onDefinitionChange: (definition: WorkflowDefinition) => void;
  projectRoot: string;
  selectedNode: WorkflowNode;
}

function readNumber(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function StyleProfileNodeInspector({
  definition,
  onDefinitionChange,
  projectRoot,
  selectedNode,
}: StyleProfileNodeInspectorProps) {
  const { presets } = useStylePresets();
  const params = selectedNode.params;
  const presetId = resolvePresetId(params);
  const featuredPresets = useMemo(
    () =>
      getFeaturedPresets(presets).map((preset) => ({
        id: preset.id,
        label: preset.label,
        params: preset.params,
        tagline: buildStylePresetSummary(preset.params),
        thumbnail: getStylePresetThumbnail(preset.thumbnail || preset.id),
      })),
    [presets],
  );
  const activePreset = findStylePreset(presets, presetId);
  const resolvedParams = useMemo(
    () => resolveStyleParamsForPreview(params, activePreset?.params),
    [activePreset?.params, params],
  );
  const presetSummary = useMemo(() => buildStylePresetSummary(resolvedParams), [resolvedParams]);
  const isLegacyInline = hasLegacyInlineStyleParams(params);

  function replaceNodeParams(nextParams: Record<string, unknown>) {
    const nextNodes = definition.nodes.map((node) =>
      node.id === selectedNode.id ? { ...node, params: nextParams } : node,
    );
    onDefinitionChange({ ...definition, nodes: nextNodes });
  }

  function patchParams(nextParams: Record<string, unknown>) {
    replaceNodeParams({ ...selectedNode.params, ...nextParams });
  }

  function patchParam(key: string, value: unknown) {
    patchParams({ [key]: value });
  }

  function applyPreset(nextPresetId: string) {
    const base = { ...selectedNode.params, preset: nextPresetId, presetId: nextPresetId };
    if (!Boolean(selectedNode.params.enableLocalOverride)) {
      replaceNodeParams(stripInlineStyleParamKeys(base));
      return;
    }
    replaceNodeParams(base);
  }

  function openLibrary() {
    void openStylePresetLibrary({
      mode: "pick",
      nodeId: selectedNode.id,
      presetId,
      projectRoot,
    });
  }

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen<{ nodeId?: string; presetId: string }>("style-preset-selected", (event) => {
      if (event.payload.nodeId && event.payload.nodeId !== selectedNode.id) {
        return;
      }
      applyPreset(event.payload.presetId);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [selectedNode.id]);

  return (
    <>
      <PanelSection title="风格预设库">
        <StylePresetGallery
          onOpenLibrary={openLibrary}
          onSelect={applyPreset}
          presets={featuredPresets}
          selectedId={presetId}
          variant="compact"
        />
        <div className="workflow-style-preset-summary">
          <strong className="workflow-style-preset-summary-title">{activePreset?.label ?? presetId}</strong>
          <p className="workflow-style-preset-summary-tagline">{presetSummary}</p>
          {isLegacyInline ? (
            <div className="workflow-style-preset-summary-badge">
              <Badge variant="outline">内联参数模式</Badge>
            </div>
          ) : null}
        </div>
      </PanelSection>

      <PanelSection title="节点覆盖参数">
        <div className="workflow-style-switch-row">
          <span>启用局部覆盖</span>
          <Switch
            checked={Boolean(params.enableLocalOverride)}
            onCheckedChange={(checked) => {
              if (checked) {
                patchParam("enableLocalOverride", true);
                return;
              }
              replaceNodeParams({
                ...stripInlineStyleParamKeys(selectedNode.params),
                enableLocalOverride: false,
              });
            }}
          />
        </div>
        {params.enableLocalOverride ? (
          <>
            <AppSlider
              hint="当前节点对所选预设风格的整体权重。"
              label="风格权重"
              onChange={(value) => patchParam("styleWeight", value)}
              value={readNumber(params, "styleWeight", 0.85)}
            />
            <AppSlider
              hint="覆盖预设的一致性强度，用于该节点局部微调。"
              label="一致性强度"
              onChange={(value) => patchParam("consistencyStrength", value)}
              value={readNumber(params, "consistencyStrength", 0.92)}
            />
            <AppSlider
              hint="艺术参考图对该节点生成结果的影响权重。"
              label="参考图权重"
              onChange={(value) => patchParam("referenceStrength", value)}
              value={readNumber(params, "referenceStrength", 0.6)}
            />
            <AppSlider
              hint="负面约束在 prompt 中的强调程度。"
              label="负面约束强度"
              onChange={(value) => patchParam("negativeConstraintStrength", value)}
              value={readNumber(params, "negativeConstraintStrength", 0.8)}
            />
          </>
        ) : null}
      </PanelSection>
    </>
  );
}
