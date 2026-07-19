import { convertFileSrc } from "@tauri-apps/api/core";
import { Check, ChevronDown, LoaderCircle, Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { AppTagInput, AssetOptionCard, IconButton, StatusBanner, Toolbar } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProductionToolDock, type ProductionToolDefinition } from "@/features/tools";

import { GenerationProgressOverlay } from "./GenerationProgressOverlay";

import type {
  CharacterAssetRecord,
  CharacterCreateMetadata,
  CharacterMasterCandidatePlan,
  CharacterPlanGenerationState,
} from "../types";

export type CharacterPlanPreviewVariant = "preview" | "candidates" | "legacy-full";

interface CharacterPlanPreviewProps {
  characterImageStatus?: string;
  createdCharacter?: CharacterAssetRecord;
  creationError?: string;
  generationState: CharacterPlanGenerationState;
  isCreatingCharacter?: boolean;
  onCreateCharacter?: (plan: CharacterMasterCandidatePlan, metadata: CharacterCreateMetadata) => void;
  onSelectPlan?: (plan: CharacterMasterCandidatePlan) => void;
  selectedPlanId?: string;
  variant?: CharacterPlanPreviewVariant;
}

export function CharacterPlanPreview({
  characterImageStatus,
  createdCharacter,
  creationError,
  generationState,
  isCreatingCharacter = false,
  onCreateCharacter,
  onSelectPlan,
  selectedPlanId,
  variant = "legacy-full",
}: CharacterPlanPreviewProps) {
  const generatedPlan = generationState.status === "success" ? generationState.result.plan : undefined;
  const isGenerating = generationState.status === "generating";
  const visibleCandidatePlans = generatedPlan?.candidatePlans ?? [];
  const defaultSelectedPlanId =
    selectedPlanId ??
    generatedPlan?.candidatePlans.find((plan) => plan.selected)?.id ??
    generatedPlan?.candidatePlans[0]?.id;
  const [internalSelectedPlanId, setInternalSelectedPlanId] = useState<string>();
  const [isPreviewBackgroundVisible, setIsPreviewBackgroundVisible] = useState(true);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [saveDescription, setSaveDescription] = useState("");
  const [saveTags, setSaveTags] = useState<string[]>(["主角", "战士", "近战"]);
  const [toolNotice, setToolNotice] = useState("");

  const activeSelectedPlanId = selectedPlanId ?? internalSelectedPlanId ?? defaultSelectedPlanId;
  const selectedGeneratedPlan =
    generatedPlan?.candidatePlans.find((plan) => plan.id === activeSelectedPlanId) ?? generatedPlan?.candidatePlans[0];
  const selectedPreviewImageUrl = getImagePreviewUrl(selectedGeneratedPlan?.masterImage);

  const showPreviewStage = variant === "preview" || variant === "candidates" || variant === "legacy-full";
  const showCandidateGrid = variant === "candidates" || variant === "legacy-full";
  const showSaveSection = variant === "legacy-full";
  const showWizardHeader = variant === "legacy-full";
  const isWizardVariant = variant === "preview" || variant === "candidates";

  useEffect(() => {
    if (!selectedPlanId) {
      setInternalSelectedPlanId(defaultSelectedPlanId);
    }
  }, [defaultSelectedPlanId, selectedPlanId]);

  useEffect(() => {
    if (generationState.status !== "success") {
      return;
    }

    setSaveDescription(generationState.result.plan.summary.slice(0, 100));
    setSaveTags(generationState.result.plan.visualKeywords.slice(0, 5));
  }, [generationState]);

  function handlePlanSelect(plan: CharacterMasterCandidatePlan) {
    if (onSelectPlan) {
      onSelectPlan(plan);
      return;
    }

    setInternalSelectedPlanId(plan.id);
  }

  return (
    <section
      className={`character-plan-panel ${isWizardVariant ? "character-plan-panel-wizard" : ""}`}
      data-variant={variant}
      aria-label="角色预览与候选方案"
    >
      {showWizardHeader ? (
        <header className="character-panel-title">
          <span className="step-dot">2</span>
          <div>
            <p className="panel-label">角色预览</p>
            <h3>AI 正在根据设定生成可入库的角色候选图</h3>
          </div>
        </header>
      ) : (
        <header className="character-panel-title character-panel-title-compact">
          <div>
            <p className="panel-label">{variant === "preview" ? "方案预览" : "候选方案"}</p>
            <h3>
              {variant === "preview"
                ? isGenerating
                  ? "正在生成母版方案与候选图"
                  : "查看 AI 母版方案与预览"
                : "选择最满意的候选方案"}
            </h3>
          </div>
        </header>
      )}

      <div className={`character-result-workspace ${variant === "candidates" ? "character-result-workspace-candidates" : ""}`}>
        {showPreviewStage ? (
          <section className="preview-stage-panel" aria-label="角色大图预览">
            <header>
              <div>
                <strong>角色预览</strong>
                <small>
                  {selectedGeneratedPlan
                    ? `${selectedGeneratedPlan.name} / ${getCandidateFocus(selectedGeneratedPlan)}`
                    : "生成后显示候选大图"}
                </small>
              </div>
            </header>
            <div className="preview-workflow-toolbar" aria-label="预览与处理工具">
              <details className="preview-plan-menu" aria-label="AI 母版方案">
                <summary>
                  <span>AI 方案</span>
                  <strong>{getPlanStatusLabel(generationState)}</strong>
                  <ChevronDown aria-hidden="true" size={14} />
                </summary>
                <PlanSummary state={generationState} />
              </details>
              {variant === "legacy-full" ? (
                <ProductionToolDock
                  hasSourceAsset={Boolean(selectedGeneratedPlan?.masterImage)}
                  onToolSelect={(tool) => setToolNotice(getToolNotice(tool))}
                  variant="toolbar"
                />
              ) : null}
            </div>
            <div
              className={`large-preview-frame ${isPreviewBackgroundVisible ? "with-preview-background" : "plain-preview-background"}`}
            >
              <div className="current-plan-badge">当前方案：{selectedGeneratedPlan?.id ?? "待生成"}</div>
              <Toolbar className="preview-stage-tools" label="预览工具">
                <span>背景</span>
                <IconButton
                  aria-label={isPreviewBackgroundVisible ? "隐藏预览背景" : "显示预览背景"}
                  aria-pressed={isPreviewBackgroundVisible}
                  onClick={() => setIsPreviewBackgroundVisible((currentValue) => !currentValue)}
                  size="icon-sm"
                  type="button"
                >
                  <Check aria-hidden="true" size={14} />
                </IconButton>
                <span>缩放</span>
                <IconButton
                  aria-label="缩小预览"
                  onClick={() => setPreviewZoom((value) => Math.max(60, value - 10))}
                  size="icon-sm"
                  type="button"
                >
                  <Minus aria-hidden="true" />
                </IconButton>
                <strong>{previewZoom}%</strong>
                <IconButton
                  aria-label="放大预览"
                  onClick={() => setPreviewZoom((value) => Math.min(160, value + 10))}
                  size="icon-sm"
                  type="button"
                >
                  <Plus aria-hidden="true" />
                </IconButton>
              </Toolbar>
              {isGenerating ? (
                <GenerationProgressOverlay
                  candidateIndex={generationState.candidateIndex}
                  candidateTotal={generationState.candidateTotal}
                  message={generationState.message}
                  phase={generationState.phase}
                  startedAt={generationState.startedAt}
                />
              ) : selectedPreviewImageUrl ? (
                <img
                  alt={selectedGeneratedPlan ? `${selectedGeneratedPlan.name} 母版预览` : "角色母版预览"}
                  src={selectedPreviewImageUrl}
                  style={{ transform: `scale(${previewZoom / 100})` }}
                />
              ) : (
                <div className="character-preview-empty" role="status">
                  {variant === "preview" ? "点击底部「生成方案」开始 AI 生成。" : "等待生成候选图"}
                </div>
              )}
              <div className="preview-size-label">
                {toolNotice ||
                  (isGenerating
                    ? "AI 正在生成真实母版候选图"
                    : selectedGeneratedPlan?.masterImage
                      ? "真实母版候选图"
                      : "等待生成候选图")}
              </div>
            </div>
          </section>
        ) : null}

        {showCandidateGrid ? (
          <section className="candidate-film-panel" aria-label="生成方案">
            <header>
              <div>
                {showWizardHeader ? <span className="step-dot">3</span> : null}
                <div>
                  <strong>角色方案库（{visibleCandidatePlans.length}）</strong>
                  <small>
                    {generationState.status === "success" ? "选择你最满意的方案" : "生成后会显示真实候选图"}
                  </small>
                </div>
              </div>
              {variant === "legacy-full" ? (
                <Button disabled={generationState.status === "generating"} type="button" variant="ghost">
                  <RotateCcw aria-hidden="true" />
                  重新生成
                </Button>
              ) : null}
            </header>

            <div className="candidate-film-row">
              {visibleCandidatePlans.length === 0 ? (
                <p className="character-view-slot-empty">尚未生成候选方案。请在上一步生成母版方案。</p>
              ) : (
                visibleCandidatePlans.map((plan, index) => (
                  <AssetOptionCard
                    badge={getCandidateNote(plan, index)}
                    focus={getCandidateFocus(plan)}
                    key={plan.id}
                    onSelect={() => handlePlanSelect(plan)}
                    preview={
                      isGenerating ? (
                        <CandidateImageSkeleton label={`方案 ${String.fromCharCode(65 + index)}`} />
                      ) : getImagePreviewUrl(getCandidateImage(plan)) ? (
                        <img alt="" src={getImagePreviewUrl(getCandidateImage(plan))} />
                      ) : (
                        <div className="character-preview-empty character-preview-empty-compact">未生成</div>
                      )
                    }
                    score={`${getCandidateFocus(plan)} · ${getCandidateScore(plan, index)}%`}
                    selected={plan.id === activeSelectedPlanId}
                    title={plan.name}
                  />
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>

      {creationError ? <p className="character-tool-message">{creationError}</p> : null}

      {showSaveSection && onCreateCharacter ? (
        <footer className="plan-action-bar">
          <div className="save-character-title">
            <span className="step-dot">4</span>
            <div>
              <strong>保存角色资产</strong>
              <small>保存后会写入角色库，后续从角色详情进入动作生产。</small>
            </div>
          </div>
          <div className="save-character-fields">
            <label>
              <span>入库描述</span>
              <Textarea
                maxLength={100}
                onChange={(event) => setSaveDescription(event.target.value)}
                placeholder="给这个角色添加一句便于检索的描述"
                value={saveDescription}
              />
            </label>
            <label>
              <span>筛选标签</span>
              <AppTagInput onValueChange={setSaveTags} value={saveTags} />
            </label>
          </div>
          <div className="character-create-status" aria-live="polite">
            {characterImageStatus ? <strong>{characterImageStatus}</strong> : null}
            {createdCharacter ? (
              <>
                <span>角色卡：{createdCharacter.projectRelativePath}/character.json</span>
                {createdCharacter.masterImage ? (
                  <span>母版图：{createdCharacter.masterImage.projectRelativePath}</span>
                ) : null}
              </>
            ) : null}
            {creationError ? <span className="error">{creationError}</span> : null}
          </div>
          <Button
            className="primary-action"
            disabled={!selectedGeneratedPlan?.masterImage || isCreatingCharacter}
            onClick={() => {
              if (selectedGeneratedPlan) {
                onCreateCharacter(selectedGeneratedPlan, {
                  description: saveDescription,
                  tags: saveTags,
                });
              }
            }}
            type="button"
          >
            <Check aria-hidden="true" />
            {isCreatingCharacter ? "正在保存角色" : "保存到角色库"}
          </Button>
        </footer>
      ) : null}
    </section>
  );
}

function getToolNotice(tool: ProductionToolDefinition) {
  if (tool.status === "designing") {
    return `${tool.label}正在接入，将基于当前候选图继续处理。`;
  }

  if (tool.status === "available") {
    return `准备进入${tool.label}。`;
  }

  return `${tool.label}仍在规划中。`;
}

function PlanSummary({ state }: { state: CharacterPlanGenerationState }) {
  if (state.status === "generating") {
    return (
      <StatusBanner
        description="任务已提交，正在等待 AI 服务返回。"
        meta={`任务：${state.taskId}`}
        title={state.message}
        variant="loading"
      />
    );
  }

  if (state.status === "error") {
    return (
      <StatusBanner
        description={state.message}
        meta={state.taskId ? `任务：${state.taskId}` : undefined}
        title="生成失败"
        variant="danger"
      />
    );
  }

  if (state.status === "idle") {
    return (
      <StatusBanner
        description="填写左侧角色设定后点击生成，AI 会产出母版方案和可预览的角色候选图。"
        title={state.message}
      />
    );
  }

  const { model, plan, providerName, taskId } = state.result;

  return (
    <div className="plan-structured-summary">
      <div className="plan-summary-heading">
        <strong>{plan.summary}</strong>
        <small>
          {providerName} / {model} / {taskId}
        </small>
      </div>

      <div className="plan-keyword-row">
        {plan.visualKeywords.map((keyword) => (
          <span key={keyword}>{keyword}</span>
        ))}
      </div>

      <div className="plan-section-grid">
        <section>
          <span>角色定位</span>
          <p>{plan.rolePositioning}</p>
        </section>
        <section>
          <span>像素提示词</span>
          <p>{plan.pixelPrompt}</p>
        </section>
        <section>
          <span>动作建议</span>
          <p>Idle：{plan.actionSuggestions.idle}</p>
          <p>Walk：{plan.actionSuggestions.walk}</p>
          <p>Attack：{plan.actionSuggestions.attack}</p>
        </section>
        <section>
          <span>一致性与导出</span>
          <ul>
            {[...plan.directionConsistency, ...plan.exportNotes].slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function CandidateImageSkeleton({ label }: { label: string }) {
  return (
    <div className="candidate-image-skeleton">
      <LoaderCircle aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function getPlanStatusLabel(state: CharacterPlanGenerationState) {
  if (state.status === "generating") {
    return "生成中";
  }

  if (state.status === "success") {
    return "已生成";
  }

  if (state.status === "error") {
    return "失败";
  }

  return "待生成";
}

function getCandidateNote(plan: CharacterMasterCandidatePlan, index: number) {
  if (plan.selected) {
    return "当前方案";
  }

  return index === 0 ? "推荐" : undefined;
}

function getCandidateScore(plan: CharacterMasterCandidatePlan, index: number) {
  return String(plan.recommendationScore ?? (index === 0 ? 92 : 92 - index * 4));
}

function getCandidateFocus(plan: CharacterMasterCandidatePlan) {
  return plan.focus || plan.name;
}

function getCandidateImage(plan: CharacterMasterCandidatePlan) {
  return plan.masterImage;
}

function getImagePreviewUrl(image: CharacterMasterCandidatePlan["masterImage"]) {
  if (image?.dataUrl) {
    return image.dataUrl;
  }

  if (!image?.absolutePath) {
    return "";
  }

  return convertFileSrc(image.absolutePath);
}
