import { useReactFlow } from "@xyflow/react";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { buildWorkflowCanvasToolbarItems } from "./workflowCanvasToolbarItems";
import type { WorkflowCanvasToolbarItem } from "./workflowCanvasToolbarTypes";
import { useWorkflowStore } from "./workflowStore";

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200] as const;

interface WorkflowCanvasFloatingToolbarProps {
  onAutoLayout: () => void;
}

export function WorkflowCanvasFloatingToolbar({ onAutoLayout }: WorkflowCanvasFloatingToolbarProps) {
  const { fitView, zoomTo } = useReactFlow();
  const canvasView = useWorkflowStore((state) => state.canvasView);
  const setCanvasView = useWorkflowStore((state) => state.setCanvasView);
  const toggleCanvasEdges = useWorkflowStore((state) => state.toggleCanvasEdges);
  const toggleCanvasGrid = useWorkflowStore((state) => state.toggleCanvasGrid);
  const toggleCanvasMinimap = useWorkflowStore((state) => state.toggleCanvasMinimap);
  const toggleCanvasSnap = useWorkflowStore((state) => state.toggleCanvasSnap);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);

  const items = useMemo(
    () =>
      buildWorkflowCanvasToolbarItems({
        onAutoLayout,
        onFitView: () => {
          void fitView({ duration: 200, padding: 0.18 });
        },
        onZoomTo: (percent) => {
          void zoomTo(percent / 100, { duration: 200 });
          setCanvasView({ zoom: percent });
        },
        showEdges: canvasView.showEdges,
        showGrid: canvasView.showGrid,
        showMinimap: canvasView.showMinimap,
        showSnap: canvasView.snapToGrid,
        toggleEdges: toggleCanvasEdges,
        toggleGrid: toggleCanvasGrid,
        toggleMinimap: toggleCanvasMinimap,
        toggleSnap: toggleCanvasSnap,
        zoom: canvasView.zoom,
      }),
    [
      canvasView.showEdges,
      canvasView.showGrid,
      canvasView.showMinimap,
      canvasView.snapToGrid,
      canvasView.zoom,
      fitView,
      onAutoLayout,
      setCanvasView,
      toggleCanvasEdges,
      toggleCanvasGrid,
      toggleCanvasMinimap,
      toggleCanvasSnap,
      zoomTo,
    ],
  );

  return (
    <div className="workflow-canvas-floating-toolbar-inner">
      {items.map((item) => (
        <ToolbarItem key={item.id} item={item} onZoomMenuOpenChange={setZoomMenuOpen} zoomMenuOpen={zoomMenuOpen} />
      ))}
    </div>
  );
}

function ToolbarItem({
  item,
  onZoomMenuOpenChange,
  zoomMenuOpen,
}: {
  item: WorkflowCanvasToolbarItem;
  onZoomMenuOpenChange: (open: boolean) => void;
  zoomMenuOpen: boolean;
}) {
  if (item.kind === "separator") {
    return <div aria-hidden="true" className="workflow-canvas-toolbar-separator" role="separator" />;
  }

  if (item.kind === "action") {
    const Icon = item.icon;

    return (
      <Button
        aria-label={item.label}
        className="workflow-canvas-toolbar-button"
        onClick={item.onClick}
        title={item.label}
        type="button"
        variant="ghost"
      >
        <Icon aria-hidden="true" />
      </Button>
    );
  }

  if (item.kind === "toggle") {
    const Icon = item.icon;

    return (
      <Button
        aria-label={item.label}
        aria-pressed={item.pressed}
        className="workflow-canvas-toolbar-button"
        data-active={item.pressed}
        onClick={item.onToggle}
        title={item.label}
        type="button"
        variant="ghost"
      >
        <Icon aria-hidden="true" />
      </Button>
    );
  }

  return (
    <div className="workflow-canvas-toolbar-zoom">
      <span className="workflow-canvas-toolbar-zoom-value">{item.value}%</span>
      <Popover onOpenChange={onZoomMenuOpenChange} open={zoomMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-label="缩放预设"
            className="workflow-canvas-toolbar-button workflow-canvas-toolbar-zoom-trigger"
            title="缩放预设"
            type="button"
            variant="ghost"
          >
            <ChevronDown aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="workflow-canvas-toolbar-zoom-menu" side="top" sideOffset={8}>
          <div className="workflow-canvas-toolbar-zoom-menu-list">
            {ZOOM_PRESETS.map((preset) => (
              <button
                className="workflow-canvas-toolbar-zoom-menu-item"
                key={preset}
                onClick={() => {
                  item.onZoomTo(preset);
                  onZoomMenuOpenChange(false);
                }}
                type="button"
              >
                {preset}%
              </button>
            ))}
            <button
              className="workflow-canvas-toolbar-zoom-menu-item"
              onClick={() => {
                item.onFitView();
                onZoomMenuOpenChange(false);
              }}
              type="button"
            >
              适配视图
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
