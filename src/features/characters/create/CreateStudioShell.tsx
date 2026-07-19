import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useState } from "react";

import { StatusBanner } from "@/components/shared/StatusBanner";
import { NodeProgressRail, type ProgressStepItem, WorkbenchLayout } from "@/components/shared";
import { InspectorPanel } from "@/components/shared/InspectorPanel";
import { cn } from "@/lib/utils";
import { appLogger } from "@/lib/logger";
import { generateCharacterMasterCandidates, getAppSettings } from "@/lib/tauri/commands";
import { generateMasterPlan, previewCandidatePostProcess } from "@/lib/tauri/characterPipeline";
import type { PipelineProject } from "@/features/projects/types";

import { entityTypeLabels, roleLabels } from "../archetypes/defaults";
import { compileDraftPromptText } from "./compile/draftToPromptInputs";
import { CreateAssistSidebar } from "./components/CreateAssistSidebar";
import { CreateCenterPanel } from "./components/CreateCenterPanel";
import { CreateStudioToolbar } from "./components/studio/CreateStudioToolbar";
import { ConceptSetupStep, validateCreateDraft } from "./setup/ConceptSetupStep";
import { createCharacterPlanTaskId } from "../services/characterPlanGeneration";
import { useCharacterWorkshopStore, type CreatePhase } from "../stores/characterWorkshopStore";
import type {
  CharacterAssetRecord,
  CharacterMasterCandidatePlan,
  CharacterMasterPlanGenerationResult,
} from "../types";
import {
  buildDefaultPostProcessParams,
  collectPlanSourceImages,
  type CreateArchivePostProcessState,
  type PostProcessPreviewImages,
  type PostProcessPreviewResult,
} from "./types/createArchiveTypes";

import "./CreateStudio.css";

interface CharacterGenerationProgressEvent {
  candidateIndex: number;
  candidateTotal: number;
  message: string;
  phase: "candidates" | "plan";
  taskId: string;
}

interface CreateStudioShellProps {
  onCharacterCreated: (record: CharacterAssetRecord) => void;
  onEnterProduction: (record: CharacterAssetRecord) => void;
  onExit: () => void;
  project: PipelineProject;
  stylePresets: Array<{ label: string; value: string }>;
}

