import { open } from "@tauri-apps/plugin-dialog";
import { Upload } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AppSlider, AppSelect, InspectorField, PanelSection, SegmentedControl } from "@/components/shared";
import { appLogger } from "@/lib/logger";
import { importCharacterReferenceImages } from "@/lib/tauri/commands";

import {
  backgroundModeOptions,
  canvasSizeOptions,
  directionOptions,
  generationCountOptions,
  generationOptions,
  generationQualityOptions,
} from "../../../characterFixtures";
import type { CharacterWorkshopDraft } from "../../../types";

interface GenerationReferenceTabProps {
  draft: CharacterWorkshopDraft;
  onDraftChange: (draft: Partial<CharacterWorkshopDraft>) => void;
  projectRoot: string;
}

export function GenerationReferenceTab({ draft, onDraftChange, projectRoot }: GenerationReferenceTabProps) {
  const [referenceError, setReferenceError] = useState<string>();
  const [isImportingReferences, setIsImportingReferences] = useState(false);
  const canImportMoreReferences = draft.referenceImages.length < 4;

  async function handleImportReferenceImages() {
    if (!canImportMoreReferences || isImportingReferences) {
      return;
    }

    setReferenceError(undefined);
    setIsImportingReferences(true);

    try {
      const selectedPaths = await open({
        filters: [{ extensions: ["png", "jpg", "jpeg", "webp"], name: "参考图片" }],
        multiple: true,
        title: "选择角色参考图",
      });

      const imagePaths = normalizeSelectedPaths(selectedPaths).slice(0, 4 - draft.referenceImages.length);
      if (imagePaths.length === 0) {
        return;
      }

      const importedImages = await importCharacterReferenceImages({
        imagePaths,
        projectRoot,
      });

      onDraftChange({
        referenceImages: [...draft.referenceImages, ...importedImages].slice(0, 4),
      });
      await appLogger.info(`角色参考图导入完成：count=${importedImages.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setReferenceError(message);
      await appLogger.error(`角色参考图导入失败：message=${message}`);
    } finally {
      setIsImportingReferences(false);
    }
  }

  return (
    <div className="character-setup-tab-panel">
      <PanelSection description="画布与方向影响后续多视图与动作产线" title="产出规格">
        <InspectorField label="画布规格 *" description={formatCanvasSizeHint(draft)}>
          <SegmentedControl
            ariaLabel="画布规格"
            className="character-canvas-size-control"
            onValueChange={(size) => onDraftChange({ size })}
            options={canvasSizeOptions.map((size) => ({ label: size, value: size }))}
            value={draft.size}
          />
          {draft.size === "自定义" ? (
            <div className="custom-canvas-size-row">
              <label>
                <span>宽</span>
                <Input
                  max={256}
                  min={16}
                  onChange={(event) => onDraftChange({ customWidth: normalizeCanvasSide(event.target.value, draft.customWidth) })}
                  type="number"
                  value={draft.customWidth}
                />
              </label>
              <label>
                <span>高</span>
                <Input
                  max={256}
                  min={16}
                  onChange={(event) => onDraftChange({ customHeight: normalizeCanvasSide(event.target.value, draft.customHeight) })}
                  type="number"
                  value={draft.customHeight}
                />
              </label>
            </div>
          ) : null}
        </InspectorField>

        <InspectorField label="方向规格 *">
          <SegmentedControl
            ariaLabel="方向规格"
            className="character-direction-control"
            onValueChange={(direction) => onDraftChange({ direction })}
            options={directionOptions.map((option) => ({
              description: option.description,
              label: option.label,
              value: option.value,
            }))}
            value={draft.direction}
          />
        </InspectorField>

        {draft.identity.entityType === "boss" ? (
          <p className="character-setup-hint">Boss 建议使用 64×64 或更大画布，以保留剪影细节。</p>
        ) : null}
      </PanelSection>

      <PanelSection description="参考图可显著提升风格与轮廓一致性" title="参考素材">
        <button
          className="reference-dropzone"
          disabled={!canImportMoreReferences || isImportingReferences}
          onClick={() => void handleImportReferenceImages()}
          type="button"
        >
          <Upload aria-hidden="true" size={22} />
          <strong>{isImportingReferences ? "正在导入参考图" : "点击上传参考图片"}</strong>
          <small>支持 PNG / JPG / WEBP，最多 4 张</small>
        </button>
        {referenceError ? <small className="field-error-text">{referenceError}</small> : null}
        {draft.referenceImages.length > 0 ? (
          <div className="reference-thumb-row">
            {draft.referenceImages.map((image) => (
              <figure className="reference-thumb imported" key={image.id}>
                <img alt={image.fileName} src={image.dataUrl} />
                <figcaption>
                  <Badge variant="secondary">{image.role}</Badge>
                  <button
                    aria-label={`移除参考图 ${image.fileName}`}
                    onClick={() =>
                      onDraftChange({
                        referenceImages: draft.referenceImages.filter((item) => item.id !== image.id),
                      })
                    }
                    type="button"
                  >
                    移除
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : null}

        <AppSlider
          hint="越高越贴近参考图轮廓与配色"
          label="参考图权重"
          max={1}
          min={0}
          onChange={(referenceStrength) => onDraftChange({ referenceStrength })}
          step={0.05}
          value={draft.referenceStrength}
        />
      </PanelSection>

      <PanelSection description="控制候选数量、质量与背景处理" title="生成参数">
        <InspectorField label="生成数量">
          <SegmentedControl
            ariaLabel="生成数量"
            className="equal-segmented"
            onValueChange={(generationCount) => onDraftChange({ generationCount })}
            options={generationCountOptions.map((option) => ({ label: option, value: option }))}
            value={draft.generationCount}
          />
        </InspectorField>

        <InspectorField label="生成质量">
          <AppSelect
            ariaLabel="生成质量"
            onValueChange={(generationQuality) =>
              onDraftChange({ generationQuality: generationQuality as CharacterWorkshopDraft["generationQuality"] })
            }
            options={generationQualityOptions.map((option) => ({ label: option, value: option }))}
            value={draft.generationQuality}
          />
        </InspectorField>

        <InspectorField label="背景模式">
          <SegmentedControl
            ariaLabel="背景模式"
            className="background-mode-control"
            onValueChange={(backgroundMode) =>
              onDraftChange({ backgroundMode: backgroundMode as CharacterWorkshopDraft["backgroundMode"] })
            }
            options={backgroundModeOptions.map((option) => ({ label: option.label, value: option.value }))}
            value={draft.backgroundMode}
          />
        </InspectorField>

        <div className="generation-option-list">
          {generationOptions.map((option) => (
            <label key={option.label}>
              <Checkbox
                checked={draft.generationOptions.includes(option.value)}
                onCheckedChange={() =>
                  onDraftChange({
                    generationOptions: toggleStringValue(draft.generationOptions, option.value),
                  })
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </PanelSection>
    </div>
  );
}

function normalizeCanvasSide(value: string, fallback: number) {
  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(256, Math.max(16, parsedValue));
}

function formatCanvasSizeHint(draft: CharacterWorkshopDraft) {
  if (draft.size === "自定义") {
    return `${draft.customWidth}(W) x ${draft.customHeight}(H) 像素`;
  }

  const [width, height] = draft.size.split("x");
  return `${width}(W) x ${height}(H) 像素`;
}

function normalizeSelectedPaths(value: string | string[] | null) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function toggleStringValue(values: string[], value: string) {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }

  return [...values, value];
}
