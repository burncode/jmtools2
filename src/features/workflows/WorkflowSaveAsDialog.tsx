import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InspectorField } from "@/components/shared";

interface WorkflowSaveAsDialogProps {
  defaultName: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
  open: boolean;
}

export function WorkflowSaveAsDialog({ defaultName, onClose, onConfirm, open }: WorkflowSaveAsDialogProps) {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (open) {
      setName(defaultName);
    }
  }, [defaultName, open]);

  if (!open) {
    return null;
  }

  function handleConfirm() {
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    onConfirm(trimmed);
    onClose();
  }

  return (
    <div className="workflow-modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label="另存为工作流"
        className="workflow-modal workflow-modal-compact"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="workflow-modal-header">
          <div>
            <strong className="workflow-type-section">另存为</strong>
            <p className="workflow-type-caption">保存为新的工作流副本。</p>
          </div>
          <Button aria-label="关闭" onClick={onClose} type="button" variant="ghost">
            <X aria-hidden="true" />
          </Button>
        </header>

        <div className="workflow-modal-body">
          <InspectorField label="工作流名称">
            <Input onChange={(event) => setName(event.target.value)} value={name} />
          </InspectorField>
        </div>

        <footer className="workflow-modal-footer">
          <Button onClick={onClose} type="button" variant="ghost">
            取消
          </Button>
          <Button disabled={!name.trim()} onClick={handleConfirm} type="button">
            保存副本
          </Button>
        </footer>
      </section>
    </div>
  );
}
