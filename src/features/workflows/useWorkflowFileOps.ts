import { open, save } from "@tauri-apps/plugin-dialog";
import type { Dispatch, RefObject, SetStateAction } from "react";

import { appLogger } from "@/lib/logger";
import {
  deleteWorkflowDefinition,
  exportWorkflowDefinition,
  importWorkflowFromFile,
  saveWorkflowDefinition,
} from "@/lib/tauri/commands";

import type { WorkflowDefinition } from "./types";
import type { WorkflowCanvasHandle } from "./WorkflowCanvas";
import { clearWorkflowDraft } from "./workflowDraft";
import { getErrorMessage } from "./workflowErrors";
import { createBlankWorkflow } from "./workflowFactory";
import {
  confirmDiscardDirtyChanges,
  confirmWorkflowAction,
  createSaveAsWorkflowDefinition,
  suggestExportFileName,
} from "./workflowFileOps";
import { useWorkflowStore } from "./workflowStore";

interface UseWorkflowFileOpsParams {
  canvasRef: RefObject<WorkflowCanvasHandle | null>;
  isDirty: boolean;
  projectKey: string;
  projectRootPath: string;
  setMessage: (message: string) => void;
  setWorkflows: Dispatch<SetStateAction<WorkflowDefinition[]>>;
  workflow: WorkflowDefinition;
  workflows: WorkflowDefinition[];
}

interface UseWorkflowFileOpsResult {
  handleDeleteWorkflow: (workflowId: string) => Promise<void>;
  handleExportWorkflow: () => Promise<void>;
  handleImportWorkflow: () => Promise<void>;
  handleSaveAsWorkflow: (name: string) => Promise<void>;
  handleSaveWorkflow: () => Promise<void>;
}

/// 工作流文件操作：保存、另存为、导入、导出、删除。
/// 工作流定义与运行态来自 workflowStore；已保存定义列表（setWorkflows）与提示文案
/// 仍由调用方的本地状态注入，画布句柄用于保存后清理画布选择。
export function useWorkflowFileOps({
  canvasRef,
  isDirty,
  projectKey,
  projectRootPath,
  setMessage,
  setWorkflows,
  workflow,
  workflows,
}: UseWorkflowFileOpsParams): UseWorkflowFileOpsResult {
  const setCurrentWorkflow = useWorkflowStore((state) => state.setCurrentWorkflow);
  const markClean = useWorkflowStore((state) => state.markClean);
  const updateCurrentWorkflow = useWorkflowStore((state) => state.updateCurrentWorkflow);
  const setSelectedRun = useWorkflowStore((state) => state.setSelectedRun);
  const setRuns = useWorkflowStore((state) => state.setRuns);

  async function handleSaveWorkflow() {
    try {
      const savedWorkflow = await saveWorkflowDefinition(projectRootPath, workflow);
      setCurrentWorkflow(savedWorkflow);
      markClean();
      canvasRef.current?.clearCanvasSelection();
      clearWorkflowDraft(projectKey, savedWorkflow.id);
      setWorkflows((currentWorkflows) => [
        savedWorkflow,
        ...currentWorkflows.filter((item) => item.id !== savedWorkflow.id),
      ]);
      setMessage("工作流已保存。");
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessage(`保存失败：${errorMessage}`);
      await appLogger.error("保存工作流失败", {
        errorMessage,
        scope: "workflow.save",
        workflowId: workflow.id,
      });
    }
  }

  async function handleSaveAsWorkflow(name: string) {
    const nextDefinition = createSaveAsWorkflowDefinition(workflow, name);

    try {
      const savedWorkflow = await saveWorkflowDefinition(projectRootPath, nextDefinition);
      setCurrentWorkflow(savedWorkflow);
      markClean();
      clearWorkflowDraft(projectKey, savedWorkflow.id);
      setWorkflows((currentWorkflows) => [
        savedWorkflow,
        ...currentWorkflows.filter((item) => item.id !== savedWorkflow.id),
      ]);
      setMessage(`已另存为：${savedWorkflow.name}`);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessage(`另存为失败：${errorMessage}`);
      await appLogger.error("另存为工作流失败", {
        errorMessage,
        name,
        scope: "workflow.saveAs",
        workflowId: workflow.id,
      });
    }
  }

  async function handleImportWorkflow() {
    if (!(await confirmDiscardDirtyChanges(isDirty, "导入工作流"))) {
      return;
    }

    try {
      const path = await open({
        filters: [{ extensions: ["json"], name: "工作流 JSON" }],
        multiple: false,
        title: "导入工作流",
      });

      if (typeof path !== "string") {
        return;
      }

      const imported = await importWorkflowFromFile(path);
      setCurrentWorkflow(imported);
      updateCurrentWorkflow(imported);
      setSelectedRun(undefined);
      setMessage("工作流已导入，请另存为写入当前项目。");
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessage(`导入失败：${errorMessage}`);
      await appLogger.error("导入工作流失败", {
        errorMessage,
        scope: "workflow.import",
      });
    }
  }

  async function handleExportWorkflow() {
    try {
      const path = await save({
        defaultPath: suggestExportFileName(workflow),
        filters: [{ extensions: ["json"], name: "工作流 JSON" }],
        title: "导出工作流",
      });

      if (!path) {
        return;
      }

      await exportWorkflowDefinition(path, workflow);
      setMessage("工作流已导出。");
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessage(`导出失败：${errorMessage}`);
      await appLogger.error("导出工作流失败", {
        errorMessage,
        scope: "workflow.export",
        workflowId: workflow.id,
      });
    }
  }

  async function handleDeleteWorkflow(workflowId: string) {
    const target = workflows.find((item) => item.id === workflowId);

    if (!target) {
      return;
    }

    if (!(await confirmWorkflowAction(`确定删除工作流「${target.name}」吗？此操作不可恢复。`, "删除工作流"))) {
      return;
    }

    try {
      await deleteWorkflowDefinition(projectRootPath, workflowId);
      setWorkflows((currentWorkflows) => currentWorkflows.filter((item) => item.id !== workflowId));
      setRuns((currentRuns) => currentRuns.filter((run) => run.workflowId !== workflowId));

      if (workflow.id === workflowId) {
        setCurrentWorkflow(createBlankWorkflow());
        setSelectedRun(undefined);
      }

      setMessage(`已删除工作流：${target.name}`);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessage(`删除失败：${errorMessage}`);
      await appLogger.error("删除工作流失败", {
        errorMessage,
        scope: "workflow.delete",
        workflowId,
      });
    }
  }

  return {
    handleDeleteWorkflow,
    handleExportWorkflow,
    handleImportWorkflow,
    handleSaveAsWorkflow,
    handleSaveWorkflow,
  };
}
