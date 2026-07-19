import type { LucideIcon } from "lucide-react";

export interface WorkflowCanvasToolbarContext {
  onAutoLayout: () => void;
  onFitView: () => void;
  onZoomTo: (percent: number) => void;
  showEdges: boolean;
  showGrid: boolean;
  showMinimap: boolean;
  showSnap: boolean;
  toggleEdges: () => void;
  toggleGrid: () => void;
  toggleMinimap: () => void;
  toggleSnap: () => void;
  zoom: number;
}

export type WorkflowCanvasToolbarItem =
  | { id: string; kind: "separator" }
  | {
      icon: LucideIcon;
      id: string;
      kind: "action";
      label: string;
      onClick: () => void;
    }
  | {
      icon: LucideIcon;
      id: string;
      kind: "toggle";
      label: string;
      onToggle: () => void;
      pressed: boolean;
    }
  | {
      id: string;
      kind: "zoom";
      onFitView: () => void;
      onZoomTo: (percent: number) => void;
      value: number;
    };
