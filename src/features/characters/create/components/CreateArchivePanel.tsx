import { ChevronDown, Package, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AppTagInput } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useCreateArchiveSubmit } from "../hooks/useCreateArchiveSubmit";
import type {
  CreateArchivePostProcessState,
  PostProcessPreviewResult,
} from "../types/createArchiveTypes";
import { hasEnabledPostProcess } from "../types/createArchiveTypes";
import type {
  CharacterAssetRecord,
  CharacterMasterCandidatePlan,
  CharacterMasterPlanGenerationResult,
  CharacterWorkshopDraft,
} from "../../types";
import { CreateArchiveMetaSection } from "./CreateArchiveMetaSection";

interface CreateArchivePanelProps {
  analyzeReport?: PostProcessPreviewResult["analyzeReport"];
  creationError?: string;
  draft: CharacterWorkshopDraft;
  generationState: { result: CharacterMasterPlanGenerationResult; status: "success" };
  isCreatingCharacter: boolean;
  isPreviewingPostProcess: boolean;
  onCancel: () => void;
  onCreated: (record: CharacterAssetRecord) => void;
  onDraftChange: (patch: Partial<CharacterWorkshopDraft>) => void;
  onError: (message: string | undefined) => void;
  onPreviewPostProcess: () => void;
  onSubmitting: (value: boolean) => void;
  postProcessPreviewReady: boolean;
  postProcessState: CreateArchivePostProcessState;
  projectRoot: string;
  selectedPlan: CharacterMasterCandidatePlan;
  setCharacterImageStatus: (message: string) => void;
  setPostProcessState: (state: CreateArchivePostProcessState) => void;
}

const NAME_MAX = 30;
const DESCRIPTION_MAX = 300;

