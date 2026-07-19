import { Copy, ExternalLink, FolderOpen, RotateCcw, SlidersHorizontal } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppSelect, InspectorField, PanelSection } from "@/components/shared";

import { getWorkflowNodeDefinition } from "./nodeCatalog";
import type { WorkflowDefinition, WorkflowNode, WorkflowNodeDefinition, WorkflowNodeRun, WorkflowParamDefinition, WorkflowRun } from "./types";
import { getWorkflowPortKindLabel } from "./workflowLabels";
import { parseMultiSelectValue, serializeMultiSelectValue, toggleMultiSelectValue } from "./workflowMultiSelect";
import { resolveParamWidget, shouldRenderWorkflowParamField, validateWorkflowNodeParams } from "./workflowParamValidation";
import { WorkflowNodeProgress } from "./WorkflowNodeProgress";
import { WorkflowOutputPreview } from "./WorkflowOutputPreview";
import { WorkflowPreviewErrorBoundary } from "./WorkflowPreviewErrorBoundary";
import { resolveNodePreviewAssets, resolveMasterPlanPreview, resolvePromptPreview, resolveUpstreamCandidateAssets, resolveUpstreamCandidateTaskId } from "./workflowPreviewAssets";
import { WorkflowAiProviderSelect } from "./components/WorkflowAiProviderSelect";
import { WorkflowCandidatePlanPicker } from "./components/WorkflowCandidatePlanPicker";
import { WorkflowOutputFileInfo } from "./components/WorkflowOutputFileInfo";
import { StyleProfileNodeInspector } from "./inspectors/StyleProfileNodeInspector";
import { resolveUpstreamCharacterLabel } from "./workflowLayoutModes";

interface CharacterOption {
  id: string;
  label: string;
}

interface WorkflowInspectorProps {
  characters: CharacterOption[];
  definition: WorkflowDefinition;
  isRetryingNode?: boolean;
  onDefinitionChange: (definition: WorkflowDefinition) => void;
  onOpenAssetTools: () => void;
  onOpenCharacters: () => void;
  onRetryNode?: (nodeId: string) => void;
  projectRoot: string;
  selectedNode?: WorkflowNode;
  selectedNodeRun?: WorkflowNodeRun;
  selectedRun?: WorkflowRun;
}

