import { Plus, Upload, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AppSelect, InspectorField, PanelSection } from "@/components/shared";
import type { BackgroundRemovalToolOptions } from "../types";

interface BackgroundRemovalToolPanelProps {
  onOptionsChange: (options: BackgroundRemovalToolOptions) => void;
  onPickImage: () => void;
  options: BackgroundRemovalToolOptions;
  sourcePath?: string;
}

const engineOptions = [
  { label: "快速纯色背景", value: "chroma" },
  { label: "AI 语义去背景", value: "rembg" },
];

const cleanupOptions = [
  { label: "关闭", value: "off" },
  { label: "轻度", value: "soft" },
  { label: "标准", value: "standard" },
  { label: "严格", value: "strict" },
];

const modelOptions = [
  { label: "IS-Net 通用模型", value: "isnet-general-use" },
  { label: "BiRefNet 轻量模型", value: "birefnet-general-lite" },
  { label: "BiRefNet 通用模型", value: "birefnet-general" },
  { label: "Silueta 轻量模型", value: "silueta" },
  { label: "自定义本地模型", value: "custom" },
];

export function BackgroundRemovalToolPanel({
  onOptionsChange,
  onPickImage,
  options,
  sourcePath,
}: BackgroundRemovalToolPanelProps) {
  const [sampleColor, setSampleColor] = useState("#ffffff");

  const updateOptions = (patch: Partial<BackgroundRemovalToolOptions>) => {
    onOptionsChange({ ...options, ...patch });
  };

  const addSampleColor = () => {
    if (options.manualBackgroundSamples.includes(sampleColor)) {
      return;
    }

    updateOptions({
      manualBackgroundSamples: [...options.manualBackgroundSamples, sampleColor],
    });
  };

  return (
    <>
      <PanelSection title="输入素材" icon={Upload}>
        <Button onClick={onPickImage} type="button" variant="outline">
          <Upload aria-hidden="true" />
          上传图片
        </Button>
        <p className="asset-tool-source-path">{sourcePath || "支持 PNG / JPG / WEBP，首版每次处理一张图片。"}</p>
      </PanelSection>

      <PanelSection title="去背景参数">
        <InspectorField label="算法">
          <AppSelect
            ariaLabel="去背景算法"
            onValueChange={(value) => updateOptions({ engine: value as BackgroundRemovalToolOptions["engine"] })}
            options={engineOptions}
            value={options.engine}
          />
        </InspectorField>

        {options.engine === "rembg" ? (
          <>
            <InspectorField label="语义模型">
              <AppSelect
                ariaLabel="语义去背景模型"
                onValueChange={(value) => updateOptions({ rembgModel: value as BackgroundRemovalToolOptions["rembgModel"] })}
                options={modelOptions}
                value={options.rembgModel}
              />
            </InspectorField>
            <label className="asset-tool-check-row">
              <Checkbox
                checked={options.alphaMatting}
                onCheckedChange={(checked) => updateOptions({ alphaMatting: Boolean(checked) })}
              />
              <span>启用 Alpha Matting</span>
            </label>
          </>
        ) : (
          <>
            <InspectorField label={`容差 ${options.tolerance}`} description="越高越容易清理残留，也更可能误伤边缘。">
              <Input
                max={96}
                min={4}
                onChange={(event) => updateOptions({ tolerance: clampNumber(event.target.value, 4, 96, 34) })}
                type="range"
                value={options.tolerance}
              />
            </InspectorField>
            <InspectorField label={`边缘柔化 ${options.edgeSoftness}`}>
              <Input
                max={96}
                min={0}
                onChange={(event) => updateOptions({ edgeSoftness: clampNumber(event.target.value, 0, 96, 24) })}
                type="range"
                value={options.edgeSoftness}
              />
            </InspectorField>
            <InspectorField label={`边缘偏移 ${options.edgeOffset}`} description="负值收缩边缘，正值扩张前景。">
              <Input
                max={6}
                min={-6}
                onChange={(event) => updateOptions({ edgeOffset: clampNumber(event.target.value, -6, 6, 0) })}
                type="range"
                value={options.edgeOffset}
              />
            </InspectorField>
            <InspectorField label="碎点清理">
              <AppSelect
                ariaLabel="碎点清理"
                onValueChange={(value) =>
                  updateOptions({ cleanupStrength: value as BackgroundRemovalToolOptions["cleanupStrength"] })
                }
                options={cleanupOptions}
                value={options.cleanupStrength}
              />
            </InspectorField>
            <InspectorField label="孔洞填补上限">
              <Input
                max={4096}
                min={0}
                onChange={(event) => updateOptions({ holeFillMaxPixels: clampNumber(event.target.value, 0, 4096, 128) })}
                type="number"
                value={options.holeFillMaxPixels}
              />
            </InspectorField>
            <InspectorField label={`残色抑制 ${options.spillSuppression}`}>
              <Input
                max={100}
                min={0}
                onChange={(event) => updateOptions({ spillSuppression: clampNumber(event.target.value, 0, 100, 45) })}
                type="range"
                value={options.spillSuppression}
              />
            </InspectorField>
            <label className="asset-tool-check-row">
              <Checkbox
                checked={options.preserveSmallParts}
                onCheckedChange={(checked) => updateOptions({ preserveSmallParts: Boolean(checked) })}
              />
              <span>保留小部件</span>
            </label>
          </>
        )}
      </PanelSection>

      <PanelSection title="背景采样色">
        <div className="asset-tool-color-adder">
          <Input aria-label="背景采样色" onChange={(event) => setSampleColor(event.target.value)} type="color" value={sampleColor} />
          <Button onClick={addSampleColor} size="icon" type="button" variant="outline">
            <Plus aria-hidden="true" />
          </Button>
        </div>
        <div className="asset-tool-sample-list">
          {options.manualBackgroundSamples.length === 0 ? <span>未添加手动采样色</span> : null}
          {options.manualBackgroundSamples.map((color) => (
            <button
              key={color}
              onClick={() =>
                updateOptions({
                  manualBackgroundSamples: options.manualBackgroundSamples.filter((item) => item !== color),
                })
              }
              type="button"
            >
              <i style={{ backgroundColor: color }} />
              {color}
              <X aria-hidden="true" />
            </button>
          ))}
        </div>
      </PanelSection>

    </>
  );
}

function clampNumber(value: string, min: number, max: number, fallback: number) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsedValue));
}
