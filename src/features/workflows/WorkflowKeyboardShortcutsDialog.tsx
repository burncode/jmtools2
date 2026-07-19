import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface WorkflowKeyboardShortcutsDialogProps {
  onClose: () => void;
  open: boolean;
}

const SHORTCUTS = [
  { keys: "Ctrl + Z", label: "撤销" },
  { keys: "Ctrl + Y / Ctrl + Shift + Z", label: "重做" },
  { keys: "Ctrl + C", label: "复制选中节点" },
  { keys: "Ctrl + V", label: "粘贴节点" },
  { keys: "Ctrl + D", label: "复制并粘贴" },
  { keys: "Ctrl + G", label: "编组选中节点" },
  { keys: "Ctrl + K", label: "搜索添加节点" },
  { keys: "Delete / Backspace", label: "删除选中节点或连线" },
  { keys: "Shift + 拖拽", label: "框选多个节点" },
] as const;

export function WorkflowKeyboardShortcutsDialog({ onClose, open }: WorkflowKeyboardShortcutsDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="workflow-modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-labelledby="workflow-shortcuts-title"
        aria-modal="true"
        className="workflow-modal workflow-shortcuts-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="workflow-modal-header">
          <div>
            <strong className="workflow-type-section" id="workflow-shortcuts-title">
              快捷键
            </strong>
            <p className="workflow-type-caption">节点画布常用编辑与运行快捷键。</p>
          </div>
          <Button aria-label="关闭" onClick={onClose} type="button" variant="ghost">
            <X aria-hidden="true" />
          </Button>
        </header>
        <ul className="workflow-shortcuts-list">
          {SHORTCUTS.map((item) => (
            <li className="workflow-shortcuts-item" key={item.label}>
              <kbd>{item.keys}</kbd>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
