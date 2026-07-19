import { convertFileSrc } from "@tauri-apps/api/core";
import { Maximize2, Minimize2 } from "lucide-react";
import { useMemo, useState } from "react";

import { CanvasPanel, IconButton } from "@/components/shared";
import { cn } from "@/lib/utils";

import type { PostProcessPreviewImages } from "../types/createArchiveTypes";
import type {
  CharacterImageAsset,
  CharacterMasterCandidatePlan,
  CharacterWorkshopDraft,
} from "../../types";
import { CreateCandidateStrip } from "./CreateCandidateStrip";
import { CreateReviewToolbar } from "./CreateReviewToolbar";

type DirectionKey = "front" | "back" | "left" | "right";

interface CreateReviewCanvasProps {
  candidatePlans: CharacterMasterCandidatePlan[];
  createPhase: "finalize" | "review";
  draft: CharacterWorkshopDraft;
  imageSourceMode: "original" | "processed";
  isPlanSelectionLocked?: boolean;
  onImageSourceModeChange: (mode: "original" | "processed") => void;
  onSelectPlan: (plan: CharacterMasterCandidatePlan) => void;
  planSummary?: string;
  previewImages?: PostProcessPreviewImages;
  selectedPlan: CharacterMasterCandidatePlan;
}

const directionSlots: Array<{ angle: string; key: DirectionKey; label: string }> = [
  { angle: "0°", key: "front", label: "前视图" },
  { angle: "180°", key: "back", label: "后视图" },
  { angle: "90°", key: "left", label: "左视图" },
  { angle: "270°", key: "right", label: "右视图" },
];

