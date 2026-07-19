import { useEffect } from "react";

interface WorkflowKeyboardShortcutsParams {
  canRedo: boolean;
  canUndo: boolean;
  onCopySelection: () => void;
  onCreateGroup: () => void;
  onDuplicateSelection: () => void;
  onOpenNodeSearch: () => void;
  onPasteClipboard: () => void;
  onRedo: () => void;
  onUndo: () => void;
}

/// 工作台全局键盘快捷键（撤销/重做/复制/粘贴/复制副本/编组/节点搜索）。
/// 在可编辑元素聚焦时不拦截，避免干扰输入。
export function useWorkflowKeyboardShortcuts({
  canRedo,
  canUndo,
  onCopySelection,
  onCreateGroup,
  onDuplicateSelection,
  onOpenNodeSearch,
  onPasteClipboard,
  onRedo,
  onUndo,
}: WorkflowKeyboardShortcutsParams) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const withCtrl = event.ctrlKey || event.metaKey;

      if (withCtrl && key === "g") {
        event.preventDefault();
        onCreateGroup();
        return;
      }

      if (withCtrl && key === "z" && !event.shiftKey) {
        event.preventDefault();
        if (canUndo) {
          onUndo();
        }
        return;
      }

      if ((withCtrl && key === "y") || (withCtrl && event.shiftKey && key === "z")) {
        event.preventDefault();
        if (canRedo) {
          onRedo();
        }
        return;
      }

      if (withCtrl && key === "c") {
        event.preventDefault();
        onCopySelection();
        return;
      }

      if (withCtrl && key === "v") {
        event.preventDefault();
        onPasteClipboard();
        return;
      }

      if (withCtrl && key === "d") {
        event.preventDefault();
        onDuplicateSelection();
        return;
      }

      if (withCtrl && key === "k") {
        event.preventDefault();
        onOpenNodeSearch();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    canRedo,
    canUndo,
    onCopySelection,
    onCreateGroup,
    onDuplicateSelection,
    onOpenNodeSearch,
    onPasteClipboard,
    onRedo,
    onUndo,
  ]);
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;

  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target.isContentEditable;
}
