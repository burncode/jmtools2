import { create } from "zustand";

import type { WorkflowDefinition, WorkflowGroup, WorkflowNode, WorkflowRun } from "./types";
import type { WorkflowManualOption, WorkflowManualPreviewImage } from "./workflowEvents";
import { cloneWorkflowDefinition, popRedo, popUndo, pushHistorySnapshot } from "./workflowHistory";

export interface PendingManualInput {
  allowMultiple: boolean;
  nodeId: string;
  nodeKind: string;
  options: WorkflowManualOption[];
  previewImages?: WorkflowManualPreviewImage[];
  prompt: string;
  runId: string;
}

export type WorkflowHorizontalPaneState = "collapsed" | "expanded";
export type WorkflowLogPaneState = "collapsed" | "max" | "normal";

export interface WorkflowLayoutState {
  leftPane: WorkflowHorizontalPaneState;
  leftWidth: number;
  logHeight: number;
  logPane: WorkflowLogPaneState;
  rightPane: WorkflowHorizontalPaneState;
  rightWidth: number;
}

export interface WorkflowCanvasViewState {
  showEdges: boolean;
  showGrid: boolean;
  showMinimap: boolean;
  snapToGrid: boolean;
  zoom: number;
}

interface WorkflowState {
  activeRunId?: string;
  canvasView: WorkflowCanvasViewState;
  currentWorkflow?: WorkflowDefinition;
  historyFuture: WorkflowDefinition[];
  historyPast: WorkflowDefinition[];
  isDirty: boolean;
  isRunning: boolean;
  layout: WorkflowLayoutState;
  pendingManualInput?: PendingManualInput;
  projectRoot: string;
  runs: WorkflowRun[];
  selectedNodeId?: string;
  selectedNodeIds: string[];
  selectedRun?: WorkflowRun;
}

interface WorkflowActions {
  clearSelection: () => void;
  commitWorkflowChange: (workflow: WorkflowDefinition, options?: { recordHistory?: boolean }) => void;
  markClean: () => void;
  patchWorkflowGroup: (groupId: string, patch: Partial<WorkflowGroup>) => void;
  patchWorkflowNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  persistCanvasView: () => void;
  redo: () => void;
  selectNode: (nodeId: string | undefined) => void;
  setActiveRunId: (runId: string | undefined) => void;
  setCanvasView: (patch: Partial<WorkflowCanvasViewState>, options?: { persist?: boolean }) => void;
  setCurrentWorkflow: (workflow: WorkflowDefinition | undefined) => void;
  setIsRunning: (isRunning: boolean) => void;
  setLeftPaneState: (state: WorkflowHorizontalPaneState) => void;
  setPendingManualInput: (input: PendingManualInput | undefined) => void;
  setLogPaneState: (state: WorkflowLogPaneState) => void;
  setPaneSize: (size: Partial<Pick<WorkflowLayoutState, "leftWidth" | "logHeight" | "rightWidth">>) => void;
  resetWorkflowSessionForProject: (projectRoot: string) => void;
  setProjectRoot: (projectRoot: string) => void;
  setRightPaneState: (state: WorkflowHorizontalPaneState) => void;
  setRuns: (runs: WorkflowRun[] | ((current: WorkflowRun[]) => WorkflowRun[])) => void;
  setSelection: (selection: { focusedNodeId: string | undefined; nodeIds: string[] }) => void;
  setSelectedNodeIds: (nodeIds: string[]) => void;
  setSelectedRun: (run: WorkflowRun | undefined) => void;
  toggleCanvasGrid: () => void;
  toggleCanvasSnap: () => void;
  toggleCanvasEdges: () => void;
  toggleCanvasMinimap: () => void;
  undo: () => void;
  updateCurrentWorkflow: (workflow: WorkflowDefinition) => void;
  updateWorkflowViewport: (workflowId: string, viewport: Record<string, unknown>) => void;
}

const defaultLayout: WorkflowLayoutState = {
  leftPane: "expanded",
  leftWidth: 280,
  logHeight: 240,
  logPane: "collapsed",
  rightPane: "expanded",
  rightWidth: 360,
};

const defaultCanvasView: WorkflowCanvasViewState = {
  showEdges: true,
  showGrid: true,
  showMinimap: true,
  snapToGrid: true,
  zoom: 100,
};

