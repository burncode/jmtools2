import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Settings2, TerminalSquare, Workflow } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import type { WorkflowHorizontalPaneState, WorkflowLogPaneState } from "./workflowStore";
import { useWorkflowStore } from "./workflowStore";

interface WorkflowResizableLayoutProps {
  bottom: ReactNode;
  errorCount: number;
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
}

type DragTarget = "bottom" | "left" | "right";

const collapsedSideWidth = 44;
const collapsedLogHeight = 40;
const defaultLeftWidth = 280;
const defaultLogHeight = 240;
const defaultRightWidth = 360;

export function WorkflowResizableLayout({ bottom, errorCount, left, main, right }: WorkflowResizableLayoutProps) {
  const layout = useWorkflowStore((state) => state.layout);
  const setLeftPaneState = useWorkflowStore((state) => state.setLeftPaneState);
  const setLogPaneState = useWorkflowStore((state) => state.setLogPaneState);
  const setPaneSize = useWorkflowStore((state) => state.setPaneSize);
  const setRightPaneState = useWorkflowStore((state) => state.setRightPaneState);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draftSize, setDraftSize] = useState({
    leftWidth: layout.leftWidth,
    logHeight: layout.logHeight,
    rightWidth: layout.rightWidth,
  });
  const dragTargetRef = useRef<DragTarget | undefined>(undefined);

  useEffect(() => {
    setDraftSize({
      leftWidth: layout.leftWidth,
      logHeight: layout.logHeight,
      rightWidth: layout.rightWidth,
    });
  }, [layout.leftWidth, layout.logHeight, layout.rightWidth]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const dragTarget = dragTargetRef.current;
      const container = containerRef.current;

      if (!dragTarget || !container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      if (dragTarget === "left") {
        setDraftSize((currentSize) => ({
          ...currentSize,
          leftWidth: clampNumber(event.clientX - rect.left, 220, 420),
        }));
      }

      if (dragTarget === "right") {
        setDraftSize((currentSize) => ({
          ...currentSize,
          rightWidth: clampNumber(rect.right - event.clientX, 280, 520),
        }));
      }

      if (dragTarget === "bottom") {
        setDraftSize((currentSize) => ({
          ...currentSize,
          logHeight: clampNumber(rect.bottom - event.clientY, 160, 520),
        }));
      }
    }

    function handlePointerUp() {
      if (!dragTargetRef.current) {
        return;
      }

      dragTargetRef.current = undefined;
      setPaneSize(draftSize);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draftSize, setPaneSize]);

  const leftWidth = layout.leftPane === "collapsed" ? collapsedSideWidth : draftSize.leftWidth;
  const rightWidth = layout.rightPane === "collapsed" ? collapsedSideWidth : draftSize.rightWidth;
  const logHeight = getLogHeight(layout.logPane, draftSize.logHeight);

  return (
    <section
      className="workflow-resizable-layout"
      data-left-pane={layout.leftPane}
      data-log-pane={layout.logPane}
      data-right-pane={layout.rightPane}
      ref={containerRef}
      style={{
        "--workflow-left-width": `${leftWidth}px`,
        "--workflow-log-height": logHeight,
        "--workflow-right-width": `${rightWidth}px`,
      } as CSSProperties}
    >
      <aside className="workflow-pane workflow-left-pane" aria-label="节点库">
        {layout.leftPane === "collapsed" ? (
          <CollapsedPaneRail icon="left" label="节点库" onToggle={() => setLeftPaneState("expanded")} />
        ) : (
          left
        )}
      </aside>
      <ResizeHandle
        label="调整节点库宽度"
        onDoubleClick={() => setPaneSize({ leftWidth: defaultLeftWidth })}
        onPointerDown={() => startDrag("left")}
        orientation="vertical"
        placement="left"
      />

      <main className="workflow-main-pane">{main}</main>

      <ResizeHandle
        label="调整节点设置宽度"
        onDoubleClick={() => setPaneSize({ rightWidth: defaultRightWidth })}
        onPointerDown={() => startDrag("right")}
        orientation="vertical"
        placement="right"
      />
      <aside className="workflow-pane workflow-right-pane" aria-label="节点设置">
        {layout.rightPane === "collapsed" ? (
          <CollapsedPaneRail icon="right" label="设置" onToggle={() => setRightPaneState("expanded")} />
        ) : (
          right
        )}
      </aside>

      <ResizeHandle
        label="调整运行日志高度"
        onDoubleClick={() => setPaneSize({ logHeight: defaultLogHeight })}
        onPointerDown={() => startDrag("bottom")}
        orientation="horizontal"
        placement="log"
      />
      <section className="workflow-bottom-pane" aria-label="运行日志">
        {layout.logPane === "collapsed" ? (
          <CollapsedLogRail errorCount={errorCount} onToggle={() => setLogPaneState("normal")} />
        ) : (
          bottom
        )}
      </section>
    </section>
  );

  function startDrag(target: DragTarget) {
    dragTargetRef.current = target;
  }
}

function ResizeHandle({
  label,
  onDoubleClick,
  onPointerDown,
  orientation,
  placement,
}: {
  label: string;
  onDoubleClick: () => void;
  onPointerDown: () => void;
  orientation: "horizontal" | "vertical";
  placement?: "left" | "log" | "right";
}) {
  return (
    <button
      aria-label={label}
      className="workflow-resize-handle"
      data-orientation={orientation}
      data-placement={placement}
      onDoubleClick={onDoubleClick}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onPointerDown();
      }}
      type="button"
    />
  );
}

function CollapsedPaneRail({
  icon,
  label,
  onToggle,
}: {
  icon: "left" | "right";
  label: string;
  onToggle: () => void;
}) {
  const Icon = icon === "left" ? Workflow : Settings2;
  const ToggleIcon = icon === "left" ? PanelLeftOpen : PanelRightOpen;

  return (
    <div className="workflow-collapsed-rail">
      <Icon aria-hidden="true" />
      <span>{label}</span>
      <Button aria-label={`展开${label}`} onClick={onToggle} size="icon" type="button" variant="ghost">
        <ToggleIcon aria-hidden="true" />
      </Button>
    </div>
  );
}

function CollapsedLogRail({ errorCount, onToggle }: { errorCount: number; onToggle: () => void }) {
  return (
    <button className="workflow-log-rail" onClick={onToggle} type="button">
      <TerminalSquare aria-hidden="true" />
      <span>运行日志</span>
      <strong>{errorCount > 0 ? `${errorCount} 个错误` : "暂无错误"}</strong>
    </button>
  );
}

function getLogHeight(logPane: WorkflowLogPaneState, logHeight: number) {
  if (logPane === "collapsed") {
    return `${collapsedLogHeight}px`;
  }

  if (logPane === "max") {
    return "min(40vh, 520px)";
  }

  return `${logHeight}px`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getOppositePaneState(state: WorkflowHorizontalPaneState): WorkflowHorizontalPaneState {
  return state === "collapsed" ? "expanded" : "collapsed";
}

export { PanelLeftClose, PanelRightClose };
