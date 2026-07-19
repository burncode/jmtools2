import { confirm } from "@tauri-apps/plugin-dialog";

import type { WorkflowDefinition } from "./types";

/// 统一的桌面级确认对话框：替代浏览器原生 window.confirm，避免 MCP bridge 拦截，
/// 并在 Tauri 窗口内呈现一致的中文确认框。
export async function confirmWorkflowAction(message: string, title = "确认操作"): Promise<boolean> {
  return confirm(message, { kind: "warning", title });
}

export function createWorkflowSlug(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "workflow";
}

export function createSaveAsWorkflowDefinition(source: WorkflowDefinition, name: string): WorkflowDefinition {
  const slug = createWorkflowSlug(name);

  return {
    ...structuredClone(source),
    createdAt: undefined,
    id: `${slug}-${Date.now()}`,
    name: name.trim() || "未命名工作流",
    updatedAt: undefined,
  };
}

export async function confirmDiscardDirtyChanges(isDirty: boolean, actionLabel: string): Promise<boolean> {
  if (!isDirty) {
    return true;
  }

  return confirmWorkflowAction(`当前工作流有未保存的更改，确定要${actionLabel}吗？未保存内容将丢失。`);
}

export function suggestExportFileName(workflow: WorkflowDefinition) {
  return `${createWorkflowSlug(workflow.name)}.workflow.json`;
}