export function WorkflowInspector({
  characters,
  definition,
  isRetryingNode = false,
  onDefinitionChange,
  onOpenAssetTools,
  onOpenCharacters,
  onRetryNode,
  projectRoot,
  selectedNode,
  selectedNodeRun,
  selectedRun,
}: WorkflowInspectorProps) {
  const [activeTab, setActiveTab] = useState("properties");
  const [previewActiveIndex, setPreviewActiveIndex] = useState(0);
  const nodeDefinition = selectedNode ? getWorkflowNodeDefinition(selectedNode.kind) : undefined;
  const paramErrors = useMemo(
    () =>
      selectedNode && nodeDefinition
        ? validateWorkflowNodeParams(
            selectedNode,
            (nodeDefinition.paramsSchema ?? []).filter((field) =>
              shouldRenderWorkflowParamField(field, selectedNode, definition),
            ),
            definition,
          )
        : {},
    [definition, nodeDefinition?.paramsSchema, selectedNode],
  );
  const previewAssets = useMemo(
    () =>
      resolveNodePreviewAssets(
        selectedNodeRun?.outputs as Record<string, unknown> | undefined,
        selectedNode?.kind,
      ),
    [selectedNode?.kind, selectedNodeRun?.outputs],
  );
  const upstreamCandidateAssets = useMemo(
    () =>
      selectedNode
        ? resolveUpstreamCandidateAssets(definition, selectedNode.id, selectedRun)
        : { images: [], kind: "empty" as const },
    [definition, selectedNode, selectedRun],
  );
  const promptPreview = useMemo(
    () => resolvePromptPreview(selectedNodeRun?.outputs as Record<string, unknown> | undefined),
    [selectedNodeRun?.outputs],
  );
  const masterPlanPreview = useMemo(
    () => resolveMasterPlanPreview(selectedNodeRun?.outputs as Record<string, unknown> | undefined),
    [selectedNodeRun?.outputs],
  );

  const upstreamCandidateTaskId = useMemo(
    () =>
      selectedNode
        ? resolveUpstreamCandidateTaskId(definition, selectedNode.id, selectedRun)
        : undefined,
    [definition, selectedNode, selectedRun],
  );
  const lastCandidateTaskIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setActiveTab("properties");
    setPreviewActiveIndex(0);
  }, [selectedNode?.id]);

  useEffect(() => {
    if (!selectedNode || selectedNode.kind !== "character.create") {
      lastCandidateTaskIdRef.current = upstreamCandidateTaskId;
      return;
    }

    const previousTaskId = lastCandidateTaskIdRef.current;
    lastCandidateTaskIdRef.current = upstreamCandidateTaskId;

    if (
      previousTaskId &&
      upstreamCandidateTaskId &&
      previousTaskId !== upstreamCandidateTaskId &&
      String(selectedNode.params.selectedPlanId ?? "").trim()
    ) {
      const nextNodes = definition.nodes.map((node) =>
        node.id === selectedNode.id
          ? { ...node, params: { ...node.params, selectedPlanId: "" } }
          : node,
      );
      onDefinitionChange({ ...definition, nodes: nextNodes });
    }
  }, [definition, onDefinitionChange, selectedNode, upstreamCandidateTaskId]);

  if (!selectedNode) {
    return (
      <PanelSection icon={SlidersHorizontal} title="工作流设置">
        <InspectorField label="名称">
          <Input value={definition.name} onChange={(event) => onDefinitionChange({ ...definition, name: event.target.value })} />
        </InspectorField>
        <InspectorField label="描述">
          <Input
            value={definition.description}
            onChange={(event) => onDefinitionChange({ ...definition, description: event.target.value })}
          />
        </InspectorField>
        <p className="workflow-muted">选中画布节点后可编辑节点属性、端口和说明。</p>
      </PanelSection>
    );
  }

  const Icon = nodeDefinition?.icon ?? SlidersHorizontal;
  const canRetryNode =
    Boolean(selectedRun && selectedNodeRun && onRetryNode) &&
    (selectedNodeRun?.status === "failed" ||
      selectedNodeRun?.status === "skipped" ||
      Boolean(selectedNodeRun?.error));
  const previewImageKey =
    previewAssets.images[0]?.absolutePath ?? previewAssets.images[0]?.projectRelativePath ?? selectedNode.id;
  const isStyleProfileNode = selectedNode.kind === "character.styleProfile";
  const selectedNodeId = selectedNode.id;
  const runTaskId = resolveRunTaskId(selectedNodeRun?.outputs as Record<string, unknown> | undefined);
  const upstreamCharacterLabel = resolveUpstreamCharacterLabel(definition, selectedNode.id, selectedRun);
  const activePreviewImage = previewAssets.images[previewActiveIndex] ?? previewAssets.images[0];

  function patchNodeParam(key: string, value: unknown) {
    const nextNodes = definition.nodes.map((node) =>
      node.id === selectedNodeId ? { ...node, params: { ...node.params, [key]: value } } : node,
    );
    onDefinitionChange({ ...definition, nodes: nextNodes });
  }

  return (
    <>
      <PanelSection icon={Icon} title={nodeDefinition?.label ?? selectedNode.kind}>
        {canRetryNode ? (
          <div className="workflow-inspector-retry-row">
            <Button disabled={isRetryingNode} onClick={() => onRetryNode?.(selectedNode.id)} size="sm" type="button" variant="outline">
              <RotateCcw aria-hidden="true" />
              {isRetryingNode ? "重试中..." : "重试此节点"}
            </Button>
            <p className="workflow-muted">将基于当前运行记录重新执行该节点及其下游依赖。</p>
          </div>
        ) : null}
        {isStyleProfileNode ? (
          <>
            <p className="workflow-type-caption">{nodeDefinition?.description}</p>
            <StyleProfileNodeInspector
              definition={definition}
              onDefinitionChange={onDefinitionChange}
              projectRoot={projectRoot}
              selectedNode={selectedNode}
            />
            <WorkflowNodeProgress progress={selectedNodeRun?.progress} status={selectedNodeRun?.status ?? "queued"} />
            {selectedNodeRun?.outputs ? (
              <WorkflowPreviewErrorBoundary>
                <WorkflowOutputPreview assets={previewAssets} key={previewImageKey} projectRoot={projectRoot} />
              </WorkflowPreviewErrorBoundary>
            ) : null}
          </>
        ) : (
        <Tabs className="workflow-inspector-tabs" onValueChange={setActiveTab} value={activeTab}>
          <TabsList className="workflow-tabs-list" variant="line">
            <TabsTrigger className="workflow-tab-trigger" value="properties">
              属性
            </TabsTrigger>
            <TabsTrigger className="workflow-tab-trigger" value="inputs">
              输入
            </TabsTrigger>
            <TabsTrigger className="workflow-tab-trigger" value="outputs">
              输出
            </TabsTrigger>
            {promptPreview ? (
              <TabsTrigger className="workflow-tab-trigger" value="prompt">
                Prompt
              </TabsTrigger>
            ) : null}
            {masterPlanPreview ? (
              <TabsTrigger className="workflow-tab-trigger" value="master-plan">
                方案
              </TabsTrigger>
            ) : null}
            <TabsTrigger className="workflow-tab-trigger" value="help">
              说明
            </TabsTrigger>
          </TabsList>

          <TabsContent className="workflow-tab-content" value="properties">
            <p className="workflow-type-caption">{nodeDefinition?.description}</p>
            {selectedNode.kind === "character.create" ? (
              <WorkflowCandidatePlanPicker
                assets={upstreamCandidateAssets}
                description="每次运行仅创建 1 个角色目录；不会批量入库全部候选图。"
                onSelect={(planId) => patchNodeParam("selectedPlanId", planId)}
                projectRoot={projectRoot}
                selectedPlanId={String(selectedNode.params.selectedPlanId ?? "")}
                title="选择入库方案"
              />
            ) : null}
            {upstreamCharacterLabel ? (
              <InspectorField label="当前角色">
                <p className="workflow-type-body">{upstreamCharacterLabel}</p>
              </InspectorField>
            ) : null}
            {nodeDefinition?.paramsSchema.length ? (
              renderGroupedParamFields(
                selectedNode,
                nodeDefinition.paramsSchema.filter((field) =>
                  shouldRenderWorkflowParamField(field, selectedNode, definition),
                ),
                nodeDefinition.paramGroups,
                paramErrors,
                projectRoot,
                characters,
                patchNodeParam,
              )
            ) : (
              <p className="workflow-muted">当前节点没有可编辑参数。</p>
            )}
          </TabsContent>

          <TabsContent className="workflow-tab-content" value="inputs">
            <PortList emptyText="此节点不需要输入。" ports={nodeDefinition?.inputs ?? []} />
          </TabsContent>

          <TabsContent className="workflow-tab-content" value="outputs">
            <PortList emptyText="此节点没有输出端口。" ports={nodeDefinition?.outputs ?? []} />
            {activeTab === "outputs" ? (
              <>
                <WorkflowNodeProgress progress={selectedNodeRun?.progress} status={selectedNodeRun?.status ?? "queued"} />
                {selectedNode.kind === "character.generateCandidates" && previewAssets.kind !== "empty" ? (
                  <WorkflowCandidatePlanPicker
                    assets={previewAssets}
                    description="候选图仅供预览与对比；请在「创建角色」节点选择最终入库方案。"
                    projectRoot={projectRoot}
                    readOnly
                    selectedPlanId=""
                    title="候选图预览"
                  />
                ) : null}
                <WorkflowPreviewErrorBoundary>
                  <WorkflowOutputPreview
                    assets={previewAssets}
                    key={previewImageKey}
                    onActiveImageChange={setPreviewActiveIndex}
                    projectRoot={projectRoot}
                  />
                </WorkflowPreviewErrorBoundary>
                <WorkflowOutputFileInfo image={activePreviewImage} />
              </>
            ) : null}
          </TabsContent>

          <TabsContent className="workflow-tab-content" value="prompt">
            {promptPreview ? (
              <div className="workflow-prompt-preview">
                <InspectorField label="正向 Prompt">
                  <pre className="workflow-prompt-preview-block">{promptPreview.prompt}</pre>
                </InspectorField>
                <InspectorField label="负向 Prompt">
                  <pre className="workflow-prompt-preview-block">{promptPreview.negativePrompt}</pre>
                </InspectorField>
                {promptPreview.astSummary ? (
                  <InspectorField label="AST 摘要">
                    <pre className="workflow-prompt-preview-block">{promptPreview.astSummary}</pre>
                  </InspectorField>
                ) : null}
              </div>
            ) : (
              <p className="workflow-muted">暂无 Prompt 编译输出。</p>
            )}
          </TabsContent>

          <TabsContent className="workflow-tab-content" value="master-plan">
            {masterPlanPreview ? (
              <div className="workflow-master-plan-preview">
                {masterPlanPreview.summary ? (
                  <InspectorField label="方案摘要">
                    <p className="workflow-type-body">{masterPlanPreview.summary}</p>
                  </InspectorField>
                ) : null}
                {masterPlanPreview.pixelPrompt ? (
                  <InspectorField label="图像 Prompt">
                    <pre className="workflow-prompt-preview-block">{masterPlanPreview.pixelPrompt}</pre>
                  </InspectorField>
                ) : null}
                {masterPlanPreview.candidatePlans.length ? (
                  <InspectorField label="候选方案">
                    <div className="workflow-master-plan-list">
                      {masterPlanPreview.candidatePlans.map((plan) => (
                        <div className="workflow-master-plan-item" key={plan.id}>
                          <strong>{plan.name}</strong>
                          {plan.recommendationScore !== undefined ? (
                            <span className="workflow-type-caption">推荐分 {plan.recommendationScore}</span>
                          ) : null}
                          {plan.focus ? <p className="workflow-type-caption">{plan.focus}</p> : null}
                        </div>
                      ))}
                    </div>
                  </InspectorField>
                ) : null}
              </div>
            ) : (
              <p className="workflow-muted">暂无母版方案输出。</p>
            )}
          </TabsContent>

          <TabsContent className="workflow-tab-content" value="help">
            <p className="workflow-muted">{nodeDefinition?.helpText ?? "暂无说明。"}</p>
            {runTaskId ? (
              <details className="workflow-debug-details">
                <summary>调试信息</summary>
                <InspectorField label="任务 ID">
                  <div className="workflow-run-id-field">
                    <code className="workflow-run-id-value">{runTaskId}</code>
                    <Button
                      aria-label="复制任务 ID"
                      onClick={() => void navigator.clipboard.writeText(runTaskId)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Copy aria-hidden="true" />
                      复制
                    </Button>
                  </div>
                </InspectorField>
              </details>
            ) : null}
            <div className="workflow-node-meta">
              <span>节点 ID</span>
              <strong>{selectedNode.id}</strong>
            </div>
            <div className="workflow-node-meta">
              <span>节点类型</span>
              <strong>{selectedNode.kind}</strong>
            </div>
          </TabsContent>
        </Tabs>
        )}
      </PanelSection>

      <PanelSection icon={ExternalLink} title="专用视图">
        <div className="workflow-special-view-actions">
          <Button onClick={onOpenCharacters} size="sm" type="button" variant="outline">
            打开角色工坊
          </Button>
          <Button onClick={onOpenAssetTools} size="sm" type="button" variant="outline">
            打开素材工具
          </Button>
        </div>
      </PanelSection>
    </>
  );
}

