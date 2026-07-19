import "@xyflow/react/dist/style.css";

import {
  Bug,
  ChevronDown,
  ChevronsUp,
  Download,
  FileDown,
  FilePlus2,
  FolderOpen,
  Group,
  HelpCircle,
  PanelLeftClose,
  PanelRightClose,
  Play,
  Save,
  SlidersHorizontal,
  Square,
  Upload,
  UploadCloud,
  Workflow,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CanvasPanel, InspectorPanel, Toolbar } from "@/components/shared";
import { appLogger } from "@/lib/logger";
import {
  cancelWorkflowRun,
  getWorkflowRun,
  listCharacterSummaries,
  listWorkflowDefinitions,
  listWorkflowNodeDescriptors,
  listWorkflowRuns,
  resumeWorkflowRun,
  retryWorkflowNode,
  runWorkflow,
} from "@/lib/tauri/commands";
import { useWorkspaceStore } from "@/stores/workspaceStore";

import type { PipelineProject } from "../projects/types";
import { getWorkflowNodeDefinition, initWorkflowNodeRegistry } from "./nodeCatalog";
import type { WorkflowDefinition, WorkflowNodeKind, WorkflowRun, WorkflowTemplate } from "./types";
import { WorkflowCanvas, type WorkflowCanvasHandle } from "./WorkflowCanvas";
import { confirmDiscardDirtyChanges } from "./workflowFileOps";
import { bindWorkflowEventListeners, mergeNodeRunUpdate } from "./workflowEvents";
import { pickPreferredWorkflowRun, syncPendingManualInputFromRun, toPendingManualInput } from "./workflowManualInput";
import { WorkflowInspector } from "./WorkflowInspector";
import { WorkflowLogDrawer } from "./WorkflowLogDrawer";
import { WorkflowNodePalette } from "./WorkflowNodePalette";
import { WorkflowOpenDialog } from "./WorkflowOpenDialog";
import { WorkflowResizableLayout } from "./WorkflowResizableLayout";
import { WorkflowSaveAsDialog } from "./WorkflowSaveAsDialog";
import { getWorkflowRunStatusLabel } from "./workflowLabels";
import { createGroupFromSelection, topologicalOrderWithinGroup } from "./workflowGrouping";
import {
  copyWorkflowSelection,
  createWorkflowNode,
  duplicateWorkflowNodes,
  pasteWorkflowClipboard,
  type WorkflowClipboardPayload,
} from "./workflowClipboard";
import { setRunWorkflowGroupHandler } from "./workflowCanvasCallbacks";
import { WorkflowNodeSearchDialog } from "./WorkflowNodeSearchDialog";
import { applyWorkflowLayoutMode } from "./workflowLayoutApply";
import {
  clearWorkflowDraft,
  readWorkflowDraft,
  shouldOfferDraftRecovery,
  type WorkflowDraftRecord,
} from "./workflowDraft";
import { useWorkflowDraftAutosave } from "./useWorkflowDraftAutosave";
import { useWorkflowFileOps } from "./useWorkflowFileOps";
import { useWorkflowKeyboardShortcuts } from "./useWorkflowKeyboardShortcuts";
import { useWorkflowRun } from "./useWorkflowRun";
import { getErrorMessage } from "./workflowErrors";
import { createBlankWorkflow } from "./workflowFactory";
import { WorkflowKeyboardShortcutsDialog } from "./WorkflowKeyboardShortcutsDialog";
import { WorkflowManualGateDialog } from "./WorkflowManualGateDialog";
import { getPrimaryRunBlockingReason, validateWorkflowForRun } from "./workflowRunValidation";
import { cloneWorkflowTemplateDefinition } from "./workflowTemplateClone";
import { workflowTemplates } from "./workflowTemplates";
import { readLastWorkflowId, writeLastWorkflowId } from "./workflowSession";
import { useWorkflowStore } from "./workflowStore";

import "./WorkflowWorkbench.css";

const EMPTY_NODE_RUNS: WorkflowRun["nodeRuns"] = [];

interface WorkflowWorkbenchViewProps {
  isActive?: boolean;
  project: PipelineProject;
}

