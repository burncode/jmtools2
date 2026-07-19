import { useEffect } from "react";

import type { WorkflowDefinition } from "./types";
import { writeWorkflowDraft } from "./workflowDraft";

/// 当前工作流脏状态下的草稿自动保存：变更后 2 秒节流写入本地草稿，
/// 供下次打开同一工作流时提供恢复入口。
export function useWorkflowDraftAutosave(
  projectKey: string,
  currentWorkflow: WorkflowDefinition | undefined,
  isDirty: boolean,
) {
  useEffect(() => {
    if (!currentWorkflow || !isDirty) {
      return;
    }

    const timer = window.setTimeout(() => {
      writeWorkflowDraft(projectKey, currentWorkflow);
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentWorkflow, isDirty, projectKey]);
}
