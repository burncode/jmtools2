import { Grid3x3, Layers, Minus, Plus, Wand2 } from "lucide-react";

import { IconButton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CreateReviewToolbarProps {
  hasProcessedPreview: boolean;
  imageSourceMode: "original" | "processed";
  onImageSourceModeChange: (mode: "original" | "processed") => void;
  onToggleCheckerboard: () => void;
  onToggleGrid: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  previewZoom: number;
  showCheckerboard: boolean;
  showGrid: boolean;
  showDirectionLabel?: boolean;
}

export function CreateReviewToolbar({
  hasProcessedPreview,
  imageSourceMode,
  onImageSourceModeChange,
  onToggleCheckerboard,
  onToggleGrid,
  onZoomIn,
  onZoomOut,
  previewZoom,
  showCheckerboard,
  showGrid,
  showDirectionLabel = true,
}: CreateReviewToolbarProps) {
  return (
    <div className="create-review-toolbar-unified" role="toolbar" aria-label="预览工具条">
      {showDirectionLabel ? (
        <span className="create-review-toolbar-segment create-review-toolbar-label">
          <Layers aria-hidden="true" size={14} />
          方向视图
        </span>
      ) : null}

      <div className="create-review-toolbar-segment create-review-toolbar-zoom">
        <IconButton aria-label="缩小预览" onClick={onZoomOut} size="icon-sm" type="button">
          <Minus aria-hidden="true" />
        </IconButton>
        <span>{previewZoom}%</span>
        <IconButton aria-label="放大预览" onClick={onZoomIn} size="icon-sm" type="button">
          <Plus aria-hidden="true" />
        </IconButton>
      </div>

      <div className="create-review-toolbar-segment">
        <Button
          aria-pressed={showGrid}
          onClick={onToggleGrid}
          size="sm"
          type="button"
          variant={showGrid ? "secondary" : "ghost"}
        >
          <Grid3x3 aria-hidden="true" size={14} />
          网格线
        </Button>
        <Button
          aria-pressed={showCheckerboard}
          onClick={onToggleCheckerboard}
          size="sm"
          type="button"
          variant={showCheckerboard ? "secondary" : "ghost"}
        >
          <Wand2 aria-hidden="true" size={14} />
          透明预览
        </Button>
      </div>

      {hasProcessedPreview ? (
        <div className="create-review-toolbar-segment create-review-toolbar-source" role="group" aria-label="图像来源">
          <Button
            aria-pressed={imageSourceMode === "original"}
            className={cn(imageSourceMode === "original" && "is-active")}
            onClick={() => onImageSourceModeChange("original")}
            size="sm"
            type="button"
            variant={imageSourceMode === "original" ? "secondary" : "ghost"}
          >
            原图
          </Button>
          <Button
            aria-pressed={imageSourceMode === "processed"}
            className={cn(imageSourceMode === "processed" && "is-active")}
            onClick={() => onImageSourceModeChange("processed")}
            size="sm"
            type="button"
            variant={imageSourceMode === "processed" ? "secondary" : "ghost"}
          >
            处理后
          </Button>
        </div>
      ) : null}
    </div>
  );
}
