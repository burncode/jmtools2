import { appLogger } from "@/lib/logger";
import { cancelWorkflowRun, preflightWorkflow, runWorkflow } from "@/lib/tauri/commands";

import type { WorkflowDefinition } from "./types";
import { buildRunFromNodeIds } from "./workflowGraphUtils";
import { getErrorMessage } from "./workflowErrors";
import { syncPendingManualInputFromRun } from "./workflowManualInput";
import { useWorkflowStore } from "./workflowStore";

interface WorkflowRunValidation {
  canRun: boolean;
}

interface UseWorkflowRunParams {
  onCloseDebugMenu: () => void;
  projectRootPath: string;
  runBlockingReason: string | undefined;
  runValidation: WorkflowRunValidation;
  selectedWorkflowNodeIds: string[];
  setMessage: (message: string) => void;
  workflow: WorkflowDefinition;
}

interface UseWorkflowRunResult {
  handleCancelRun: () => Promise<void>;
  handleRunFromSelectedNode: () => Promise<void>;
  handleRunWorkflow: () => Promise<void>;
}

/// 工作流运行链路：整体运行、从选中节点运行、取消运行。
/// 运行态（runs/isRunning/activeRunId/selectedRun/logPane）统一来自 workflowStore，
/// 仅本地提示文案与调试菜单开关通过参数注入。
export function useWorkflowRun({
  onCloseDebugMenu,
  projectRootPath,
  runBlockingReason,
  runValidation,
  selectedWorkflowNodeIds,
  setMessage,
  workflow,
}: UseWorkflowRunParams): UseWorkflowRunResult {
  const setSelectedRun = useWorkflowStore((state) => state.setSelectedRun);
  const setRuns = useWorkflowStore((state) => state.setRuns);
  const setIsRunning = useWorkflowStore((state) => state.setIsRunning);
  const setActiveRunId = useWorkflowStore((state) => state.setActiveRunId);
  const setLogPaneState = useWorkflowStore((state) => state.setLogPaneState);
  const setPendingManualInput = useWorkflowStore((state) => state.setPendingManualInput);

  async function applyAwaitingInputState(runId: string) {
    setActiveRunId(runId);
    try {
      const pending = await syncPendingManualInputFromRun(projectRootPath, workflow.id);
      setPendingManualInput(pending);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      await appLogger.error("读取人工节点候选项失败", {
        errorMessage,
        runId,
        scope: "workflow.manualInput",
        workflowId: workflow.id,
      });
    }
  }

  async function handleRunWorkflow() {
    if (!runValidation.canRun) {
      setMessage(runBlockingReason || "当前工作流无法运行。");
      return;
    }

    setIsRunning(true);
    setMessage("工作流正在运行...");

    let awaitingInput = false;
    try {
      await preflightWorkflow(projectRootPath, workflow);
      const run = await runWorkflow(projectRootPath, workflow);
      awaitingInput = run.status === "awaiting_input";
      setSelectedRun(run);
      setRuns((currentRuns) => [run, ...currentRuns.filter((item) => item.id !== run.id)]);
      setLogPaneState("normal");
      if (awaitingInput) {
        await applyAwaitingInputState(run.id);
      } else {
        setPendingManualInput(undefined);
      }
      setMessage(
        run.status === "succeeded"
          ? "工作流运行完成。"
          : awaitingInput
            ? "工作流已暂停，等待人工选择。"
            : `工作流运行结束：${run.error || run.status}`,
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessage(`运行失败：${errorMessage}`);
      await appLogger.error("运行工作流失败", {
        errorMessage,
        scope: "workflow.run",
        workflowId: workflow.id,
      });
    } finally {
      setIsRunning(false);
      // 暂停在人工节点时保留 activeRunId，便于后续恢复/取消。
      if (!awaitingInput) {
        setActiveRunId(undefined);
      }
    }
  }

  async function handleRunFromSelectedNode() {
    const nodeId = selectedWorkflowNodeIds[0];

    if (!nodeId) {
      setMessage("请先选中一个节点。");
      return;
    }

    if (!runValidation.canRun) {
      setMessage(runBlockingReason || "当前工作流无法运行。");
      return;
    }

    const nodeIds = buildRunFromNodeIds(nodeId, workflow.edges);
    onCloseDebugMenu();
    setIsRunning(true);
    setMessage("正在从选中节点运行...");

    let awaitingInput = false;
    try {
      await preflightWorkflow(projectRootPath, workflow, nodeIds);
      const run = await runWorkflow(projectRootPath, workflow, nodeIds);
      awaitingInput = run.status === "awaiting_input";
      setSelectedRun(run);
      setRuns((currentRuns) => [run, ...currentRuns.filter((item) => item.id !== run.id)]);
      setLogPaneState("normal");
      if (awaitingInput) {
        await applyAwaitingInputState(run.id);
      } else {
        setPendingManualInput(undefined);
      }
      setMessage(
        run.status === "succeeded"
          ? "局部运行完成。"
          : awaitingInput
            ? "工作流已暂停，等待人工选择。"
            : `局部运行结束：${run.error || run.status}`,
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessage(`局部运行失败：${errorMessage}`);
      await appLogger.error("从节点运行工作流失败", {
        errorMessage,
        nodeId,
        scope: "workflow.runFromNode",
        workflowId: workflow.id,
      });
    } finally {
      setIsRunning(false);
      if (!awaitingInput) {
        setActiveRunId(undefined);
      }
    }
  }

  async function handleCancelRun() {
    const activeRunId = useWorkflowStore.getState().activeRunId;

    if (!activeRunId) {
      setMessage("当前没有可取消的运行。");
      return;
    }

    try {
      await cancelWorkflowRun(projectRootPath, activeRunId);
      setMessage("已发送停止请求。");
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessage(`取消失败：${errorMessage}`);
      await appLogger.error("取消工作流失败", {
        errorMessage,
        runId: activeRunId,
        scope: "workflow.cancel",
        workflowId: workflow.id,
      });
    }
  }

  return { handleCancelRun, handleRunFromSelectedNode, handleRunWorkflow };
}
