import { Grid3X3, LayoutTemplate, Magnet, Map, Scan, Waypoints } from "lucide-react";

import type { WorkflowCanvasToolbarContext, WorkflowCanvasToolbarItem } from "./workflowCanvasToolbarTypes";

export function buildWorkflowCanvasToolbarItems(ctx: WorkflowCanvasToolbarContext): WorkflowCanvasToolbarItem[] {
  return [
    {
      icon: Scan,
      id: "fitView",
      kind: "action",
      label: "适配视图",
      onClick: ctx.onFitView,
    },
    {
      id: "zoom",
      kind: "zoom",
      onFitView: ctx.onFitView,
      onZoomTo: ctx.onZoomTo,
      value: ctx.zoom,
    },
    { id: "separator-view", kind: "separator" },
    {
      icon: Map,
      id: "minimap",
      kind: "toggle",
      label: "小地图",
      onToggle: ctx.toggleMinimap,
      pressed: ctx.showMinimap,
    },
    {
      icon: Grid3X3,
      id: "grid",
      kind: "toggle",
      label: "网格",
      onToggle: ctx.toggleGrid,
      pressed: ctx.showGrid,
    },
    {
      icon: Magnet,
      id: "snap",
      kind: "toggle",
      label: "吸附网格",
      onToggle: ctx.toggleSnap,
      pressed: ctx.showSnap,
    },
    {
      icon: LayoutTemplate,
      id: "autoLayout",
      kind: "action",
      label: "自动排布",
      onClick: ctx.onAutoLayout,
    },
    {
      icon: Waypoints,
      id: "edges",
      kind: "toggle",
      label: "隐藏连线",
      onToggle: ctx.toggleEdges,
      pressed: !ctx.showEdges,
    },
  ];
}