export function CreateArchivePanel({
  analyzeReport,
  creationError,
  draft,
  generationState,
  isCreatingCharacter,
  isPreviewingPostProcess,
  onCancel,
  onCreated,
  onDraftChange,
  onError,
  onPreviewPostProcess,
  onSubmitting,
  postProcessPreviewReady,
  postProcessState,
  projectRoot,
  selectedPlan,
  setCharacterImageStatus,
  setPostProcessState,
}: CreateArchivePanelProps) {
  const [displayName, setDisplayName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [tags, setTags] = useState(draft.featureTags);

  const { isSubmitting, submitArchive } = useCreateArchiveSubmit({
    draft,
    generationState,
    onComplete: onCreated,
    onError,
    postProcessPreviewReady,
    postProcessState,
    projectRoot,
    selectedPlan,
    setCharacterImageStatus,
  });

  useEffect(() => {
    onSubmitting(isSubmitting);
  }, [isSubmitting, onSubmitting]);

  const isSingleView = draft.direction === "single";
  const postProcessEnabled = hasEnabledPostProcess(postProcessState.options);
  const canCommit = !postProcessEnabled || postProcessPreviewReady;
  const normalizeWithoutMatting =
    postProcessState.options.runNormalize && !postProcessState.options.runRemoveBackground;
  const previewBlockedByViews =
    postProcessState.options.runViews &&
    !postProcessState.options.runRemoveBackground &&
    !postProcessState.options.runNormalize &&
    !postProcessState.options.runAnalyze;

  function updateOptions(patch: Partial<CreateArchivePostProcessState["options"]>) {
    setPostProcessState({
      ...postProcessState,
      options: { ...postProcessState.options, ...patch },
    });
  }

  function updateParams(patch: Partial<CreateArchivePostProcessState["params"]>) {
    setPostProcessState({
      ...postProcessState,
      params: { ...postProcessState.params, ...patch },
    });
  }

  return (
    <section aria-label="资源详情" className="create-archive-panel subpixel-antialiased">
      <header className="create-archive-panel-header">
        <strong>资源详情</strong>
        <Button onClick={onCancel} size="sm" type="button" variant="outline">
          返回选图
        </Button>
      </header>

      <div className="create-archive-panel-body app-scroll-ghost">
        <CreateArchiveMetaSection draft={draft} selectedPlan={selectedPlan} />

        <label className="create-archive-field">
          <div className="create-archive-field-label">
            <Label htmlFor="create-archive-name">角色名称</Label>
            <span className="create-archive-char-count">
              {displayName.trim().length}/{NAME_MAX}
            </span>
          </div>
          <Input
            id="create-archive-name"
            maxLength={NAME_MAX}
            onChange={(event) => setDisplayName(event.target.value)}
            value={displayName}
          />
        </label>

        <label className="create-archive-field">
          <div className="create-archive-field-label">
            <Label htmlFor="create-archive-description">一句话资产描述</Label>
            <span className="create-archive-char-count">
              {description.trim().length}/{DESCRIPTION_MAX}
            </span>
          </div>
          <Textarea
            className="create-archive-textarea"
            id="create-archive-description"
            maxLength={DESCRIPTION_MAX}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            value={description}
          />
        </label>

        <div className="create-archive-field">
          <Label>Tags 标签</Label>
          <AppTagInput
            maxTags={16}
            onValueChange={(nextTags) => {
              setTags(nextTags);
              onDraftChange({ featureTags: nextTags });
            }}
            placeholder="输入标签后按 Enter…"
            showAddButton={false}
            value={tags}
          />
        </div>

        <section aria-label="快捷后处理管道" className="create-archive-postprocess">
          <header>
            <strong>快捷后处理管道</strong>
            <small>先预览结果，满意后再入库</small>
          </header>

          <div className="create-archive-postprocess-list">
            {normalizeWithoutMatting ? (
              <p className="create-archive-normalize-hint">
                仅开启尺寸规范化时，不透明背景会把整图当作主体导致角色缩小。建议同时开启「智能去背」。
              </p>
            ) : null}

            <PostProcessSwitchRow
              checked={postProcessState.options.runRemoveBackground}
              description="移除背景并保留透明通道"
              expandedContent={
                <div className="create-archive-param-grid">
                  <label>
                    <span>容差</span>
                    <Input
                      max={96}
                      min={8}
                      onChange={(event) =>
                        setPostProcessState({
                          ...postProcessState,
                          params: {
                            ...postProcessState.params,
                            removeBackground: {
                              ...postProcessState.params.removeBackground,
                              tolerance: Number(event.target.value) || 34,
                            },
                          },
                        })
                      }
                      type="number"
                      value={postProcessState.params.removeBackground.tolerance}
                    />
                  </label>
                  <label>
                    <span>边缘柔化</span>
                    <Input
                      max={96}
                      min={0}
                      onChange={(event) =>
                        setPostProcessState({
                          ...postProcessState,
                          params: {
                            ...postProcessState.params,
                            removeBackground: {
                              ...postProcessState.params.removeBackground,
                              edgeSoftness: Number(event.target.value) || 24,
                            },
                          },
                        })
                      }
                      type="number"
                      value={postProcessState.params.removeBackground.edgeSoftness}
                    />
                  </label>
                </div>
              }
              label="智能去背 (Alpha)"
              onCheckedChange={(checked) => updateOptions({ runRemoveBackground: checked })}
            />

            <PostProcessSwitchRow
              checked={postProcessState.options.runNormalize}
              description="对齐到项目画布规格"
              expandedContent={
                <div className="create-archive-param-grid">
                  <label>
                    <span>目标宽</span>
                    <Input
                      min={8}
                      onChange={(event) =>
                        updateParams({
                          normalize: {
                            ...postProcessState.params.normalize,
                            targetWidth: Number(event.target.value) || 32,
                          },
                        })
                      }
                      type="number"
                      value={postProcessState.params.normalize.targetWidth}
                    />
                  </label>
                  <label>
                    <span>目标高</span>
                    <Input
                      min={8}
                      onChange={(event) =>
                        updateParams({
                          normalize: {
                            ...postProcessState.params.normalize,
                            targetHeight: Number(event.target.value) || 48,
                          },
                        })
                      }
                      type="number"
                      value={postProcessState.params.normalize.targetHeight}
                    />
                  </label>
                </div>
              }
              label="尺寸规范化"
              onCheckedChange={(checked) => updateOptions({ runNormalize: checked })}
            />

            <PostProcessSwitchRow
              checked={postProcessState.options.runAnalyze}
              description="检查覆盖率与边界框质量"
              expandedContent={
                <div className="create-archive-param-grid">
                  <label>
                    <span>最小前景占比 %</span>
                    <Input
                      min={1}
                      onChange={(event) =>
                        updateParams({
                          analyze: {
                            ...postProcessState.params.analyze,
                            minAlphaCoveragePct: Number(event.target.value) || 6,
                          },
                        })
                      }
                      type="number"
                      value={postProcessState.params.analyze.minAlphaCoveragePct}
                    />
                  </label>
                  <label>
                    <span>最大 bbox 高度 %</span>
                    <Input
                      min={50}
                      onChange={(event) =>
                        updateParams({
                          analyze: {
                            ...postProcessState.params.analyze,
                            maxBboxRatioPct: Number(event.target.value) || 85,
                          },
                        })
                      }
                      type="number"
                      value={postProcessState.params.analyze.maxBboxRatioPct}
                    />
                  </label>
                </div>
              }
              label="图像超分预检"
              onCheckedChange={(checked) => updateOptions({ runAnalyze: checked })}
            />

            {isSingleView ? (
              <PostProcessSwitchRow
                checked={postProcessState.options.runViews}
                description="单视图项目补全基础方向（预览暂不支持，确认入库后执行）"
                label="生成缺失视图"
                onCheckedChange={(checked) => updateOptions({ runViews: checked })}
              />
            ) : null}
          </div>

          {previewBlockedByViews ? (
            <p className="create-archive-preview-hint">「生成缺失视图」暂不支持预览，请同时勾选其他后处理步骤或入库后执行。</p>
          ) : null}

          {analyzeReport?.warnings.length ? (
            <div className="create-archive-analyze-report">
              {analyzeReport.score !== undefined ? (
                <strong>预检评分：{analyzeReport.score}</strong>
              ) : null}
              <ul>
                {analyzeReport.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {postProcessEnabled && !postProcessPreviewReady ? (
            <p className="create-archive-preview-hint">已启用后处理，请先点击「预览后处理」并在画布确认结果。</p>
          ) : null}
        </section>

        {creationError ? <p className="create-archive-error">{creationError}</p> : null}
      </div>

      <footer className="create-archive-panel-footer">
        {postProcessEnabled ? (
          <Button
            disabled={isPreviewingPostProcess || isSubmitting || previewBlockedByViews}
            onClick={onPreviewPostProcess}
            type="button"
            variant="outline"
          >
            <Sparkles aria-hidden="true" />
            {isPreviewingPostProcess ? "预览中..." : postProcessPreviewReady ? "重新预览后处理" : "预览后处理"}
          </Button>
        ) : null}
        <Button
          className="create-archive-submit"
          disabled={isCreatingCharacter || isSubmitting || !canCommit}
          onClick={() =>
            void submitArchive({
              description,
              displayName,
              tags,
            })
          }
          type="button"
        >
          <Package aria-hidden="true" />
          {isCreatingCharacter || isSubmitting ? "入库中..." : "确认入库并建立资产卡"}
        </Button>
      </footer>
    </section>
  );
}

interface PostProcessSwitchRowProps {
  checked: boolean;
  description?: string;
  expandedContent?: ReactNode;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}

function PostProcessSwitchRow({
  checked,
  description,
  expandedContent,
  label,
  onCheckedChange,
}: PostProcessSwitchRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible onOpenChange={setOpen} open={open && Boolean(expandedContent)}>
      <div className="create-archive-switch-row">
        <div className="create-archive-switch-row-main">
          <div>
            {expandedContent ? (
              <CollapsibleTrigger asChild>
                <button className="create-archive-switch-trigger" type="button">
                  <span>{label}</span>
                  <ChevronDown aria-hidden="true" className={cn("create-archive-switch-chevron", open && "is-open")} />
                </button>
              </CollapsibleTrigger>
            ) : (
              <span>{label}</span>
            )}
            {description ? <small>{description}</small> : null}
          </div>
          <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
        {expandedContent ? (
          <CollapsibleContent className="create-archive-switch-params">{expandedContent}</CollapsibleContent>
        ) : null}
      </div>
    </Collapsible>
  );
}
