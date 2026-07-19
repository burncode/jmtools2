import type { WorkflowNodeCategory } from "./types";

export interface WorkflowNodeColorPreset {
  id: string;
  label: string;
  value: string;
}

export const WORKFLOW_NODE_COLOR_PRESETS: WorkflowNodeColorPreset[] = [
  { id: "default", label: "默认", value: "" },
  { id: "gray", label: "灰色", value: "#6b7280" },
  { id: "red", label: "红色", value: "#ef4444" },
  { id: "orange", label: "橙色", value: "#f97316" },
  { id: "yellow", label: "黄色", value: "#eab308" },
  { id: "green", label: "绿色", value: "#22c55e" },
  { id: "cyan", label: "青色", value: "#06b6d4" },
  { id: "blue", label: "蓝色", value: "#3b82f6" },
  { id: "purple", label: "紫色", value: "#a855f7" },
  { id: "pink", label: "粉色", value: "#ec4899" },
];

const CATEGORY_ACCENT_COLORS: Record<WorkflowNodeCategory, string> = {
  ai: "#3b82f6",
  asset: "#6b7280",
  character: "#22c55e",
  input: "#06b6d4",
  logic: "#a855f7",
  output: "#f97316",
  preview: "#8b5cf6",
  tool: "#eab308",
};

export function getWorkflowNodeAccentColor(category: WorkflowNodeCategory | undefined, accentColor?: string) {
  if (accentColor) {
    return accentColor;
  }

  if (category) {
    return CATEGORY_ACCENT_COLORS[category] ?? CATEGORY_ACCENT_COLORS.preview;
  }

  return CATEGORY_ACCENT_COLORS.preview;
}

export function getWorkflowNodeShortId(nodeId: string) {
  const segments = nodeId.split("-");
  const tail = segments[segments.length - 1];

  if (tail && /^\d+$/.test(tail)) {
    return `#${tail.slice(-4)}`;
  }

  return `#${nodeId.slice(-4)}`;
}