function renderGroupedParamFields(
  node: WorkflowNode,
  fields: WorkflowParamDefinition[],
  groups: WorkflowNodeDefinition["paramGroups"],
  paramErrors: Record<string, string | undefined>,
  projectRoot: string,
  characters: CharacterOption[],
  onParamChange: (key: string, value: unknown) => void,
) {
  if (!groups?.length) {
    return fields.map((field) =>
      renderParamField(node, field, paramErrors[field.id], projectRoot, characters, onParamChange),
    );
  }

  const grouped = new Map<string, WorkflowParamDefinition[]>();
  const ungrouped: WorkflowParamDefinition[] = [];

  for (const field of fields) {
    if (field.group) {
      const items = grouped.get(field.group) ?? [];
      items.push(field);
      grouped.set(field.group, items);
    } else {
      ungrouped.push(field);
    }
  }

  return (
    <>
      {groups.map((group) => {
        const items = grouped.get(group.id);
        if (!items?.length) {
          return null;
        }

        return (
          <div className="workflow-param-group" key={group.id}>
            <p className="workflow-param-group-title">{group.label}</p>
            {items.map((field) =>
              renderParamField(node, field, paramErrors[field.id], projectRoot, characters, onParamChange),
            )}
          </div>
        );
      })}
      {ungrouped.map((field) =>
        renderParamField(node, field, paramErrors[field.id], projectRoot, characters, onParamChange),
      )}
    </>
  );
}