export function WorkflowWorkbenchView({ isActive = true, project }: WorkflowWorkbenchViewProps) {
  const canvasRef = useRef<WorkflowCanvasHandle>(null);
  const currentWorkflow = useWorkflowStore((state) => state.currentWorkflow);
  const isDirty = useWorkflowStore((state) => state.isDirty);
  const markClean = useWorkflowStore((state) => state.markClean);
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const selectedNodeIds = useWorkflowStore((state) => state.selectedNodeIds);
  const selectedRun = useWorkflowStore((state) => state.selectedRun);
  const layout = useWorkflowStore((state) => state.layout);
  const setActivePanel = useWorkspaceStore((state) => state.setActivePanel);
  const openCharacterWorkshop = useWorkspaceStore((state) => state.openCharacterWorkshop);
  const workflowOpenIntent = useWorkspaceStore((state) => state.workflowOpenIntent);
  const clearWorkflowOpenIntent = useWorkspaceStore((state) => state.clearWorkflowOpenIntent);
  const setCurrentWorkflow = useWorkflowStore((state) => state.setCurrentWorkflow);
  const setLeftPaneState = useWorkflowStore((state) => state.setLeftPaneState);
  const setLogPaneState = useWorkflowStore((state) => state.setLogPaneState);
  const setRightPaneState = useWorkflowStore((state) => state.setRightPaneState);
  const setSelection = useWorkflowStore((state) => state.setSelection);
  const setSelectedRun = useWorkflowStore((state) => state.setSelectedRun);
  const undo = useWorkflowStore((state) => state.undo);
  const redo = useWorkflowStore((state) => state.redo);
  const canUndo = useWorkflowStore((state) => state.historyPast.length > 0);
  const canRedo = useWorkflowStore((state) => state.historyFuture.length > 0);
  const updateCurrentWorkflow = useWorkflowStore((state) => state.updateCurrentWorkflow);
  const runs = useWorkflowStore((state) => state.runs);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const activeRunId = useWorkflowStore((state) => state.activeRunId);
  const resetWorkflowSessionForProject = useWorkflowStore((state) => state.resetWorkflowSessionForProject);
  const setRuns = useWorkflowStore((state) => state.setRuns);
  const setIsRunning = useWorkflowStore((state) => state.setIsRunning);
  const setActiveRunId = useWorkflowStore((state) => state.setActiveRunId);
  const pendingManualInput = useWorkflowStore((state) => state.pendingManualInput);
  const setPendingManualInput = useWorkflowStore((state) => state.setPendingManualInput);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [message, setMessage] = useState("");
  const [definitionsLoading, setDefinitionsLoading] = useState(false);
  const [showDefinitionsLoading, setShowDefinitionsLoading] = useState(false);
  const [isRetryingNode, setIsRetryingNode] = useState(false);
  const [openDialogVisible, setOpenDialogVisible] = useState(false);
  const [saveAsDialogVisible, setSaveAsDialogVisible] = useState(false);
  const [nodeSearchVisible, setNodeSearchVisible] = useState(false);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const [debugMenuOpen, setDebugMenuOpen] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);
  const [resumingManualGate, setResumingManualGate] = useState(false);
  const [clipboard, setClipboard] = useState<WorkflowClipboardPayload | null>(null);
  const [characters, setCharacters] = useState<Array<{ id: string; label: string }>>([]);
  const [pendingDraftOffer, setPendingDraftOffer] = useState<{
    draft: WorkflowDraftRecord;
    savedDefinition: WorkflowDefinition;
  } | null>(null);
  const projectKey = project.slug || project.rootPath;
  const fallbackWorkflowRef = useRef<WorkflowDefinition | undefined>(undefined);
  const wasActiveRef = useRef(isActive);

  if (!currentWorkflow && !fallbackWorkflowRef.current) {
    fallbackWorkflowRef.current = createBlankWorkflow();
  }

  const workflow = currentWorkflow ?? fallbackWorkflowRef.current!;
  const workflowRef = useRef(workflow);
  workflowRef.current = workflow;
  const isWorkflowPersisted = useMemo(
    () => isPersistedWorkflow(workflow, workflows),
    [workflow.createdAt, workflow.id, workflow.updatedAt, workflows],
  );
  const selectedNode = workflow.nodes.find((node) => node.id === selectedNodeId);
  const nodeRuns = selectedRun?.nodeRuns ?? EMPTY_NODE_RUNS;
  const selectedNodeRun = nodeRuns.find((nodeRun) => nodeRun.nodeId === selectedNodeId);
  const errorCount = nodeRuns.filter((nodeRun) => nodeRun.error).length;
  const groupableNodeCount = useMemo(
    () =>
      selectedNodeIds.filter((nodeId) => {
        const node = workflow.nodes.find((item) => item.id === nodeId);
        return node && !node.parentGroupId;
      }).length,
    [selectedNodeIds, workflow.nodes],
  );
  const runValidation = useMemo(() => validateWorkflowForRun(workflow), [workflow]);
  const runBlockingReason = getPrimaryRunBlockingReason(runValidation);
  const canRunWorkflow = runValidation.canRun && !isRunning;
  const selectedWorkflowNodeIds = useMemo(
    () => selectedNodeIds.filter((nodeId) => workflow.nodes.some((node) => node.id === nodeId)),
    [selectedNodeIds, workflow.nodes],
  );
  const canRunFromSelectedNode = selectedWorkflowNodeIds.length === 1 && !isRunning;
  const runFromNodeReason =
    selectedWorkflowNodeIds.length === 0
      ? "请先选中一个节点。"
      : selectedWorkflowNodeIds.length > 1
        ? "只能选中一个节点。"
        : runBlockingReason;

  const handleAutoLayout = useCallback(() => {
    const layoutNodeIds = selectedNodeIds.filter((nodeId) => workflow.nodes.some((node) => node.id === nodeId));
    const nextWorkflow =
      (workflow.groups?.length ?? 0) > 0 && layoutNodeIds.length === 0
        ? applyWorkflowLayoutMode(workflow, "grouped")
        : applyWorkflowLayoutMode(workflow, "horizontal", {
            selectedNodeIds: layoutNodeIds.length > 0 ? layoutNodeIds : undefined,
          });
    updateCurrentWorkflow(nextWorkflow);
    setMessage(layoutNodeIds.length > 0 ? "已自动排布选中节点。" : "已自动排布全部节点。");
  }, [selectedNodeIds, updateCurrentWorkflow, workflow]);

  const handleCreateGroup = useCallback(() => {
    const eligibleIds = selectedNodeIds.filter((nodeId) => {
      const node = workflow.nodes.find((item) => item.id === nodeId);
      return node && !node.parentGroupId;
    });

    if (eligibleIds.length < 2) {
      setMessage("请 Shift 多选至少两个未编组的节点。");
      return;
    }

    updateCurrentWorkflow(createGroupFromSelection(workflow, eligibleIds));
    setSelection({ focusedNodeId: undefined, nodeIds: [] });
    setMessage("已创建编组。");
  }, [selectedNodeIds, setSelection, updateCurrentWorkflow, workflow]);

  const handleCopySelection = useCallback(() => {
    const workflowNodeIds = selectedNodeIds.filter((nodeId) => workflow.nodes.some((node) => node.id === nodeId));
    const clipboard = copyWorkflowSelection(workflow, workflowNodeIds);

    if (!clipboard) {
      setMessage("请先选中要复制的节点。");
      return;
    }

    setClipboard(clipboard);
    setMessage(`已复制 ${clipboard.nodes.length} 个节点。`);
  }, [selectedNodeIds, workflow]);

  const handlePasteClipboard = useCallback(
    (position?: { x: number; y: number }) => {
      if (!clipboard) {
        setMessage("剪贴板为空，请先复制节点。");
        return;
      }

      const nextWorkflow = pasteWorkflowClipboard(workflow, clipboard, {
        anchor: position,
      });
      const pastedNodeIds = nextWorkflow.nodes
        .slice(workflow.nodes.length)
        .map((node) => node.id);

      updateCurrentWorkflow(nextWorkflow);
      setSelection({
        focusedNodeId: pastedNodeIds[0],
        nodeIds: pastedNodeIds,
      });
      setMessage(`已粘贴 ${pastedNodeIds.length} 个节点。`);
    },
    [clipboard, setSelection, updateCurrentWorkflow, workflow],
  );

  const handleDuplicateSelection = useCallback(() => {
    const workflowNodeIds = selectedNodeIds.filter((nodeId) => workflow.nodes.some((node) => node.id === nodeId));
    const nextWorkflow = duplicateWorkflowNodes(workflow, workflowNodeIds);

    if (!nextWorkflow) {
      setMessage("请先选中要复制的节点。");
      return;
    }

    const pastedNodeIds = nextWorkflow.nodes.slice(workflow.nodes.length).map((node) => node.id);

    updateCurrentWorkflow(nextWorkflow);
    setSelection({
      focusedNodeId: pastedNodeIds[0],
      nodeIds: pastedNodeIds,
    });
    setMessage(`已复制并粘贴 ${pastedNodeIds.length} 个节点。`);
  }, [selectedNodeIds, setSelection, updateCurrentWorkflow, workflow]);

  const handleFocusNode = useCallback(
    (nodeId: string) => {
      const node = workflow.nodes.find((item) => item.id === nodeId);
      setSelection({ focusedNodeId: nodeId, nodeIds: [nodeId] });
      setRightPaneState("expanded");
      setLogPaneState("normal");
      canvasRef.current?.focusNode(nodeId);
      setMessage(`已定位到节点：${getWorkflowNodeDefinition(node?.kind ?? "image.input")?.label ?? nodeId}`);
    },
    [setLogPaneState, setRightPaneState, setSelection, workflow.nodes],
  );

  const handleRunGroup = useCallback(
    async (groupId: string) => {
      const memberIds = topologicalOrderWithinGroup(workflow, groupId);

      if (memberIds.length === 0) {
        setMessage("编组内没有可运行的节点。");
        return;
      }

      setIsRunning(true);
      setMessage("正在运行编组内节点...");

      try {
        const run = await runWorkflow(project.rootPath, workflow, memberIds);
        setSelectedRun(run);
        setRuns((currentRuns) => [run, ...currentRuns.filter((item) => item.id !== run.id)]);
        setLogPaneState("normal");
        if (run.status === "awaiting_input") {
          setActiveRunId(run.id);
          const pending = await syncPendingManualInputFromRun(project.rootPath, workflow.id);
          setPendingManualInput(pending);
          setMessage("工作流已暂停，等待人工选择。");
        } else {
          setActiveRunId(undefined);
          setPendingManualInput(undefined);
          setMessage(run.status === "succeeded" ? "编组运行完成。" : `编组运行结束：${run.error || run.status}`);
        }
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        setMessage(`编组运行失败：${errorMessage}`);
        await appLogger.error("运行工作流编组失败", {
          errorMessage,
          groupId,
          scope: "workflow.runGroup",
          workflowId: workflow.id,
        });
      } finally {
        setIsRunning(false);
      }
    },
    [project.rootPath, setActiveRunId, setLogPaneState, setPendingManualInput, setSelectedRun, workflow],
  );

  useEffect(() => {
    setRunWorkflowGroupHandler((groupId) => {
      void handleRunGroup(groupId);
    });

    return () => {
      setRunWorkflowGroupHandler(undefined);
    };
  }, [handleRunGroup]);

  const handleUndoShortcut = useCallback(() => {
    undo();
    setMessage("已撤销。");
  }, [undo]);
  const handleRedoShortcut = useCallback(() => {
    redo();
    setMessage("已重做。");
  }, [redo]);
  const handleOpenNodeSearch = useCallback(() => {
    setNodeSearchVisible(true);
  }, []);

  useWorkflowKeyboardShortcuts({
    canRedo,
    canUndo,
    onCopySelection: handleCopySelection,
    onCreateGroup: handleCreateGroup,
    onDuplicateSelection: handleDuplicateSelection,
    onOpenNodeSearch: handleOpenNodeSearch,
    onPasteClipboard: handlePasteClipboard,
    onRedo: handleRedoShortcut,
    onUndo: handleUndoShortcut,
  });

  useEffect(() => {
    fallbackWorkflowRef.current = undefined;
    resetWorkflowSessionForProject(project.rootPath);
    setCurrentWorkflow(createBlankWorkflow());
  }, [projectKey, project.rootPath, resetWorkflowSessionForProject, setCurrentWorkflow]);

  useEffect(() => {
    if (!definitionsLoading) {
      setShowDefinitionsLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowDefinitionsLoading(true);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [definitionsLoading]);

  useEffect(() => {
    void initWorkflowNodeRegistry(listWorkflowNodeDescriptors).then(() => {
      setCatalogReady(true);
    });
  }, []);

  useEffect(() => {
    const becameActive = isActive && !wasActiveRef.current;
    wasActiveRef.current = isActive;

    if (!becameActive) {
      return;
    }

    // 重新进入工作台时，若工作流已保存视口则交由画布恢复，避免覆盖用户的平移/缩放。
    const frameId = window.requestAnimationFrame(() => {
      if (!workflowRef.current.viewport) {
        canvasRef.current?.fitView();
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !workflowOpenIntent) {
      return;
    }

    const template = workflowTemplates.find((item) => item.id === workflowOpenIntent.templateId);
    if (template) {
      const timestamp = Date.now();
      const nextDefinition: WorkflowDefinition = {
        ...cloneWorkflowTemplateDefinition(template),
        createdAt: undefined,
        id: `${template.definition.id}-${timestamp}`,
        name: template.label,
        selectedTemplate: template.id,
        updatedAt: undefined,
      };

      if (workflowOpenIntent.characterId) {
        nextDefinition.nodes = nextDefinition.nodes.map((node) => {
          if (node.kind !== "character.load") {
            return node;
          }

          return {
            ...node,
            params: {
              ...node.params,
              characterId: workflowOpenIntent.characterId,
            },
          };
        });
      }

      setCurrentWorkflow(nextDefinition);
      setRuns([]);
      setSelectedRun(undefined);
      setMessage(`已从角色工坊载入模板：${template.label}`);
    }

    clearWorkflowOpenIntent();
  }, [
    clearWorkflowOpenIntent,
    isActive,
    setCurrentWorkflow,
    setMessage,
    setRuns,
    setSelectedRun,
    workflowOpenIntent,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function loadProjectWorkflowData() {
      setDefinitionsLoading(true);
      setPendingDraftOffer(null);

      try {
        const definitions = await listWorkflowDefinitions(project.rootPath);

        if (!isMounted) {
          return;
        }

        setWorkflows(definitions);

        const lastWorkflowId = readLastWorkflowId(projectKey);
        const preferredDefinition =
          definitions.find((definition) => definition.id === lastWorkflowId) ?? definitions[0] ?? createBlankWorkflow();

        setCurrentWorkflow(preferredDefinition);
        markClean();
        writeLastWorkflowId(projectKey, preferredDefinition.id);
        setMessage(
          definitions.length > 0 ? `已打开工作流：${preferredDefinition.name}` : "当前项目尚无已保存工作流，已创建空白画布。",
        );

        const draft = readWorkflowDraft(projectKey, preferredDefinition.id);
        if (shouldOfferDraftRecovery(preferredDefinition, draft)) {
          setPendingDraftOffer({ draft: draft!, savedDefinition: preferredDefinition });
        }
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        setMessage(`读取节点工作流失败：${errorMessage}`);
        await appLogger.error("读取节点工作流失败", {
          errorMessage,
          scope: "workflow.loadNodeWorkflow",
        });
      } finally {
        if (isMounted) {
          setDefinitionsLoading(false);
        }
      }
    }

    void loadProjectWorkflowData();

    return () => {
      isMounted = false;
    };
  }, [markClean, project.rootPath, projectKey, setCurrentWorkflow]);

  useEffect(() => {
    let isMounted = true;
    let idleHandle: number | undefined;

    function loadCharacterSummaries() {
      void listCharacterSummaries(project.rootPath)
        .then((summaries) => {
          if (!isMounted) {
            return;
          }

          setCharacters(summaries.map((record) => ({ id: record.id, label: record.displayName || record.id })));
        })
        .catch(async (error) => {
          const errorMessage = getErrorMessage(error);
          await appLogger.error("读取角色摘要失败", {
            errorMessage,
            scope: "workflow.characterSummaries",
          });
        });
    }

    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(loadCharacterSummaries, { timeout: 1200 });
    } else {
      idleHandle = window.setTimeout(loadCharacterSummaries, 0);
    }

    return () => {
      isMounted = false;
      if (idleHandle !== undefined) {
        if (typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(idleHandle);
        } else {
          window.clearTimeout(idleHandle);
        }
      }
    };
  }, [project.rootPath]);

  useWorkflowDraftAutosave(projectKey, currentWorkflow, isDirty);

  useEffect(() => {
    let isMounted = true;

    async function loadRunsForWorkflow() {
      if (!isWorkflowPersisted) {
        setRuns([]);
        setSelectedRun(undefined);
        return;
      }

      try {
        const runHistory = await listWorkflowRuns(project.rootPath, workflow.id);

        if (isMounted) {
          setRuns(runHistory);
          const preferredRun = pickPreferredWorkflowRun(runHistory, workflow.id);
          const currentRun = useWorkflowStore.getState().selectedRun;
          const nextSelectedRun =
            currentRun && currentRun.workflowId !== workflow.id
              ? preferredRun
              : currentRun?.status === "awaiting_input" && currentRun.workflowId === workflow.id
                ? currentRun
                : preferredRun;
          setSelectedRun(nextSelectedRun);

          const hasPending = Boolean(useWorkflowStore.getState().pendingManualInput);
          if (!hasPending && preferredRun?.status === "awaiting_input") {
            try {
              const pending = await syncPendingManualInputFromRun(project.rootPath, workflow.id);
              if (isMounted && pending) {
                setPendingManualInput(pending);
                setActiveRunId(preferredRun.id);
                setMessage("检测到未完成的人工选择，已恢复暂停状态。");
              }
            } catch (error) {
              const errorMessage = getErrorMessage(error);
              await appLogger.error("恢复人工节点候选项失败", {
                errorMessage,
                scope: "workflow.manualInput",
                workflowId: workflow.id,
              });
            }
          }
        }
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        await appLogger.error("读取工作流运行历史失败", {
          errorMessage,
          scope: "workflow.runHistory",
          workflowId: workflow.id,
        });
      }
    }

    void loadRunsForWorkflow();

    return () => {
      isMounted = false;
    };
  }, [isWorkflowPersisted, project.rootPath, setActiveRunId, setPendingManualInput, setRuns, setSelectedRun, workflow.id]);

  useEffect(() => {
    let dispose: (() => void) | undefined;

    void bindWorkflowEventListeners({
      onRunStarted: (payload) => {
        setActiveRunId(payload.runId);
        setSelectedRun({
          error: "",
          id: payload.runId,
          nodeRuns: workflowRef.current.nodes.map((node) => ({
            error: "",
            nodeId: node.id,
            nodeKind: node.kind,
            outputs: {},
            status: "queued",
          })),
          startedAt: Date.now(),
          status: "running",
          workflowId: payload.workflowId,
          workflowName: workflowRef.current.name,
        });
      },
      onNodeUpdate: (payload) => {
        const currentRun = useWorkflowStore.getState().selectedRun;
        setSelectedRun(mergeNodeRunUpdate(currentRun, payload));
      },
      onNodeInputRequired: (payload) => {
        setActiveRunId(payload.runId);
        setPendingManualInput(toPendingManualInput(payload));
        setLogPaneState("normal");
        setMessage("工作流已暂停，等待人工选择。");
      },
      onRunFinished: (payload) => {
        setActiveRunId(undefined);
        setPendingManualInput(undefined);

        void (async () => {
          try {
            const finishedRun = await getWorkflowRun(project.rootPath, payload.runId);
            setSelectedRun(finishedRun);
            setRuns((currentRuns) => [finishedRun, ...currentRuns.filter((item) => item.id !== finishedRun.id)]);
            setLogPaneState("normal");

            const failedCount = finishedRun.nodeRuns.filter((nodeRun) => nodeRun.error).length;
            setMessage(
              finishedRun.status === "succeeded"
                ? "工作流运行完成。"
                : `工作流运行结束：${finishedRun.error || `${failedCount} 个节点失败`}`,
            );
          } catch (error) {
            const errorMessage = getErrorMessage(error);
            setMessage(`读取运行结果失败：${errorMessage}`);
            await appLogger.error("读取工作流运行结果失败", {
              errorMessage,
              runId: payload.runId,
              scope: "workflow.runResult",
              workflowId: workflow.id,
            });
          }
        })();
      },
    }).then((unbind) => {
      dispose = unbind;
    });

    return () => {
      dispose?.();
    };
  }, [project.rootPath, setLogPaneState, setSelectedRun, workflow.id]);

  const title = useMemo(() => {
    if (showDefinitionsLoading && workflows.length === 0) {
      return `${workflow.name} · 同步工作流列表`;
    }

    return isDirty ? `${workflow.name} · 未保存` : workflow.name;
  }, [isDirty, showDefinitionsLoading, workflow.name, workflows.length]);

  function offerDraftRecoveryIfNeeded(savedDefinition: WorkflowDefinition) {
    const draft = readWorkflowDraft(projectKey, savedDefinition.id);

    if (!shouldOfferDraftRecovery(savedDefinition, draft)) {
      setPendingDraftOffer(null);
      return;
    }

    setPendingDraftOffer({ draft: draft!, savedDefinition });
  }

  function handleRestorePendingDraft() {
    if (!pendingDraftOffer) {
      return;
    }

    updateCurrentWorkflow(pendingDraftOffer.draft.definition);
    writeLastWorkflowId(projectKey, pendingDraftOffer.draft.definition.id);
    setPendingDraftOffer(null);
    setMessage(`已恢复草稿：${pendingDraftOffer.draft.definition.name}`);
  }

  function handleDiscardPendingDraft() {
    if (!pendingDraftOffer) {
      return;
    }

    clearWorkflowDraft(projectKey, pendingDraftOffer.savedDefinition.id);
    setPendingDraftOffer(null);
    setMessage(`已丢弃草稿：${pendingDraftOffer.savedDefinition.name}`);
  }

  function openWorkflowDefinition(definition: WorkflowDefinition) {
    setCurrentWorkflow(definition);
    writeLastWorkflowId(projectKey, definition.id);
    markClean();
    setMessage(`已打开工作流：${definition.name}`);
    setSelectedRun(pickPreferredWorkflowRun(runs, definition.id));
    setPendingManualInput(undefined);
    offerDraftRecoveryIfNeeded(definition);
  }

  async function handleOpenWorkflow(definition: WorkflowDefinition) {
    if (!(await confirmDiscardDirtyChanges(isDirty, "切换工作流"))) {
      return;
    }

    openWorkflowDefinition(definition);
  }

  async function handleNewWorkflow() {
    if (!(await confirmDiscardDirtyChanges(isDirty, "新建工作流"))) {
      return;
    }

    setCurrentWorkflow(createBlankWorkflow());
    setSelectedRun(undefined);
    setMessage("已创建空白工作流。");
  }

  async function handleUseTemplate(template: WorkflowTemplate) {
    if (!(await confirmDiscardDirtyChanges(isDirty, "载入模板"))) {
      return;
    }
    const timestamp = Date.now();
    const nextDefinition: WorkflowDefinition = {
      ...cloneWorkflowTemplateDefinition(template),
      createdAt: undefined,
      id: `${template.definition.id}-${timestamp}`,
      name: template.label,
      selectedTemplate: template.id,
      updatedAt: undefined,
    };

    startTransition(() => {
      setCurrentWorkflow(nextDefinition);
    });
    setRuns([]);
    setSelectedRun(undefined);
    setMessage(`已载入模板：${template.label}`);
  }

  function handleAddNode(kind: WorkflowNodeKind) {
    const definition = getWorkflowNodeDefinition(kind);
    const nextNode = createWorkflowNode(kind, workflow.nodes.length);
    const nextWorkflow = {
      ...workflow,
      nodes: [...workflow.nodes, nextNode],
    };

    updateCurrentWorkflow(nextWorkflow);
    setSelection({ focusedNodeId: nextNode.id, nodeIds: [nextNode.id] });
    setMessage(`已添加节点：${definition?.label ?? kind}`);
  }

  const {
    handleDeleteWorkflow,
    handleExportWorkflow,
    handleImportWorkflow,
    handleSaveAsWorkflow,
    handleSaveWorkflow,
  } = useWorkflowFileOps({
    canvasRef,
    isDirty,
    projectKey,
    projectRootPath: project.rootPath,
    setMessage,
    setWorkflows,
    workflow,
    workflows,
  });

  async function handleRetryNode(nodeId: string) {
    if (!selectedRun) {
      setMessage("请先选择一次运行记录。");
      return;
    }

    setIsRetryingNode(true);
    setMessage("正在重试节点...");

    try {
      const run = await retryWorkflowNode(project.rootPath, selectedRun.id, nodeId);
      setSelectedRun(run);
      setRuns((currentRuns) => [run, ...currentRuns.filter((item) => item.id !== run.id)]);
      setLogPaneState("normal");
      setMessage(run.status === "succeeded" ? "节点重试完成。" : `节点重试结束：${run.error || run.status}`);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessage(`重试失败：${errorMessage}`);
      await appLogger.error("重试工作流节点失败", {
        errorMessage,
        nodeId,
        runId: selectedRun.id,
        scope: "workflow.retryNode",
        workflowId: workflow.id,
      });
    } finally {
      setIsRetryingNode(false);
    }
  }

  const { handleCancelRun, handleRunFromSelectedNode, handleRunWorkflow } = useWorkflowRun({
    onCloseDebugMenu: () => setDebugMenuOpen(false),
    projectRootPath: project.rootPath,
    runBlockingReason,
    runValidation,
    selectedWorkflowNodeIds,
    setMessage,
    workflow,
  });

  async function handleResumeManualGate(decision: string | string[]) {
    if (!pendingManualInput) {
      return;
    }

    setResumingManualGate(true);
    setMessage("已提交人工选择，继续运行...");

    try {
      const run = await resumeWorkflowRun(
        project.rootPath,
        pendingManualInput.runId,
        pendingManualInput.nodeId,
        decision,
      );
      setPendingManualInput(undefined);
      setSelectedRun(run);
      setRuns((currentRuns) => [run, ...currentRuns.filter((item) => item.id !== run.id)]);
      if (run.status === "awaiting_input") {
        setActiveRunId(run.id);
        const nextPending = await syncPendingManualInputFromRun(project.rootPath, workflow.id);
        setPendingManualInput(nextPending);
      } else {
        setActiveRunId(undefined);
      }
      setMessage(
        run.status === "succeeded"
          ? "工作流运行完成。"
          : run.status === "awaiting_input"
            ? "工作流已暂停，等待下一个人工选择。"
            : `工作流运行结束：${run.error || run.status}`,
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessage(`继续运行失败：${errorMessage}`);
      await appLogger.error("恢复人工节点失败", {
        errorMessage,
        runId: pendingManualInput.runId,
        scope: "workflow.resumeManual",
        workflowId: workflow.id,
      });
    } finally {
      setResumingManualGate(false);
    }
  }

  async function handleCancelManualGate() {
    const pending = pendingManualInput;

    if (!pending) {
      return;
    }

    setResumingManualGate(true);

    try {
      await cancelWorkflowRun(project.rootPath, pending.runId);
      setPendingManualInput(undefined);
      setActiveRunId(undefined);
      setMessage("已取消运行。");
      try {
        const canceledRun = await getWorkflowRun(project.rootPath, pending.runId);
        setSelectedRun(canceledRun);
        setRuns((currentRuns) => [canceledRun, ...currentRuns.filter((item) => item.id !== canceledRun.id)]);
      } catch {
        // 取消后读取记录失败不阻塞 UI。
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessage(`取消失败：${errorMessage}`);
      await appLogger.error("取消人工节点运行失败", {
        errorMessage,
        runId: pending.runId,
        scope: "workflow.cancelManual",
        workflowId: workflow.id,
      });
    } finally {
      setResumingManualGate(false);
    }
  }

  return (
    <section className="workflow-workbench-view" data-density="compact" aria-label={`${project.name} 节点工作台`}>
      <header className="workflow-workbench-header">
        <Toolbar className="workflow-global-toolbar" label="节点工作台操作">
          <div className="workflow-toolbar-file">
            <Button onClick={() => void handleNewWorkflow()} title="新建工作流" type="button" variant="ghost">
              <FilePlus2 aria-hidden="true" />
              新建
            </Button>
            <Button
              aria-label="打开工作流"
              onClick={() => setOpenDialogVisible(true)}
              title="打开工作流"
              type="button"
              variant="ghost"
            >
              <FolderOpen aria-hidden="true" />
            </Button>
            <Button onClick={() => void handleSaveWorkflow()} title="保存工作流" type="button" variant="ghost">
              <Save aria-hidden="true" />
              保存
            </Button>
            <Button aria-label="另存为" onClick={() => setSaveAsDialogVisible(true)} title="另存为" type="button" variant="ghost">
              <FileDown aria-hidden="true" />
            </Button>
            <Button aria-label="导出工作流" onClick={() => void handleExportWorkflow()} title="导出工作流" type="button" variant="ghost">
              <Download aria-hidden="true" />
            </Button>
            <Button aria-label="导入工作流" onClick={() => void handleImportWorkflow()} title="从 JSON 导入工作流" type="button" variant="ghost">
              <Upload aria-hidden="true" />
            </Button>
          </div>

          <div className="workflow-toolbar-run">
            <Button
              className="workflow-run-button"
              disabled={!canRunWorkflow}
              onClick={() => void handleRunWorkflow()}
              title={runBlockingReason || "运行当前工作流"}
              type="button"
            >
              <Play aria-hidden="true" />
              {isRunning ? "运行中" : "运行"}
            </Button>
            <Button
              disabled={!activeRunId}
              onClick={() => void handleCancelRun()}
              title={activeRunId ? "停止运行" : "当前没有可中断的运行"}
              type="button"
              variant="ghost"
            >
              <Square aria-hidden="true" />
              停止
            </Button>
            <Popover onOpenChange={setDebugMenuOpen} open={debugMenuOpen}>
              <PopoverTrigger asChild>
                <Button aria-label="调试工作流" title="调试工作流" type="button" variant="ghost">
                  <Bug aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="workflow-debug-menu" side="bottom" sideOffset={8}>
                <div className="workflow-debug-menu-actions">
                  <Button
                    disabled={!canRunFromSelectedNode || !runValidation.canRun}
                    onClick={() => void handleRunFromSelectedNode()}
                    size="sm"
                    title={runFromNodeReason || "从此节点运行"}
                    type="button"
                    variant="outline"
                  >
                    <Play aria-hidden="true" />
                    从此节点运行
                  </Button>
                </div>
                <p className="workflow-muted workflow-debug-menu-hint">
                  重新执行选中节点及其下游；未纳入范围的节点沿用缓存结果。
                </p>
              </PopoverContent>
            </Popover>
            <Button aria-label="发布工作流" disabled title="发布工作流" type="button" variant="ghost">
              <UploadCloud aria-hidden="true" />
            </Button>
          </div>

          <span className="workflow-toolbar-spacer" />

          <div className="workflow-toolbar-view">
            <Button
              disabled={groupableNodeCount < 2}
              onClick={handleCreateGroup}
              title="将选中的节点编组（Shift 多选，Ctrl+G）"
              type="button"
              variant="ghost"
            >
              <Group aria-hidden="true" />
              编组
            </Button>
            <Button
              aria-label="快捷键帮助"
              onClick={() => setShortcutsVisible(true)}
              title="快捷键"
              type="button"
              variant="ghost"
            >
              <HelpCircle aria-hidden="true" />
            </Button>
            <span className="workflow-run-chip" data-status={isRunning ? "running" : selectedRun?.status ?? "queued"}>
              {isRunning ? "运行中" : selectedRun ? getWorkflowRunStatusLabel(selectedRun.status) : "就绪"}
            </span>
            <Button
              aria-label={layout.leftPane === "collapsed" ? "展开节点库" : "折叠节点库"}
              onClick={() => setLeftPaneState(layout.leftPane === "collapsed" ? "expanded" : "collapsed")}
              title={layout.leftPane === "collapsed" ? "展开节点库" : "折叠节点库"}
              type="button"
              variant="ghost"
            >
              <PanelLeftClose aria-hidden="true" />
            </Button>
            <Button
              aria-label={layout.rightPane === "collapsed" ? "展开节点设置" : "折叠节点设置"}
              onClick={() => setRightPaneState(layout.rightPane === "collapsed" ? "expanded" : "collapsed")}
              title={layout.rightPane === "collapsed" ? "展开节点设置" : "折叠节点设置"}
              type="button"
              variant="ghost"
            >
              <PanelRightClose aria-hidden="true" />
            </Button>
            <Button
              aria-label="切换日志高度"
              onClick={() => setLogPaneState(getNextLogPaneState(layout.logPane))}
              title="切换日志高度"
              type="button"
              variant="ghost"
            >
              {layout.logPane === "max" ? <ChevronsUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            </Button>
          </div>
        </Toolbar>
        <div className="workflow-title-row">
          <h2 className="workflow-type-page-title">{title}</h2>
          <span className="workflow-type-caption">{message || "用节点编排资产生产流程，运行队列会写入项目本地缓存和历史记录。"}</span>
        </div>
        {pendingDraftOffer ? (
          <div className="workflow-draft-banner" role="status">
            <span>
              检测到「{pendingDraftOffer.savedDefinition.name}」的未保存草稿（
              {new Date(pendingDraftOffer.draft.savedAt).toLocaleString()}）
            </span>
            <div className="workflow-draft-banner-actions">
              <Button onClick={handleRestorePendingDraft} size="sm" type="button" variant="default">
                恢复草稿
              </Button>
              <Button onClick={handleDiscardPendingDraft} size="sm" type="button" variant="outline">
                丢弃
              </Button>
              <Button onClick={() => setPendingDraftOffer(null)} size="sm" type="button" variant="ghost">
                稍后
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      <WorkflowResizableLayout
        bottom={
          <WorkflowLogDrawer
            errorCount={errorCount}
            onFocusNode={handleFocusNode}
            onSelectRun={setSelectedRun}
            run={selectedRun}
            runs={runs}
            selectedRunId={selectedRun?.id}
          />
        }
        errorCount={errorCount}
        left={
          <InspectorPanel icon={Workflow} label="节点库" title="节点库">
            <WorkflowNodePalette
              catalogReady={catalogReady}
              definitionsLoading={showDefinitionsLoading}
              onAddNode={handleAddNode}
              onDeleteWorkflow={(workflowId) => void handleDeleteWorkflow(workflowId)}
              onOpenWorkflow={(definition) => void handleOpenWorkflow(definition)}
              onUseTemplate={(template) => void handleUseTemplate(template)}
              workflows={workflows}
            />
          </InspectorPanel>
        }
        main={
          <CanvasPanel className="workflow-canvas-panel" label="节点画布">
            <WorkflowCanvas
              ref={canvasRef}
              canPasteClipboard={Boolean(clipboard)}
              canRedo={canRedo}
              canUndo={canUndo}
              definition={workflow}
              graphResetKey={workflow.id}
              groupableNodeCount={groupableNodeCount}
              nodeRuns={nodeRuns}
              onAutoLayout={handleAutoLayout}
              onCopySelection={handleCopySelection}
              onCreateGroup={handleCreateGroup}
              onDefinitionChange={updateCurrentWorkflow}
              onDuplicateSelection={handleDuplicateSelection}
              onOpenNodeSearch={() => setNodeSearchVisible(true)}
              onPasteClipboard={handlePasteClipboard}
              onRedo={() => {
                redo();
                setMessage("已重做。");
              }}
              onUndo={() => {
                undo();
                setMessage("已撤销。");
              }}
              selectedNodeId={selectedNodeId}
            />
          </CanvasPanel>
        }
        right={
          <InspectorPanel icon={SlidersHorizontal} label="节点设置" title="节点设置">
            <WorkflowInspector
              characters={characters}
              definition={workflow}
              isRetryingNode={isRetryingNode}
              onDefinitionChange={updateCurrentWorkflow}
              onOpenAssetTools={() => setActivePanel("assetTools")}
              onOpenCharacters={() => {
                const characterId = selectedNode?.params.characterId;
                openCharacterWorkshop({
                  characterId: typeof characterId === "string" ? characterId : undefined,
                  mode: "production",
                  productionTab: getProductionTabForNodeKind(selectedNode?.kind),
                });
              }}
              onRetryNode={(nodeId) => void handleRetryNode(nodeId)}
              projectRoot={project.rootPath}
              selectedNode={selectedNode}
              selectedNodeRun={selectedNodeRun}
              selectedRun={selectedRun}
            />
          </InspectorPanel>
        }
      />

      <WorkflowOpenDialog
        onClose={() => setOpenDialogVisible(false)}
        onOpen={(definition) => void handleOpenWorkflow(definition)}
        open={openDialogVisible}
        workflows={workflows}
      />
      <WorkflowSaveAsDialog
        defaultName={`${workflow.name} 副本`}
        onClose={() => setSaveAsDialogVisible(false)}
        onConfirm={(name) => void handleSaveAsWorkflow(name)}
        open={saveAsDialogVisible}
      />
      <WorkflowNodeSearchDialog
        catalogReady={catalogReady}
        onClose={() => setNodeSearchVisible(false)}
        onPickNode={handleAddNode}
        open={nodeSearchVisible}
      />
      <WorkflowKeyboardShortcutsDialog onClose={() => setShortcutsVisible(false)} open={shortcutsVisible} />
      <WorkflowManualGateDialog
        onCancel={() => void handleCancelManualGate()}
        onConfirm={(decision) => void handleResumeManualGate(decision)}
        pending={pendingManualInput}
        projectRoot={project.rootPath}
        submitting={resumingManualGate}
      />
    </section>
  );
}

function getNextLogPaneState(state: "collapsed" | "max" | "normal") {
  if (state === "collapsed") {
    return "normal";
  }

  if (state === "normal") {
    return "max";
  }

  return "collapsed";
}

function getProductionTabForNodeKind(_kind: string | undefined) {
  return "actions" as const;
}

function isPersistedWorkflow(workflow: WorkflowDefinition, workflows: WorkflowDefinition[]) {
  return workflows.some((item) => item.id === workflow.id) || Boolean(workflow.createdAt || workflow.updatedAt);
}