const layoutStorageKey = "jmtools.workflow.layout.v1";
const canvasViewStorageKey = "jmtools.workflow.canvas-view.v1";

export const useWorkflowStore = create<WorkflowState & WorkflowActions>((set, get) => ({
  canvasView: readStoredCanvasView(),
  historyFuture: [],
  historyPast: [],
  isDirty: false,
  isRunning: false,
  layout: readStoredLayout(),
  projectRoot: "",
  runs: [],
  selectedNodeIds: [],
  clearSelection: () => set({ selectedNodeId: undefined, selectedNodeIds: [] }),
  commitWorkflowChange: (workflow, options) =>
    set((state) => {
      const recordHistory = options?.recordHistory !== false && Boolean(state.currentWorkflow);

      return {
        currentWorkflow: workflow,
        historyFuture: recordHistory ? [] : state.historyFuture,
        historyPast: recordHistory
          ? pushHistorySnapshot(state.historyPast, state.currentWorkflow!)
          : state.historyPast,
        isDirty: true,
      };
    }),
  markClean: () => set({ isDirty: false }),
  patchWorkflowGroup: (groupId, patch) => {
    const state = get();

    if (!state.currentWorkflow) {
      return;
    }

    get().commitWorkflowChange({
      ...state.currentWorkflow,
      groups: (state.currentWorkflow.groups ?? []).map((group) =>
        group.id === groupId ? { ...group, ...patch } : group,
      ),
    });
  },
  patchWorkflowNode: (nodeId, patch) => {
    const state = get();

    if (!state.currentWorkflow) {
      return;
    }

    get().commitWorkflowChange({
      ...state.currentWorkflow,
      nodes: state.currentWorkflow.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
    });
  },
  persistCanvasView: () => {
    persistCanvasView(get().canvasView);
  },
  redo: () =>
    set((state) => {
      if (!state.currentWorkflow) {
        return {};
      }

      const result = popRedo(state.currentWorkflow, state.historyPast, state.historyFuture);

      if (!result) {
        return {};
      }

      return {
        currentWorkflow: result.workflow,
        historyFuture: result.future,
        historyPast: result.past,
        isDirty: true,
      };
    }),
  selectNode: (selectedNodeId) => set({ selectedNodeId }),
  setActiveRunId: (activeRunId) => set({ activeRunId }),
  setCanvasView: (patch, options) =>
    set((state) => {
      const canvasView = { ...state.canvasView, ...patch };
      if (options?.persist !== false) {
        persistCanvasView(canvasView);
      }

      return { canvasView };
    }),
  setCurrentWorkflow: (currentWorkflow) =>
    set({
      currentWorkflow,
      historyFuture: [],
      historyPast: [],
      isDirty: false,
      selectedNodeId: undefined,
      selectedNodeIds: [],
    }),
  setLeftPaneState: (leftPane) =>
    set((state) => persistLayout({ ...state.layout, leftPane })),
  setLogPaneState: (logPane) =>
    set((state) => persistLayout({ ...state.layout, logPane })),
  setPaneSize: (size) =>
    set((state) => persistLayout({ ...state.layout, ...normalizeLayoutSize(size) })),
  setIsRunning: (isRunning) => set({ isRunning }),
  setPendingManualInput: (pendingManualInput) => set({ pendingManualInput }),
  resetWorkflowSessionForProject: (projectRoot) =>
    set({
      activeRunId: undefined,
      currentWorkflow: undefined,
      historyFuture: [],
      historyPast: [],
      isDirty: false,
      isRunning: false,
      pendingManualInput: undefined,
      projectRoot,
      runs: [],
      selectedNodeId: undefined,
      selectedNodeIds: [],
      selectedRun: undefined,
    }),
  setProjectRoot: (projectRoot) => set({ projectRoot }),
  setRightPaneState: (rightPane) =>
    set((state) => persistLayout({ ...state.layout, rightPane })),
  setRuns: (runs) =>
    set((state) => ({
      runs: typeof runs === "function" ? (runs as (current: WorkflowRun[]) => WorkflowRun[])(state.runs) : runs,
    })),
  setSelection: ({ focusedNodeId, nodeIds }) => set({ selectedNodeId: focusedNodeId, selectedNodeIds: nodeIds }),
  setSelectedNodeIds: (selectedNodeIds) => set({ selectedNodeIds }),
  setSelectedRun: (selectedRun) => set({ selectedRun }),
  toggleCanvasGrid: () =>
    set((state) => {
      const canvasView = persistCanvasView({ ...state.canvasView, showGrid: !state.canvasView.showGrid });
      return { canvasView };
    }),
  toggleCanvasSnap: () =>
    set((state) => {
      const canvasView = persistCanvasView({ ...state.canvasView, snapToGrid: !state.canvasView.snapToGrid });
      return { canvasView };
    }),
  toggleCanvasEdges: () =>
    set((state) => {
      const canvasView = persistCanvasView({ ...state.canvasView, showEdges: !state.canvasView.showEdges });
      return { canvasView };
    }),
  toggleCanvasMinimap: () =>
    set((state) => {
      const canvasView = persistCanvasView({ ...state.canvasView, showMinimap: !state.canvasView.showMinimap });
      return { canvasView };
    }),
  undo: () =>
    set((state) => {
      if (!state.currentWorkflow) {
        return {};
      }

      const result = popUndo(state.currentWorkflow, state.historyPast, state.historyFuture);

      if (!result) {
        return {};
      }

      return {
        currentWorkflow: result.workflow,
        historyFuture: result.future,
        historyPast: result.past,
        isDirty: true,
      };
    }),
  updateCurrentWorkflow: (workflow) => {
    get().commitWorkflowChange(workflow);
  },
  updateWorkflowViewport: (workflowId, viewport) =>
    set((state) => {
      if (!state.currentWorkflow || state.currentWorkflow.id !== workflowId) {
        return {};
      }

      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          viewport,
        },
      };
    }),
}));

