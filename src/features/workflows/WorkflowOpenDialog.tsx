import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { WorkflowDefinition } from "./types";

interface WorkflowOpenDialogProps {
  onClose: () => void;
  onOpen: (workflow: WorkflowDefinition) => void;
  open: boolean;
  workflows: WorkflowDefinition[];
}

export function WorkflowOpenDialog({ onClose, onOpen, open, workflows }: WorkflowOpenDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="workflow-modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label="打开工作流"
        className="workflow-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="workflow-modal-header">
          <div>
            <strong className="workflow-type-section">打开工作流</strong>
            <p className="workflow-type-caption">选择项目中已保存的节点工作流。</p>
          </div>
          <Button aria-label="关闭" onClick={onClose} type="button" variant="ghost">
            <X aria-hidden="true" />
          </Button>
        </header>

        <div className="workflow-modal-body">
          {workflows.length === 0 ? <p className="workflow-muted">当前项目还没有保存的工作流。</p> : null}
          <div className="workflow-list">
            {workflows.map((workflow) => (
              <button
                className="workflow-list-item"
                key={workflow.id}
                onClick={() => {
                  onOpen(workflow);
                  onClose();
                }}
                type="button"
              >
                <strong className="workflow-type-section">{workflow.name}</strong>
                <span className="workflow-type-caption">{workflow.description || workflow.id}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
