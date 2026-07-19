import { ClipboardPaste, Copy, Group, Redo2, Search, Trash2, Undo2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

export interface WorkflowCanvasContextMenuState {
  flowPosition?: {
    x: number;
    y: number;
  };
  nodeId?: string;
  x: number;
  y: number;
}

interface WorkflowCanvasContextMenuProps {
  canPaste: boolean;
  canRedo: boolean;
  canUndo: boolean;
  groupableCount: number;
  menu: WorkflowCanvasContextMenuState;
  onClose: () => void;
  onCopy: () => void;
  onCreateGroup: () => void;
  onDuplicate: () => void;
  onOpenSearch: () => void;
  onPaste: (position?: { x: number; y: number }) => void;
  onRedo: () => void;
  onUndo: () => void;
}

export function WorkflowCanvasContextMenu({
  canPaste,
  canRedo,
  canUndo,
  groupableCount,
  menu,
  onClose,
  onCopy,
  onCreateGroup,
  onDuplicate,
  onOpenSearch,
  onPaste,
  onRedo,
  onUndo,
}: WorkflowCanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as HTMLElement)) {
        return;
      }

      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const timeoutId = window.setTimeout(() => {
      window.addEventListener("pointerdown", handlePointerDown, true);
    }, 0);

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="workflow-canvas-context-menu"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      ref={menuRef}
      role="menu"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.nodeId ? (
        <>
          <ContextMenuButton icon={Copy} label="复制" onClick={onCopy} />
          <ContextMenuButton icon={ClipboardPaste} disabled={!canPaste} label="粘贴" onClick={() => onPaste(menu.flowPosition)} />
          <ContextMenuButton icon={Copy} label="复制并粘贴" onClick={onDuplicate} />
          <ContextMenuButton
            disabled={groupableCount < 2}
            icon={Group}
            label="编组选中节点"
            onClick={onCreateGroup}
          />
        </>
      ) : (
        <>
          <ContextMenuButton icon={Search} label="搜索添加节点" onClick={onOpenSearch} />
          <ContextMenuButton
            disabled={!canPaste}
            icon={ClipboardPaste}
            label="粘贴到此处"
            onClick={() => onPaste(menu.flowPosition)}
          />
        </>
      )}
      <div className="workflow-context-menu-separator" role="separator" />
      <ContextMenuButton disabled={!canUndo} icon={Undo2} label="撤销" onClick={onUndo} />
      <ContextMenuButton disabled={!canRedo} icon={Redo2} label="重做" onClick={onRedo} />
      <ContextMenuButton icon={Trash2} label="关闭菜单" onClick={onClose} />
    </div>,
    document.body,
  );
}

function ContextMenuButton({
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: typeof Copy;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      className="workflow-context-menu-item"
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onClick()}
      type="button"
      variant="ghost"
    >
      <Icon aria-hidden="true" />
      {label}
    </Button>
  );
}