export function CreateReviewCanvas({
  candidatePlans,
  createPhase,
  draft,
  imageSourceMode,
  isPlanSelectionLocked = false,
  onImageSourceModeChange,
  onSelectPlan,
  planSummary,
  previewImages,
  selectedPlan,
}: CreateReviewCanvasProps) {
  const [previewZoom, setPreviewZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [showCheckerboard, setShowCheckerboard] = useState(false);
  const [expandedDirection, setExpandedDirection] = useState<DirectionKey | null>(null);

  const isMultiDirection = draft.direction === "four" || draft.direction === "eight";
  const hasProcessedPreview = Boolean(previewImages && Object.keys(previewImages).length > 0);
  const planWarnings = selectedPlan.generationWarnings ?? [];

  const directionImages = useMemo(() => {
    return directionSlots.map((slot) => ({
      ...slot,
      image: resolveDirectionImage(selectedPlan, slot.key, previewImages, imageSourceMode),
    }));
  }, [imageSourceMode, previewImages, selectedPlan]);

  const expandedSlot = expandedDirection
    ? isMultiDirection
      ? directionImages.find((slot) => slot.key === expandedDirection)
      : {
          angle: "",
          image: selectedPlan.masterImage,
          key: "front" as DirectionKey,
          label: "母版预览",
        }
    : undefined;

  return (
    <div
      className={cn(
        "create-studio-center create-studio-center-review create-review-canvas subpixel-antialiased",
        createPhase === "finalize" && "create-review-canvas-finalize",
      )}
    >
      <CanvasPanel
        className="create-review-canvas-panel"
        label="母版预览"
        title={<strong className="create-review-canvas-heading">{selectedPlan.name}</strong>}
        toolbar={
          <CreateReviewToolbar
            hasProcessedPreview={hasProcessedPreview}
            imageSourceMode={imageSourceMode}
            onImageSourceModeChange={onImageSourceModeChange}
            onToggleCheckerboard={() => setShowCheckerboard((value) => !value)}
            onToggleGrid={() => setShowGrid((value) => !value)}
            onZoomIn={() => setPreviewZoom((value) => Math.min(160, value + 10))}
            onZoomOut={() => setPreviewZoom((value) => Math.max(60, value - 10))}
            previewZoom={previewZoom}
            showCheckerboard={showCheckerboard}
            showDirectionLabel={isMultiDirection}
            showGrid={showGrid}
          />
        }
        footer={
          <CreateCandidateStrip
            candidatePlans={candidatePlans}
            onSelectPlan={onSelectPlan}
            planBrief={planSummary}
            planFocus={selectedPlan.focus}
            readOnly={isPlanSelectionLocked}
            selectedPlanId={selectedPlan.id}
            stripHint={createPhase === "finalize" ? "入库前可切换方案，切换后需重新预览后处理" : undefined}
          />
        }
      >
        {planWarnings.length > 0 ? (
          <div className="create-review-generation-warnings" role="status">
            {planWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
        <div
          className={cn(
            "create-review-canvas-stage",
            showCheckerboard && "create-review-canvas-stage-checkerboard",
          )}
        >
          {showGrid ? <div aria-hidden="true" className="create-review-canvas-grid-overlay" /> : null}

          {expandedDirection && expandedSlot ? (
            <div className="create-review-canvas-expanded" style={{ transform: `scale(${previewZoom / 100})` }}>
              <header className="create-review-canvas-expanded-header">
                <span>
                  {expandedSlot.label} · {expandedSlot.angle}
                </span>
                <IconButton
                  aria-label="退出最大化"
                  onClick={() => setExpandedDirection(null)}
                  size="icon-sm"
                  type="button"
                >
                  <Minimize2 aria-hidden="true" />
                </IconButton>
              </header>
              <div className="create-review-canvas-expanded-image">
                {renderDirectionImage(expandedSlot.image, `${selectedPlan.name} ${expandedSlot.label}`)}
              </div>
            </div>
          ) : isMultiDirection ? (
            <div className="create-review-canvas-direction-grid" style={{ transform: `scale(${previewZoom / 100})` }}>
              {directionImages.map((slot) => (
                <figure className="create-review-canvas-direction-cell" key={slot.key}>
                  <figcaption>
                    <span>{slot.label}</span>
                    <small>
                      {slot.angle}
                      {slot.image ? ` · ${slot.image.width}×${slot.image.height}` : ""}
                    </small>
                  </figcaption>
                  <div className="create-review-canvas-direction-image">
                    {renderDirectionImage(slot.image, `${selectedPlan.name} ${slot.label}`)}
                    {slot.image ? (
                      <IconButton
                        aria-label={`最大化${slot.label}`}
                        className="create-review-canvas-expand-btn"
                        onClick={() => setExpandedDirection(slot.key)}
                        size="icon-sm"
                        type="button"
                      >
                        <Maximize2 aria-hidden="true" />
                      </IconButton>
                    ) : null}
                  </div>
                </figure>
              ))}
            </div>
          ) : (
            <div className="create-review-canvas-single-wrap">
              <div className="create-review-canvas-single" style={{ transform: `scale(${previewZoom / 100})` }}>
                {renderDirectionImage(selectedPlan.masterImage, `${selectedPlan.name} 母版预览`)}
              </div>
              {selectedPlan.masterImage ? (
                <IconButton
                  aria-label="最大化预览"
                  className="create-review-canvas-expand-btn create-review-canvas-expand-btn-single"
                  onClick={() => setExpandedDirection("front")}
                  size="icon-sm"
                  type="button"
                >
                  <Maximize2 aria-hidden="true" />
                </IconButton>
              ) : null}
            </div>
          )}
        </div>
      </CanvasPanel>
    </div>
  );
}

function renderDirectionImage(image: CharacterImageAsset | undefined, alt: string) {
  const previewUrl = getImagePreviewUrl(image);

  if (previewUrl) {
    return <img alt={alt} src={previewUrl} />;
  }

  return <span className="create-review-canvas-empty">待生成</span>;
}

function resolveDirectionImage(
  plan: CharacterMasterCandidatePlan,
  key: DirectionKey,
  previewImages: PostProcessPreviewImages | undefined,
  imageSourceMode: "original" | "processed",
): CharacterImageAsset | undefined {
  if (imageSourceMode === "processed" && previewImages?.[key]) {
    return previewImages[key];
  }

  return plan.directionPreviews?.[key] ?? (key === "front" ? plan.masterImage : undefined);
}

function getImagePreviewUrl(image: CharacterImageAsset | undefined) {
  if (image?.dataUrl) {
    return image.dataUrl;
  }

  if (!image?.absolutePath) {
    return "";
  }

  return convertFileSrc(image.absolutePath);
}