export function CreateStudioShell({
  onCharacterCreated,
  onExit,
  project,
}: CreateStudioShellProps) {
  const createDraft = useCharacterWorkshopStore((state) => state.createDraft);
  const createPhase = useCharacterWorkshopStore((state) => state.createPhase);
  const createSetupFocusSection = useCharacterWorkshopStore((state) => state.createSetupFocusSection);
  const createSelectedPlanId = useCharacterWorkshopStore((state) => state.createSelectedPlanId);
  const generationState = useCharacterWorkshopStore((state) => state.createGenerationSession);
  const resetCreateGenerationSession = useCharacterWorkshopStore((state) => state.resetCreateGenerationSession);
  const setCreateActiveTaskId = useCharacterWorkshopStore((state) => state.setCreateActiveTaskId);
  const setCreateDraft = useCharacterWorkshopStore((state) => state.setCreateDraft);
  const setCreateGenerationSession = useCharacterWorkshopStore((state) => state.setCreateGenerationSession);
  const setCreatePhase = useCharacterWorkshopStore((state) => state.setCreatePhase);
  const setCreateSelectedPlanId = useCharacterWorkshopStore((state) => state.setCreateSelectedPlanId);
  const setCreateSetupFocusSection = useCharacterWorkshopStore((state) => state.setCreateSetupFocusSection);

  const [creationError, setCreationError] = useState<string>();
  const [characterImageStatus, setCharacterImageStatus] = useState<string>();
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [isPreviewingPostProcess, setIsPreviewingPostProcess] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string>();
  const [imageSourceMode, setImageSourceMode] = useState<"original" | "processed">("original");
  const [postProcessPreview, setPostProcessPreview] = useState<PostProcessPreviewImages>();
  const [postProcessPreviewReady, setPostProcessPreviewReady] = useState(false);
  const [postProcessAnalyzeReport, setPostProcessAnalyzeReport] =
    useState<PostProcessPreviewResult["analyzeReport"]>();
  const [postProcessState, setPostProcessState] = useState<CreateArchivePostProcessState>(() => ({
    options: {
      runAnalyze: false,
      runNormalize: false,
      runRemoveBackground: false,
      runViews: createDraft.direction === "single",
    },
    params: {
      analyze: { maxBboxRatioPct: 85, minAlphaCoveragePct: 6 },
      normalize: { scaleMode: "integer", targetHeight: 48, targetWidth: 32 },
      removeBackground: {
        alphaMatting: false,
        backgroundThreshold: 10,
        cleanupStrength: "standard",
        customModelPath: "",
        edgeSoftness: 24,
        engine: "chroma",
        executablePath: "",
        foregroundThreshold: 240,
        holeFillMaxPixels: 64,
        mattingColorSpace: "rgb",
        model: "isnet-general-use",
        preserveSmallParts: true,
        spillSuppression: 50,
        tolerance: 34,
      },
    },
  }));

  const draftValidation = useMemo(() => validateCreateDraft(createDraft), [createDraft]);
  const isGenerating = createPhase === "generating" || generationState.status === "generating";
  const candidatePlans = useMemo(
    () => (generationState.status === "success" ? generationState.result.plan.candidatePlans : []),
    [generationState],
  );
  const selectedPlan = useMemo(() => {
    if (generationState.status !== "success") {
      return undefined;
    }

    const plans = generationState.result.plan.candidatePlans;
    if (createSelectedPlanId) {
      return plans.find((plan) => plan.id === createSelectedPlanId) ?? plans[0];
    }

    return plans.find((plan) => plan.selected) ?? plans[0];
  }, [createSelectedPlanId, generationState]);
  const canSave = generationState.status === "success" && Boolean(selectedPlan?.masterImage);
  const displayName = createDraft.name.trim() || "未命名角色";
  const isInspectorLocked = createPhase === "finalize";

  const idlePreviewMessage =
    generationState.status === "error"
      ? generationState.message
      : "调整左侧设定后点击「生成母版」，进度将显示在预览画布中。";

  const planSummary =
    generationState.status === "success" ? generationState.result.plan.summary : undefined;

  function clearPostProcessPreview() {
    setPostProcessPreview(undefined);
    setPostProcessPreviewReady(false);
    setPostProcessAnalyzeReport(undefined);
    setImageSourceMode("original");
  }

  useEffect(() => {
    let cancelled = false;

    void getAppSettings().then((settings) => {
      if (cancelled) {
        return;
      }

      setPostProcessState((current) => ({
        ...current,
        params: buildDefaultPostProcessParams(settings, createDraft),
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [createDraft.customHeight, createDraft.customWidth, createDraft.size]);

  const postProcessOptionsKey = useMemo(
    () => JSON.stringify(postProcessState.options),
    [postProcessState.options],
  );

  useEffect(() => {
    clearPostProcessPreview();
  }, [createSelectedPlanId]);

  useEffect(() => {
    clearPostProcessPreview();
  }, [postProcessOptionsKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      clearPostProcessPreview();
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
  }, [postProcessState.params]);

  useEffect(() => {
    setCreatePhase("setup");
    setCreateSetupFocusSection(null);
    resetCreateGenerationSession();
    clearPostProcessPreview();
  }, [project.rootPath, resetCreateGenerationSession, setCreatePhase, setCreateSetupFocusSection]);

  async function handlePreviewPostProcess() {
    if (generationState.status !== "success" || !selectedPlan) {
      return;
    }

    setIsPreviewingPostProcess(true);
    setCreationError(undefined);

    try {
      const result = await previewCandidatePostProcess({
        options: postProcessState.options,
        params: postProcessState.params,
        planId: selectedPlan.id,
        projectRoot: project.rootPath,
        sourceImages: collectPlanSourceImages(selectedPlan),
        taskId: generationState.result.taskId,
      });

      setPostProcessPreview(result.directionPreviews);
      setPostProcessPreviewReady(true);
      setPostProcessAnalyzeReport(result.analyzeReport);
      setImageSourceMode("processed");
      setCharacterImageStatus("后处理预览已更新，可在画布切换「原图 / 处理后」查看。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCreationError(message);
      clearPostProcessPreview();
      await appLogger.error("后处理预览失败", {
        errorMessage: message,
        scope: "character.create.postProcess",
      });
    } finally {
      setIsPreviewingPostProcess(false);
    }
  }

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen<CharacterGenerationProgressEvent>("character-generation-progress", (event) => {
      const activeTaskId = useCharacterWorkshopStore.getState().createActiveTaskId;
      if (!activeTaskId || activeTaskId !== event.payload.taskId) {
        return;
      }

      setCreateGenerationSession((current) => {
        if (current.status !== "generating" || current.taskId !== event.payload.taskId) {
          return current;
        }

        return {
          ...current,
          candidateIndex: event.payload.candidateIndex,
          candidateTotal: event.payload.candidateTotal,
          message: event.payload.message,
          phase: event.payload.phase,
        };
      });
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [setCreateGenerationSession]);

  useEffect(() => {
    if (generationState.status !== "success" || createSelectedPlanId) {
      return;
    }

    const defaultPlan =
      generationState.result.plan.candidatePlans.find((plan) => plan.selected) ??
      generationState.result.plan.candidatePlans[0];

    if (defaultPlan) {
      setCreateSelectedPlanId(defaultPlan.id);
    }
  }, [createSelectedPlanId, generationState, setCreateSelectedPlanId]);

  async function handleGeneratePlan() {
    if (isGenerating) {
      return;
    }

    if (!draftValidation.isValid) {
      setValidationMessage(draftValidation.blockingIssues[0]?.message ?? "请先完成必填设定。");
      const firstIssueSection = draftValidation.blockingIssues[0]?.section;
      if (firstIssueSection) {
        setCreateSetupFocusSection(firstIssueSection);
      }
      return;
    }

    setValidationMessage(undefined);
    setCreationError(undefined);
    setCreatePhase("generating");
    setCreateSelectedPlanId(undefined);

    const taskId = createCharacterPlanTaskId();
    const compiledPrompt = compileDraftPromptText(createDraft);

    setCreateActiveTaskId(taskId);
    setCreateGenerationSession({
      candidateIndex: 0,
      message: "正在编译母版方案...",
      phase: "plan",
      startedAt: Date.now(),
      status: "generating",
      taskId,
    });

    try {
      const settings = await getAppSettings();
      const textProviderId = settings.aiTextProviderId.trim();
      const textModel = settings.aiTextModel.trim();
      if (!textProviderId || !textModel) {
        throw new Error("请先在设置中为「文本生成」绑定服务商和模型。");
      }

      const result = await generateMasterPlan({
        compiledPrompt,
        draft: createDraft,
        model: textModel,
        projectRoot: project.rootPath,
        providerId: textProviderId,
        taskId,
      });

      const candidateTotal = result.plan.candidatePlans.length;
      setCreateGenerationSession({
        candidateIndex: 0,
        candidateTotal,
        message: `母版方案已生成，正在生成候选图 0/${candidateTotal}...`,
        pendingPlan: result.plan,
        phase: "candidates",
        startedAt: Date.now(),
        status: "generating",
        taskId,
      });

      const candidateImages = await generateCharacterMasterCandidates({
        compiledPrompt,
        draft: createDraft,
        masterPlan: result.plan,
        projectRoot: project.rootPath,
        taskId,
      });
      const planWithImages = attachCandidateImages(result, candidateImages);
      const firstPlan = planWithImages.plan.candidatePlans[0];

      setCreateGenerationSession({
        result: planWithImages,
        status: "success",
      });
      setCreateSelectedPlanId(firstPlan?.id);
      setCreatePhase("review");
      setCreateActiveTaskId(undefined);
      await appLogger.info(`角色母版方案生成完成：task=${taskId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCreateGenerationSession({ message, status: "error", taskId });
      setCreatePhase("setup");
      setCreateActiveTaskId(undefined);
      await appLogger.error("角色母版方案生成失败", {
        errorMessage: message,
        scope: "character.create.masterPlan",
        taskId,
      });
    }
  }

  function handleCandidateSelect(plan: CharacterMasterCandidatePlan) {
    const previousPlanId = createSelectedPlanId;
    setCreateSelectedPlanId(plan.id);
    setCreationError(undefined);

    if (generationState.status !== "success") {
      return;
    }

    if (createPhase === "finalize") {
      if (previousPlanId && previousPlanId !== plan.id) {
        clearPostProcessPreview();
        setCharacterImageStatus("已切换方案，请重新预览后处理。");
      }
      return;
    }

    setCreatePhase("review");
  }

  function handleOpenFinalize() {
    if (!canSave || !selectedPlan) {
      setCreationError("请先选择一个已生成图像的候选方案。");
      return;
    }

    setCreationError(undefined);
    setCreatePhase("finalize");
  }

  function handleConfirmCreate(record: CharacterAssetRecord) {
    onCharacterCreated(record);
    onExit();
  }

  return (
    <div className="character-create-workspace">
      <div className="character-create-workspace-chrome">
        <CreateStudioToolbar
          canGenerate={draftValidation.isValid}
          canSave={canSave}
          displayName={displayName}
          entityLabel={entityTypeLabels[createDraft.identity.entityType]}
          isCreatingCharacter={isCreatingCharacter}
          isGenerating={isGenerating}
          onExit={onExit}
          onFinalize={handleOpenFinalize}
          onGenerate={() => void handleGeneratePlan()}
          roleLabel={roleLabels[createDraft.identity.role]}
          showRetry={generationState.status === "error"}
        />

        {validationMessage ? (
          <StatusBanner title={validationMessage} variant="warning" />
        ) : null}
        {creationError ? <StatusBanner title={creationError} variant="danger" /> : null}
        {characterImageStatus ? <StatusBanner title={characterImageStatus} variant="success" /> : null}
      </div>

      <div className="create-studio-phase-rail">
        <NodeProgressRail
          className="create-studio-phase-steps"
          progress={getCreatePhaseProgress(createPhase)}
          steps={getCreatePhaseSteps(createPhase, isGenerating)}
          title="创建流程"
        />
      </div>

      <WorkbenchLayout
        aside={
          <InspectorPanel className="create-studio-assist-panel" label="辅助面板" title="辅助面板">
            <div className={cn("create-studio-assist", createPhase === "finalize" && "create-studio-assist-finalize")}>
              <CreateAssistSidebar
                analyzeReport={postProcessAnalyzeReport}
                createPhase={createPhase}
                creationError={creationError}
                draft={createDraft}
                generationState={generationState}
                isCreatingCharacter={isCreatingCharacter}
                isPreviewingPostProcess={isPreviewingPostProcess}
                onCancelFinalize={() => setCreatePhase("review")}
                onCreated={handleConfirmCreate}
                onDraftChange={setCreateDraft}
                onError={setCreationError}
                onFocusSection={setCreateSetupFocusSection}
                onPreviewPostProcess={() => void handlePreviewPostProcess()}
                onSubmitting={setIsCreatingCharacter}
                postProcessPreviewReady={postProcessPreviewReady}
                postProcessState={postProcessState}
                projectRoot={project.rootPath}
                selectedPlan={selectedPlan}
                setCharacterImageStatus={setCharacterImageStatus}
                setPostProcessState={setPostProcessState}
              />
            </div>
          </InspectorPanel>
        }
        className="create-studio-workbench"
        inspector={
          <div className={cn("create-studio-inspector-shell", isInspectorLocked && "is-locked")}>
            {isInspectorLocked ? (
              <div aria-live="polite" className="create-studio-inspector-lock-banner">
                入库确认中，设定已锁定
              </div>
            ) : null}
            <ConceptSetupStep
              draft={createDraft}
              focusSection={createSetupFocusSection}
              layout="studio"
              onClearFocusSection={() => setCreateSetupFocusSection(null)}
              onDraftChange={setCreateDraft}
              projectRoot={project.rootPath}
            />
          </div>
        }
        main={
          <CreateCenterPanel
            candidatePlans={candidatePlans}
            createPhase={createPhase}
            draft={createDraft}
            generationState={generationState}
            idleMessage={idlePreviewMessage}
            imageSourceMode={imageSourceMode}
            isPlanSelectionLocked={isCreatingCharacter || isPreviewingPostProcess}
            onImageSourceModeChange={setImageSourceMode}
            onSelectPlan={handleCandidateSelect}
            planSummary={planSummary}
            previewImages={postProcessPreview}
            selectedPlan={selectedPlan}
          />
        }
      />
    </div>
  );
}

function getCreatePhaseSteps(createPhase: CreatePhase, isGenerating: boolean): ProgressStepItem[] {
  const activePhase =
    createPhase === "generating" || isGenerating ? "setup" : createPhase === "finalize" ? "finalize" : createPhase;

  return [
    {
      description: "填写模板、风格与生成参考",
      label: "概念设定",
      status: activePhase === "setup" ? "active" : activePhase === "review" || activePhase === "finalize" ? "done" : "pending",
    },
    {
      description: "对比候选母版方案",
      label: "方案审阅",
      status:
        activePhase === "review"
          ? "active"
          : activePhase === "finalize"
            ? "done"
            : activePhase === "setup"
              ? "pending"
              : "pending",
    },
    {
      description: "确认入库并命名资产",
      label: "入库确认",
      status: activePhase === "finalize" ? "active" : "pending",
    },
  ];
}

function getCreatePhaseProgress(createPhase: CreatePhase): number {
  if (createPhase === "setup" || createPhase === "generating") {
    return 20;
  }
  if (createPhase === "review") {
    return 55;
  }
  if (createPhase === "finalize") {
    return 85;
  }
  return 100;
}

function attachCandidateImages(
  result: CharacterMasterPlanGenerationResult,
  candidateImages: Array<{
    directionPreviews?: CharacterMasterCandidatePlan["directionPreviews"];
    generationWarnings?: CharacterMasterCandidatePlan["generationWarnings"];
    image: CharacterMasterCandidatePlan["masterImage"];
    planId: string;
  }>,
) {
  return {
    ...result,
    plan: {
      ...result.plan,
      candidatePlans: result.plan.candidatePlans.map((candidatePlan) => {
        const candidateImage = candidateImages.find((item) => item.planId === candidatePlan.id);

        return {
          ...candidatePlan,
          directionPreviews: candidateImage?.directionPreviews,
          generationWarnings: candidateImage?.generationWarnings,
          masterImage: candidateImage?.image,
        };
      }),
    },
  };
}
