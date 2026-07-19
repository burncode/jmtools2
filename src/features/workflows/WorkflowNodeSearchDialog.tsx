import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { listAvailableWorkflowNodes } from "./nodeCatalog";
import type { WorkflowNodeDefinition, WorkflowNodeKind } from "./types";

interface WorkflowNodeSearchDialogProps {
  catalogReady: boolean;
  onClose: () => void;
  onPickNode: (kind: WorkflowNodeKind) => void;
  open: boolean;
}

export function WorkflowNodeSearchDialog({ catalogReady, onClose, onPickNode, open }: WorkflowNodeSearchDialogProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!catalogReady) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return listAvailableWorkflowNodes().slice(0, 12);
    }

    return listAvailableWorkflowNodes().filter((node) => matchesNode(node, normalizedQuery)).slice(0, 20);
  }, [catalogReady, query]);

  if (!open) {
    return null;
  }

  return (
    <div className="workflow-modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label="搜索添加节点"
        className="workflow-modal workflow-node-search-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="workflow-modal-header">
          <div>
            <strong className="workflow-type-section">搜索添加节点</strong>
            <p className="workflow-type-caption">输入节点名称、类型或分类快速添加。</p>
          </div>
          <Button aria-label="关闭" onClick={onClose} type="button" variant="ghost">
            <X aria-hidden="true" />
          </Button>
        </header>

        <div className="workflow-modal-body">
          <div className="workflow-node-search-input">
            <Search aria-hidden="true" />
            <Input
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索节点..."
              value={query}
            />
          </div>

          <div className="workflow-node-search-results">
            {results.length ? (
              results.map((node) => (
                <button
                  className="workflow-node-search-item"
                  key={node.kind}
                  onClick={() => {
                    onPickNode(node.kind);
                    onClose();
                    setQuery("");
                  }}
                  type="button"
                >
                  <strong className="workflow-type-section">{node.label}</strong>
                  <span className="workflow-type-caption">{node.kind}</span>
                </button>
              ))
            ) : (
              <p className="workflow-muted">没有匹配的可用节点。</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function matchesNode(node: WorkflowNodeDefinition, query: string) {
  return (
    node.label.toLowerCase().includes(query) ||
    node.kind.toLowerCase().includes(query) ||
    node.category.toLowerCase().includes(query) ||
    node.description.toLowerCase().includes(query)
  );
}