function renderParamField(
  node: WorkflowNode,
  field: WorkflowParamDefinition,
  error: string | undefined,
  projectRoot: string,
  characters: CharacterOption[],
  onParamChange: (key: string, value: unknown) => void,
) {
  const value = node.params[field.id] ?? field.defaultValue ?? "";
  const widget = resolveParamWidget(field);

  if (field.widget === "multiSelect") {
    const selected = parseMultiSelectValue(value);
    return (
      <InspectorField hint={field.description} key={field.id} label={formatFieldLabel(field)}>
        <div className="workflow-inspector-chips" role="group" aria-label={field.label}>
          {(field.options ?? []).map((option) => {
            const active = selected.includes(option.value);
            return (
              <button
                aria-pressed={active}
                className="workflow-inspector-chip"
                data-active={active}
                key={option.value}
                onClick={() => onParamChange(field.id, serializeMultiSelectValue(toggleMultiSelectValue(selected, option.value)))}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {error ? <small className="workflow-field-error">{error}</small> : null}
      </InspectorField>
    );
  }

  if (field.type === "select") {
    return (
      <InspectorField hint={field.description} key={field.id} label={formatFieldLabel(field)}>
        <AppSelect
          ariaLabel={field.label}
          onValueChange={(nextValue) => onParamChange(field.id, nextValue)}
          options={field.options ?? []}
          value={String(value)}
        />
        {error ? <small className="workflow-field-error">{error}</small> : null}
      </InspectorField>
    );
  }

  if (field.type === "number") {
    const numericValue = Number(value);
    if (field.widget === "slider" && field.min !== undefined && field.max !== undefined) {
      const min = field.min;
      const max = field.max;
      const step = max - min <= 1 ? 0.05 : 1;
      return (
        <InspectorField hint={field.description} key={field.id} label={formatFieldLabel(field)}>
          <div className="workflow-inspector-slider">
            <Slider
              aria-label={field.label}
              max={max}
              min={min}
              onValueChange={(next) => onParamChange(field.id, next[0] ?? numericValue)}
              step={step}
              value={[Number.isFinite(numericValue) ? numericValue : min]}
            />
            <span className="workflow-inspector-slider-value">{Number.isFinite(numericValue) ? numericValue : min}</span>
          </div>
          {error ? <small className="workflow-field-error">{error}</small> : null}
        </InspectorField>
      );
    }
    return (
      <InspectorField hint={field.description} key={field.id} label={formatFieldLabel(field)}>
        <Input
          max={field.max}
          min={field.min}
          onChange={(event) => onParamChange(field.id, normalizeNumber(event.target.value, field.min, field.max, Number(field.defaultValue ?? 0)))}
          type="number"
          value={Number(value)}
        />
        {error ? <small className="workflow-field-error">{error}</small> : null}
      </InspectorField>
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="app-inspector-field" key={field.id}>
        <label className="workflow-boolean-row">
          <span className="app-inspector-label">{field.label}</span>
          <Switch checked={Boolean(value)} onCheckedChange={(checked) => onParamChange(field.id, checked === true)} />
        </label>
        {field.description ? <small className="app-inspector-description">{field.description}</small> : null}
        {error ? <small className="workflow-field-error">{error}</small> : null}
      </div>
    );
  }

  if (widget === "textarea") {
    return (
      <InspectorField hint={field.description} key={field.id} label={formatFieldLabel(field)}>
        <Textarea
          onChange={(event) => onParamChange(field.id, event.target.value)}
          rows={4}
          value={String(value)}
        />
        {error ? <small className="workflow-field-error">{error}</small> : null}
      </InspectorField>
    );
  }

  if (widget === "characterRef") {
    const options =
      characters.length > 0
        ? characters.map((character) => ({ label: character.label, value: character.id }))
        : [{ label: "暂无角色，请先在角色工坊创建", value: "" }];

    return (
      <InspectorField hint={field.description} key={field.id} label={formatFieldLabel(field)}>
        <AppSelect
          ariaLabel={field.label}
          onValueChange={(nextValue) => onParamChange(field.id, nextValue)}
          options={options}
          value={String(value)}
        />
        {error ? <small className="workflow-field-error">{error}</small> : null}
      </InspectorField>
    );
  }

  if (widget === "aiProviderSelect") {
    const binding = field.binding ?? "text";

    return (
      <WorkflowAiProviderSelect
        binding={binding}
        key={field.id}
        model={String(node.params.model ?? "")}
        onModelChange={(nextValue) => onParamChange("model", nextValue)}
        onProviderChange={(nextValue) => onParamChange("providerId", nextValue)}
        providerId={String(node.params.providerId ?? "")}
      />
    );
  }

  if (widget === "projectPath" || widget === "assetRef") {
    return (
      <InspectorField hint={field.description} key={field.id} label={formatFieldLabel(field)}>
        <div className="workflow-path-field">
          <Input
            placeholder={widget === "projectPath" ? "例如 assets/images/source.png" : "例如 assets/exports/output.png"}
            value={String(value)}
            onChange={(event) => onParamChange(field.id, event.target.value)}
          />
          <Button
            aria-label={`浏览${field.label}`}
            onClick={() => void pickPathValue(field, node, projectRoot, onParamChange)}
            size="sm"
            type="button"
            variant="outline"
          >
            <FolderOpen aria-hidden="true" />
            浏览
          </Button>
        </div>
        {error ? <small className="workflow-field-error">{error}</small> : null}
      </InspectorField>
    );
  }

  return (
    <InspectorField hint={field.description} key={field.id} label={formatFieldLabel(field)}>
      <Input value={String(value)} onChange={(event) => onParamChange(field.id, event.target.value)} />
      {error ? <small className="workflow-field-error">{error}</small> : null}
    </InspectorField>
  );
}

async function pickPathValue(
  field: WorkflowParamDefinition,
  node: WorkflowNode,
  projectRoot: string,
  onParamChange: (key: string, value: unknown) => void,
) {
  const sourceKind = node.params.sourceKind;
  const useDirectory = field.widget === "assetRef" && field.id.includes("dir");

  const selectedPath = await open({
    defaultPath: projectRoot,
    directory: useDirectory,
    filters: useDirectory ? undefined : [{ extensions: ["png", "jpg", "jpeg", "webp", "json"], name: "项目文件" }],
    multiple: false,
    title: `选择${field.label}`,
  });

  if (typeof selectedPath !== "string") {
    return;
  }

  if (sourceKind === "projectRelativePath" || field.widget === "projectPath") {
    const normalizedRoot = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "");
    const normalizedPath = selectedPath.replace(/\\/g, "/");
    const relativePath = normalizedPath.startsWith(`${normalizedRoot}/`)
      ? normalizedPath.slice(normalizedRoot.length + 1)
      : selectedPath;

    onParamChange(field.id, relativePath);
    return;
  }

  onParamChange(field.id, selectedPath);
}

function resolveRunTaskId(outputs?: Record<string, unknown>): string | undefined {
  if (!outputs) {
    return undefined;
  }

  const asset = outputs.asset as Record<string, unknown> | undefined;
  const data = asset?.data as Record<string, unknown> | undefined;
  const taskId = data?.taskId;

  if (typeof taskId === "string" && taskId.trim()) {
    return taskId.trim();
  }

  return undefined;
}

function formatFieldLabel(field: WorkflowParamDefinition) {
  return field.required ? `${field.label} *` : field.label;
}

function PortList({
  emptyText,
  ports,
}: {
  emptyText: string;
  ports: Array<{ id: string; kind: string; label: string }>;
}) {
  if (!ports.length) {
    return <p className="workflow-muted">{emptyText}</p>;
  }

  return (
    <div className="workflow-port-list">
      {ports.map((port) => (
        <div className="workflow-port-row" key={port.id}>
          <span>{port.label}</span>
          <strong>{getWorkflowPortKindLabel(port.kind)}</strong>
        </div>
      ))}
    </div>
  );
}

function normalizeNumber(value: string, min: number | undefined, max: number | undefined, fallback: number) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(max ?? parsedValue, Math.max(min ?? parsedValue, parsedValue));
}
