import { ChevronRight, FolderKanban, Plus, Trash2, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { PanelSection } from "@/components/shared";

import { getWorkflowNodeCatalog } from "./nodeCatalog";
import { workflowTemplates } from "./workflowTemplates";
import type { WorkflowDefinition, WorkflowNodeKind, WorkflowTemplate } from "./types";

interface WorkflowNodePaletteProps {
  catalogReady?: boolean;
  definitionsLoading?: boolean;
  onAddNode: (kind: WorkflowNodeKind) => void;
  onDeleteWorkflow: (workflowId: string) => void;
  onUseTemplate: (template: WorkflowTemplate) => void;
  workflows: WorkflowDefinition[];
  onOpenWorkflow: (workflow: WorkflowDefinition) => void;
}

export function WorkflowNodePalette({
  catalogReady = false,
  definitionsLoading = false,
  onAddNode,
  onDeleteWorkflow,
  onOpenWorkflow,
  onUseTemplate,
  workflows,
}: WorkflowNodePaletteProps) {
  const [query, setQuery] = useState("");
  // 节点库内容较重（多分类 × 多节点的可折叠列表）。延迟到首帧之后再挂载，
  // 让首次进入工作台时的关键路径只渲染轻量骨架，消除首屏卡顿。
  const [nodeListReady, setNodeListReady] = useState(false);
  const nodeCatalog = useMemo(() => getWorkflowNodeCatalog(), [catalogReady]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setNodeListReady(true));

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);
  const groupedNodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return categoryOrder
      .map((category) => ({
        ...category,
        nodes: nodeCatalog.filter((node) => {
          if (node.category !== category.id) {
            return false;
          }

          if (!normalizedQuery) {
            return true;
          }

          return `${node.label} ${node.description} ${node.kind}`.toLowerCase().includes(normalizedQuery);
        }),
      }))
      .filter((category) => category.nodes.length > 0);
  }, [nodeCatalog, query]);

  return (
    <div className="workflow-palette">
      <PanelSection icon={Workflow} title="模板">
        <div className="workflow-list">
          {workflowTemplates.map((template) => (
            <button className="workflow-list-item" key={template.id} onClick={() => onUseTemplate(template)} type="button">
              <strong className="workflow-type-section">{template.label}</strong>
              <span className="workflow-type-caption">{template.description}</span>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection icon={Plus} title="节点库">
        <Input
          aria-label="搜索节点"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索节点"
          value={query}
        />
        <div className="workflow-node-list">
          {!nodeListReady ? <p className="workflow-muted">正在载入节点…</p> : null}
          {nodeListReady
            ? groupedNodes.map((category) => (
            <Collapsible className="workflow-node-category" defaultOpen key={category.id}>
              <CollapsibleTrigger className="workflow-node-category-trigger">
                <ChevronRight aria-hidden="true" className="workflow-node-category-chevron" />
                <span className="workflow-type-section">{category.label}</span>
                <small className="workflow-type-caption">{category.nodes.length}</small>
              </CollapsibleTrigger>
              <CollapsibleContent className="workflow-node-category-content">
                {category.nodes.map((node) => {
                  const Icon = node.icon;

                  return (
                    <button
                      className="workflow-list-item workflow-list-item-compact"
                      disabled={node.status !== "available"}
                      key={node.kind}
                      onClick={() => onAddNode(node.kind)}
                      type="button"
                    >
                      <span className="workflow-list-item-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <span className="workflow-list-item-copy">
                        <strong className="workflow-type-section">{node.label}</strong>
                        <small className="workflow-type-caption">{node.description}</small>
                      </span>
                    </button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
              ))
            : null}
          {nodeListReady && groupedNodes.length === 0 ? (
            <p className="workflow-muted">没有匹配的节点。</p>
          ) : null}
        </div>
      </PanelSection>

      <PanelSection icon={FolderKanban} title="项目工作流">
        <div className="workflow-list">
          {definitionsLoading ? <p className="workflow-muted">正在同步工作流列表…</p> : null}
          {!definitionsLoading && workflows.length === 0 ? (
            <p className="workflow-muted">当前项目还没有保存的节点工作流。</p>
          ) : null}
          {workflows.map((workflow) => (
            <div className="workflow-saved-item" key={workflow.id}>
              <button className="workflow-list-item workflow-list-item-grow" onClick={() => onOpenWorkflow(workflow)} type="button">
                <strong className="workflow-type-section">{workflow.name}</strong>
                <span className="workflow-type-caption">{workflow.description || "无描述"}</span>
              </button>
              <Button
                aria-label={`删除工作流 ${workflow.name}`}
                onClick={() => onDeleteWorkflow(workflow.id)}
                title="删除工作流"
                type="button"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </PanelSection>
    </div>
  );
}

const categoryOrder = [
  { id: "input", label: "输入节点" },
  { id: "logic", label: "逻辑节点" },
  { id: "ai", label: "AI 节点" },
  { id: "tool", label: "处理节点" },
  { id: "asset", label: "资源节点" },
  { id: "character", label: "角色节点" },
  { id: "preview", label: "预览节点" },
  { id: "output", label: "输出节点" },
] as const;
