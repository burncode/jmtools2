import type { Connection, Edge, Node, NodeTypes, OnSelectionChangeParams } from "@xyflow/react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

import { isValidWorkflowConnection } from "./connectionValidation";
import type { WorkflowDefinition, WorkflowEdge, WorkflowNodeRun } from "./types";
import {
  clientToFlowPosition,
  computeDefinitionVisualSignature,
  getMiniMapNodeColor,
  inferConnectionDataType,
  mergeDefinitionNodes,
  patchEdgesWithRuns,
  patchNodesWithRuns,
  readViewport,
  snapCoordinate,
  toReactFlowEdges,
  toReactFlowNodes,
  viewportMatches,
} from "./workflowCanvasSync";
import { confirmWorkflowAction } from "./workflowFileOps";
import { ungroup } from "./workflowGrouping";
import { useWorkflowStore } from "./workflowStore";
import { WorkflowCanvasContextMenu, type WorkflowCanvasContextMenuState } from "./WorkflowCanvasContextMenu";
import { WorkflowCanvasFloatingToolbar } from "./WorkflowCanvasFloatingToolbar";
import { WorkflowGroupNode } from "./WorkflowGroupNode";
import { WorkflowNodeCard } from "./WorkflowNodeCard";

interface WorkflowCanvasProps {
  canPasteClipboard: boolean;
  canRedo: boolean;
  canUndo: boolean;
  definition: WorkflowDefinition;
  graphResetKey?: string;
  groupableNodeCount: number;
  nodeRuns: WorkflowNodeRun[];
  onAutoLayout: () => void;
  onCopySelection: () => void;
  onCreateGroup: () => void;
  onDefinitionChange: (definition: WorkflowDefinition) => void;
  onDuplicateSelection: () => void;
  onOpenNodeSearch: () => void;
  onPasteClipboard: (position?: { x: number; y: number }) => void;
  onRedo: () => void;
  onUndo: () => void;
  selectedNodeId?: string;
}

export interface WorkflowCanvasHandle {
  clearCanvasSelection: () => void;
  fitView: () => void;
  focusNode: (nodeId: string) => void;
}

const nodeTypes = {
  workflowGroup: WorkflowGroupNode,
  workflowNode: WorkflowNodeCard,
} satisfies NodeTypes;

const reactFlowProOptions = { hideAttribution: true } as const;
const workflowSnapGrid: [number, number] = [16, 16];

