import type { WorkflowNodeRunStatus, WorkflowRunStatus } from "./types";
import type { WorkflowNodeDisplayStatus } from "./workflowRunStatus";

export function getWorkflowRunStatusLabel(status: WorkflowRunStatus) {
  const labels = {
    awaiting_input: "等待选择",
    canceled: "已取消",
    failed: "失败",
    partial: "部分完成",
    queued: "就绪",
    running: "运行中",
    succeeded: "完成",
  } as const satisfies Record<WorkflowRunStatus, string>;

  return labels[status];
}

export function getWorkflowNodeRunStatusLabel(status: WorkflowNodeRunStatus | WorkflowNodeDisplayStatus) {
  const labels = {
    awaiting_input: "等待选择",
    canceled: "已取消",
    failed: "失败",
    queued: "等待",
    running: "运行中",
    skipped: "跳过",
    succeeded: "完成",
    waiting_upstream: "等待上游",
  } as const satisfies Record<WorkflowNodeRunStatus | WorkflowNodeDisplayStatus, string>;

  return labels[status];
}

export function getWorkflowPortKindLabel(kind: string) {
  const labels: Record<string, string> = {
    asset: "资产",
    character: "角色",
    image: "图片",
    toolResult: "工具结果",
  };

  return labels[kind] ?? kind;
}