function readStoredLayout() {
  if (typeof window === "undefined") {
    return defaultLayout;
  }

  try {
    const storedValue = window.localStorage.getItem(layoutStorageKey);
    if (!storedValue) {
      return defaultLayout;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<WorkflowLayoutState>;
    const layout: WorkflowLayoutState = {
      ...defaultLayout,
      ...parsedValue,
      ...normalizeLayoutSize(parsedValue),
      leftPane: parsedValue.leftPane === "collapsed" ? "collapsed" : "expanded",
      logPane: normalizeLogPaneState(parsedValue.logPane),
      rightPane: parsedValue.rightPane === "collapsed" ? "collapsed" : "expanded",
    };

    return layout;
  } catch {
    return defaultLayout;
  }
}

function persistLayout(layout: WorkflowLayoutState) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(layoutStorageKey, JSON.stringify(layout));
  }

  return { layout };
}

function readStoredCanvasView(): WorkflowCanvasViewState {
  if (typeof window === "undefined") {
    return defaultCanvasView;
  }

  try {
    const storedValue = window.localStorage.getItem(canvasViewStorageKey);
    if (!storedValue) {
      return defaultCanvasView;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<WorkflowCanvasViewState>;

    return {
      showEdges: parsedValue.showEdges !== false,
      showGrid: parsedValue.showGrid !== false,
      showMinimap: parsedValue.showMinimap !== false,
      snapToGrid: parsedValue.snapToGrid !== false,
      zoom: clampNumber(parsedValue.zoom, 10, 400, defaultCanvasView.zoom),
    };
  } catch {
    return defaultCanvasView;
  }
}

function persistCanvasView(canvasView: WorkflowCanvasViewState) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(canvasViewStorageKey, JSON.stringify(canvasView));
  }

  return canvasView;
}

function normalizeLayoutSize(size: Partial<Pick<WorkflowLayoutState, "leftWidth" | "logHeight" | "rightWidth">>) {
  return {
    leftWidth: clampNumber(size.leftWidth, 220, 420, defaultLayout.leftWidth),
    logHeight: clampNumber(size.logHeight, 160, 520, defaultLayout.logHeight),
    rightWidth: clampNumber(size.rightWidth, 280, 520, defaultLayout.rightWidth),
  };
}

function normalizeLogPaneState(value: unknown): WorkflowLogPaneState {
  if (value === "max" || value === "normal") {
    return value;
  }

  return "collapsed";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numberValue));
}

export function canUndoWorkflow() {
  return useWorkflowStore.getState().historyPast.length > 0;
}

export function canRedoWorkflow() {
  return useWorkflowStore.getState().historyFuture.length > 0;
}

export { cloneWorkflowDefinition };