export const WorkflowCanvas = forwardRef<WorkflowCanvasHandle, WorkflowCanvasProps>(function WorkflowCanvas(
  {
    canPasteClipboard,
    canRedo,
    canUndo,
    definition,
    graphResetKey,
    groupableNodeCount,
    nodeRuns,
    onAutoLayout,
    onCopySelection,
    onCreateGroup,
    onDefinitionChange,
    onDuplicateSelection,
    onOpenNodeSearch,
    onPasteClipboard,
    onRedo,
    onUndo,
    selectedNodeId,
  },
  ref,
) {
  const bridgeRef = useRef<Pick<WorkflowCanvasHandle, "fitView" | "focusNode">>(null);
  const clearSelection = useWorkflowStore((state) => state.clearSelection);
  const setSelection = useWorkflowStore((state) => state.setSelection);
  const selectedNodeIds = useWorkflowStore((state) => state.selectedNodeIds);
  const updateWorkflowViewport = useWorkflowStore((state) => state.updateWorkflowViewport);
  const [contextMenu, setContextMenu] = useState<WorkflowCanvasContextMenuState | null>(null);
  const [pulseNodeId, setPulseNodeId] = useState<string | undefined>();
  const [nodes, setNodes, onNodesChange] = useNodesState(toReactFlowNodes(definition, pulseNodeId));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toReactFlowEdges(definition.edges, definition.nodes, []));
  const canvasView = useWorkflowStore((state) => state.canvasView);
  const definitionRef = useRef(definition);
  const nodeRunsRef = useRef(nodeRuns);
  const previousGraphResetKeyRef = useRef<string | undefined>(undefined);
  const isClearingPaneSelectionRef = useRef(false);
  const isSuppressingSelectionRestoreRef = useRef(false);
  const pendingZoomRef = useRef<number | null>(null);
  const zoomWriteFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  definitionRef.current = definition;
  nodeRunsRef.current = nodeRuns;

  useImperativeHandle(
    ref,
    () => ({
      clearCanvasSelection: () => {
        isClearingPaneSelectionRef.current = true;
        isSuppressingSelectionRestoreRef.current = true;
        setNodes((currentNodes) => currentNodes.map((node) => ({ ...node, selected: false })));
        setEdges((currentEdges) => currentEdges.map((edge) => ({ ...edge, selected: false })));
        window.requestAnimationFrame(() => {
          isClearingPaneSelectionRef.current = false;
          isSuppressingSelectionRestoreRef.current = false;
        });
      },
      fitView: () => {
        bridgeRef.current?.fitView();
      },
      focusNode: (nodeId: string) => {
        bridgeRef.current?.focusNode(nodeId);
      },
    }),
    [setEdges, setNodes],
  );

  const definitionStructureKey = useMemo(
    () => `${computeDefinitionVisualSignature(definition)}:${pulseNodeId ?? ""}`,
    [definition, pulseNodeId],
  );

  useEffect(
    () => () => {
      if (zoomWriteFrameRef.current !== null) {
        window.cancelAnimationFrame(zoomWriteFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const currentDefinition = definitionRef.current;
    const previousGraphResetKey = previousGraphResetKeyRef.current;
    previousGraphResetKeyRef.current = graphResetKey;

    const shouldHardReset =
      graphResetKey !== undefined &&
      previousGraphResetKey !== undefined &&
      previousGraphResetKey !== graphResetKey;

    if (shouldHardReset) {
      setNodes(() =>
        patchNodesWithRuns(
          toReactFlowNodes(currentDefinition, pulseNodeId).map((node) => ({
            ...node,
            selected: selectedNodeIds.includes(node.id),
          })),
          nodeRunsRef.current,
          pulseNodeId,
        ),
      );
      setEdges(toReactFlowEdges(currentDefinition.edges, currentDefinition.nodes, nodeRunsRef.current));
      return;
    }

    // 拖拽期间由 onNodesChange 维护节点状态；此时若用 definition 合并会替换节点引用，
    // 导致 React Flow 报 #015（节点未初始化）。
    if (isDraggingRef.current) {
      return;
    }

    setNodes((currentNodes) =>
      patchNodesWithRuns(
        mergeDefinitionNodes(currentNodes, currentDefinition, pulseNodeId),
        nodeRunsRef.current,
        pulseNodeId,
      ),
    );
    setEdges((currentEdges) =>
      patchEdgesWithRuns(currentEdges, currentDefinition.edges, currentDefinition.nodes, nodeRunsRef.current),
    );
  }, [definitionStructureKey, graphResetKey, pulseNodeId, selectedNodeIds, setEdges, setNodes]);

  useEffect(() => {
    setNodes((currentNodes) => patchNodesWithRuns(currentNodes, nodeRunsRef.current, pulseNodeId));
    setEdges((currentEdges) =>
      patchEdgesWithRuns(
        currentEdges,
        definitionRef.current.edges,
        definitionRef.current.nodes,
        nodeRunsRef.current,
      ),
    );
  }, [nodeRuns, pulseNodeId, setEdges, setNodes]);

  useEffect(() => {
    if (!pulseNodeId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPulseNodeId(undefined);
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pulseNodeId]);

  useEffect(() => {
    function handleResizeObserverLoopError(event: ErrorEvent) {
      if (event.message === "ResizeObserver loop completed with undelivered notifications.") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    window.addEventListener("error", handleResizeObserverLoopError);

    return () => {
      window.removeEventListener("error", handleResizeObserverLoopError);
    };
  }, []);

  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target) {
      return;
    }

    const currentDefinition = definitionRef.current;

    if (
      !isValidWorkflowConnection(
        currentDefinition,
        connection.source,
        connection.target,
        connection.sourceHandle,
        connection.targetHandle,
      )
    ) {
      return;
    }

    const nextEdge: WorkflowEdge = {
      dataType: inferConnectionDataType(currentDefinition.nodes, connection.source, connection.sourceHandle),
      fromNodeId: connection.source,
      fromPort: connection.sourceHandle ?? "output",
      id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
      toPort: connection.targetHandle ?? "input",
      toNodeId: connection.target,
    };
    const nextEdges = [...currentDefinition.edges, nextEdge];

    setEdges((currentEdges) =>
      addEdge(
        {
          className: `workflow-flow-edge workflow-flow-edge-${nextEdge.dataType}`,
          source: nextEdge.fromNodeId,
          sourceHandle: nextEdge.fromPort,
          target: nextEdge.toNodeId,
          targetHandle: nextEdge.toPort,
        },
        currentEdges,
      ),
    );
    onDefinitionChange({ ...currentDefinition, edges: nextEdges });
  }

  function handleDragStop(_: unknown, node: Node) {
    const currentDefinition = definitionRef.current;
    const snapEnabled = useWorkflowStore.getState().canvasView.snapToGrid;
    const nextX = snapCoordinate(node.position.x, snapEnabled);
    const nextY = snapCoordinate(node.position.y, snapEnabled);

    if (node.type === "workflowGroup") {
      onDefinitionChange({
        ...currentDefinition,
        groups: (currentDefinition.groups ?? []).map((group) =>
          group.id === node.id
            ? {
                ...group,
                position: {
                  x: nextX,
                  y: nextY,
                },
              }
            : group,
        ),
      });
      return;
    }

    const nextNodes = currentDefinition.nodes.map((workflowNode) =>
      workflowNode.id === node.id
        ? {
            ...workflowNode,
            position: {
              x: nextX,
              y: nextY,
            },
          }
        : workflowNode,
    );

    onDefinitionChange({ ...currentDefinition, nodes: nextNodes });
  }

  async function handleBeforeDelete(params: { edges: Edge[]; nodes: Node[] }) {
    const nodeCount = params.nodes.length;
    const edgeCount = params.edges.length;

    if (nodeCount === 0 && edgeCount === 0) {
      return false;
    }

    if (nodeCount <= 1 && edgeCount === 0) {
      return true;
    }

    return confirmWorkflowAction(`确定删除 ${nodeCount} 个节点和 ${edgeCount} 条连线吗？`, "删除节点");
  }

  function handleNodesDelete(deletedNodes: Node[]) {
    if (deletedNodes.length === 0) {
      return;
    }

    let nextDefinition = definitionRef.current;

    for (const node of deletedNodes) {
      if (node.type === "workflowGroup") {
        nextDefinition = ungroup(nextDefinition, node.id);
      }
    }

    const deletedIds = new Set(deletedNodes.filter((node) => node.type === "workflowNode").map((node) => node.id));

    if (deletedIds.size === 0 && deletedNodes.every((node) => node.type === "workflowGroup")) {
      onDefinitionChange(nextDefinition);
      return;
    }

    onDefinitionChange({
      ...nextDefinition,
      edges: nextDefinition.edges.filter(
        (edge) => !deletedIds.has(edge.fromNodeId) && !deletedIds.has(edge.toNodeId),
      ),
      nodes: nextDefinition.nodes.filter((node) => !deletedIds.has(node.id)),
    });

    if (selectedNodeId && deletedIds.has(selectedNodeId)) {
      clearSelection();
    }
  }

  function handleEdgesDelete(deletedEdges: Edge[]) {
    const deletedIds = new Set(deletedEdges.map((edge) => edge.id));

    if (deletedIds.size === 0) {
      return;
    }

    const currentDefinition = definitionRef.current;

    onDefinitionChange({
      ...currentDefinition,
      edges: currentDefinition.edges.filter((edge) => !deletedIds.has(edge.id)),
    });
  }

  function handleSelectionChange(params: OnSelectionChangeParams) {
    const selectedCanvasIds = params.nodes
      .filter((node) => node.type === "workflowNode" || node.type === "workflowGroup")
      .map((node) => node.id);
    const workflowNodeIds = params.nodes
      .filter((node) => node.type === "workflowNode")
      .map((node) => node.id);
    const { selectedNodeId: currentSelectedNodeId, selectedNodeIds: currentSelectedNodeIds } =
      useWorkflowStore.getState();

    if (isClearingPaneSelectionRef.current) {
      return;
    }

    if (
      isSuppressingSelectionRestoreRef.current &&
      currentSelectedNodeIds.length === 0 &&
      selectedCanvasIds.length > 0
    ) {
      isClearingPaneSelectionRef.current = true;
      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.selected ? { ...node, selected: false } : node)),
      );
      window.requestAnimationFrame(() => {
        isClearingPaneSelectionRef.current = false;
      });
      return;
    }

    const focusedNodeId =
      workflowNodeIds.length === 0
        ? undefined
        : workflowNodeIds.includes(currentSelectedNodeId ?? "")
          ? currentSelectedNodeId
          : workflowNodeIds[0];

    if (
      selectedCanvasIds.length === currentSelectedNodeIds.length &&
      selectedCanvasIds.every((nodeId, index) => nodeId === currentSelectedNodeIds[index]) &&
      focusedNodeId === currentSelectedNodeId
    ) {
      return;
    }

    setSelection({ focusedNodeId, nodeIds: selectedCanvasIds });
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        selected: selectedCanvasIds.includes(node.id),
      })),
    );
  }

  function handleNodeDragStart() {
    isDraggingRef.current = true;
  }

  function handleNodeDragStop(_: unknown, node: Node) {
    handleDragStop(_, node);
    isDraggingRef.current = false;

    // 拖拽期间跳过的运行态/视觉同步在松手后补一次。
    const currentDefinition = definitionRef.current;
    setNodes((currentNodes) => {
      const mergedNodes = mergeDefinitionNodes(currentNodes, currentDefinition, pulseNodeId);
      return patchNodesWithRuns(mergedNodes, nodeRunsRef.current, pulseNodeId);
    });
    setEdges((currentEdges) =>
      patchEdgesWithRuns(currentEdges, currentDefinition.edges, currentDefinition.nodes, nodeRunsRef.current),
    );
  }

  // 缩放变化在视口移动期间会高频触发；这里按帧合并写入 store，避免每个 tick 都 setState
  // 引发整画布及节点工具条/Popover 的重渲染风暴（黑屏崩溃的诱因之一）。
  function scheduleViewportZoomWrite(zoom: number) {
    pendingZoomRef.current = zoom;

    if (zoomWriteFrameRef.current !== null) {
      return;
    }

    zoomWriteFrameRef.current = window.requestAnimationFrame(() => {
      zoomWriteFrameRef.current = null;
      const nextZoom = pendingZoomRef.current;
      pendingZoomRef.current = null;

      if (nextZoom === null) {
        return;
      }

      const workflowStore = useWorkflowStore.getState();
      if (nextZoom !== workflowStore.canvasView.zoom) {
        workflowStore.setCanvasView({ zoom: nextZoom }, { persist: false });
      }
    });
  }

  function handleMoveEnd(_: unknown, viewport: { x: number; y: number; zoom: number }) {
    const currentDefinition = definitionRef.current;
    const currentViewport = readViewport(currentDefinition.viewport);
    const nextZoom = Math.round(viewport.zoom * 100);
    const workflowStore = useWorkflowStore.getState();

    if (nextZoom !== workflowStore.canvasView.zoom) {
      workflowStore.setCanvasView({ zoom: nextZoom });
    } else {
      workflowStore.persistCanvasView();
    }

    if (viewportMatches(currentViewport, viewport)) {
      return;
    }

    updateWorkflowViewport(currentDefinition.id, {
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.zoom,
    });
  }

  const defaultViewport = useMemo(() => readViewport(definition.viewport), [definition.id]);

  function closeContextMenu() {
    setContextMenu(null);
  }

  function runContextAction(action: () => void) {
    action();
    closeContextMenu();
  }

  function openContextMenu(menu: WorkflowCanvasContextMenuState) {
    setContextMenu(menu);
  }

  function openNodeContextMenu(event: ReactMouseEvent, nodeId: string) {
    event.preventDefault();
    openContextMenu({
      nodeId,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handlePaneClick() {
    isClearingPaneSelectionRef.current = true;
    clearSelection();
    closeContextMenu();
    setNodes((currentNodes) => currentNodes.map((node) => ({ ...node, selected: false })));
    setEdges((currentEdges) => currentEdges.map((edge) => ({ ...edge, selected: false })));
    window.requestAnimationFrame(() => {
      isClearingPaneSelectionRef.current = false;
    });
  }

  return (
    <ReactFlowProvider>
      <ReactFlow
        className={canvasView.showEdges ? undefined : "workflow-canvas-hide-edges"}
        defaultViewport={defaultViewport}
        edges={edges}
        isValidConnection={(connection) =>
          Boolean(
            connection.source &&
              connection.target &&
              isValidWorkflowConnection(
                definitionRef.current,
                connection.source,
                connection.target,
                connection.sourceHandle,
                connection.targetHandle,
              ),
          )
        }
        maxZoom={2}
        minZoom={0.25}
        multiSelectionKeyCode="Shift"
        nodes={nodes}
        onBeforeDelete={handleBeforeDelete}
        onConnect={handleConnect}
        onEdgesChange={onEdgesChange}
        onEdgesDelete={handleEdgesDelete}
        proOptions={reactFlowProOptions}
        onMove={(_, viewport) => scheduleViewportZoomWrite(Math.round(viewport.zoom * 100))}
        onMoveEnd={handleMoveEnd}
        onNodeContextMenu={(event, node) => {
          openNodeContextMenu(event, node.id);
        }}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onNodesChange={onNodesChange}
        onNodesDelete={handleNodesDelete}
        onPaneClick={handlePaneClick}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
          const viewport = readViewport(definitionRef.current.viewport);
          openContextMenu({
            flowPosition: clientToFlowPosition(event.clientX, event.clientY, bounds, viewport),
            x: event.clientX,
            y: event.clientY,
          });
        }}
        onSelectionChange={handleSelectionChange}
        onSelectionContextMenu={(event) => {
          event.preventDefault();
          const { selectedNodeIds } = useWorkflowStore.getState();
          const workflowNodeId = selectedNodeIds.find((nodeId) =>
            definitionRef.current.nodes.some((node) => node.id === nodeId),
          );

          openContextMenu({
            nodeId: workflowNodeId,
            x: event.clientX,
            y: event.clientY,
          });
        }}
        nodeTypes={nodeTypes}
        onlyRenderVisibleElements
        selectionOnDrag
        snapGrid={workflowSnapGrid}
        snapToGrid={canvasView.snapToGrid}
      >
        {canvasView.showGrid ? (
          <Background
            bgColor="var(--workflow-canvas-bg)"
            color="rgba(148, 163, 184, 0.5)"
            gap={18}
            id="workflow-grid"
            size={1.5}
            variant={BackgroundVariant.Dots}
          />
        ) : null}
        {canvasView.showMinimap ? (
          <MiniMap
            className="workflow-minimap"
            maskColor="rgba(2, 6, 23, 0.72)"
            nodeColor={getMiniMapNodeColor}
            pannable
            position="bottom-right"
            zoomable
          />
        ) : null}
        <Panel className="workflow-canvas-floating-toolbar" position="bottom-right">
          <WorkflowCanvasFloatingToolbar onAutoLayout={onAutoLayout} />
        </Panel>
        <WorkflowCanvasBridge
          definitionId={definition.id}
          onFocusNodePulse={setPulseNodeId}
          ref={bridgeRef}
          savedViewport={definition.viewport ? defaultViewport : undefined}
        />
      </ReactFlow>
      {contextMenu ? (
        <WorkflowCanvasContextMenu
          canPaste={canPasteClipboard}
          canRedo={canRedo}
          canUndo={canUndo}
          groupableCount={groupableNodeCount}
          menu={contextMenu}
          onClose={closeContextMenu}
          onCopy={() => runContextAction(onCopySelection)}
          onCreateGroup={() => runContextAction(onCreateGroup)}
          onDuplicate={() => runContextAction(onDuplicateSelection)}
          onOpenSearch={() => runContextAction(onOpenNodeSearch)}
          onPaste={(position) => runContextAction(() => onPasteClipboard(position))}
          onRedo={() => runContextAction(onRedo)}
          onUndo={() => runContextAction(onUndo)}
        />
      ) : null}
    </ReactFlowProvider>
  );
});

const WorkflowCanvasBridge = forwardRef<
  Pick<WorkflowCanvasHandle, "fitView" | "focusNode">,
  {
    definitionId: string;
    onFocusNodePulse: (nodeId: string | undefined) => void;
    savedViewport?: { x: number; y: number; zoom: number };
  }
>(function WorkflowCanvasBridge({ definitionId, onFocusNodePulse, savedViewport }, ref) {
  const { fitView, setViewport } = useReactFlow();
  const hasFittedRef = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      fitView: () => {
        void fitView({ duration: 200, padding: 0.18 });
      },
      focusNode: (nodeId: string) => {
        void fitView({
          duration: 280,
          maxZoom: 1.35,
          nodes: [{ id: nodeId }],
          padding: 0.45,
        });
        onFocusNodePulse(nodeId);
      },
    }),
    [fitView, onFocusNodePulse],
  );

  useEffect(() => {
    hasFittedRef.current = false;
  }, [definitionId]);

  // 每次进入/切换工作流仅执行一次视口动作：优先恢复已保存视口，否则自动适配。
  useEffect(() => {
    if (hasFittedRef.current) {
      return;
    }

    hasFittedRef.current = true;

    if (savedViewport) {
      void setViewport(savedViewport, { duration: 0 });
      return;
    }

    void fitView({ duration: 0, padding: 0.18 });
  }, [definitionId, fitView, savedViewport, setViewport]);

  return null;
});
