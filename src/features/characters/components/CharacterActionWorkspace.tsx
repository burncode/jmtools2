import { listen } from "@tauri-apps/api/event";
import { Film, Layers3, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InspectorPanel, WorkbenchLayout } from "@/components/shared";
import { appLogger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { addCharacterActionTrack, removeCharacterActionTrack } from "@/lib/tauri/characterPipeline";
import { hydrateCharacterActionPreviews } from "@/lib/tauri/commands";

import { confirmCharacterAction } from "../confirmCharacterAction";
import { hasCharacterImageSource, resolveCharacterImageSrc } from "../characterImageSrc";
import {
  openCharacterMotionPresetLibrary,
  type CharacterMotionPresetSelectedPayload,
} from "../motion/characterMotionPresetLibraryWindow";
import { generateActionWithFullPrep } from "../pipeline/useAutoAssetPrep";
import type {
  CharacterActionFrame,
  CharacterActionId,
  CharacterActionTrack,
  CharacterActionTrackId,
  CharacterAssetRecord,
} from "../types";
import {
  CharacterActionCard,
  type ActionCardDraft,
  type CharacterActionCardItem,
} from "./CharacterActionCard";
import {
  getDefaultFacingDirections,
  type DirectionViewKind,
  viewKindToDirectionLabel,
} from "./CharacterDirectionGrid";
import { FilmstripCutEditor } from "./FilmstripCutEditor";
import {
  CharacterActionPreviewPanel,
  type PreviewSurfaceMode,
} from "./preview/CharacterActionPreviewPanel";

interface CharacterActionWorkspaceProps {
  onRecordChange?: (record: CharacterAssetRecord) => void;
  projectRoot: string;
  record: CharacterAssetRecord;
}

const directionLabels = {
  eight: "八方向",
  four: "四方向",
  single: "单方向",
} as const satisfies Record<CharacterAssetRecord["direction"], string>;

type AssetPreviewMode = "auto" | "original" | "transparent";

function createDefaultDraft(direction: CharacterAssetRecord["direction"]): ActionCardDraft {
  const facingDirections = getDefaultFacingDirections(direction);
  return {
    facingDirections,
    generationMode: "filmstrip",
    loopMode: "loop",
    motionPrompt: "",
    previewFps: 12,
    previewViewKind: facingDirections[0],
    targetFrameCount: 6,
    userFeedback: "",
  };
}

export function CharacterActionWorkspace({ onRecordChange, projectRoot, record }: CharacterActionWorkspaceProps) {
  const actions = useMemo(() => getActionItems(record), [record]);
  const [activeActionId, setActiveActionId] = useState<CharacterActionTrackId>(actions[0]?.id ?? "idle");
  const [expandedActionId, setExpandedActionId] = useState<CharacterActionTrackId | null>(actions[0]?.id ?? "idle");
  const [draft, setDraft] = useState<ActionCardDraft>(() => createDefaultDraft(record.direction));
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [assetPreviewMode, setAssetPreviewMode] = useState<AssetPreviewMode>("auto");
  const [previewSurfaceMode, setPreviewSurfaceMode] = useState<PreviewSurfaceMode>("animation");
  const [isGeneratingActions, setIsGeneratingActions] = useState(false);
  const activeAction = actions.find((item) => item.id === activeActionId) ?? actions[0];
  const previewFrames = getPreviewFrames(activeAction, draft.previewFps);
  const activeViewKind = draft.previewViewKind;
  const activeDirection = viewKindToDirectionLabel(activeViewKind);
  const displayImage = getCharacterDisplayImage(record, assetPreviewMode, activeViewKind, projectRoot);
  const displayImageSrc = resolveCharacterImageSrc(projectRoot, displayImage);
  const pendingCount = actions.filter((action) => action.status === "empty" || action.status === "draft").length;
  const hydratedActionsRef = useRef<Set<string>>(new Set());
  const showAllDirections = record.direction === "eight" || record.direction === "four";
  const allDirectionsLabel = record.direction === "eight" ? "八方向" : "全方向";

  useEffect(() => {
    hydratedActionsRef.current = new Set();
  }, [record.id]);

  useEffect(() => {
    const actionId = expandedActionId ?? activeActionId;
    if (!actionId || !onRecordChange) {
      return;
    }

    if (hydratedActionsRef.current.has(actionId)) {
      return;
    }

    const track = record.actions.find((action) => action.id === actionId);
    if (!track || track.frames.length === 0) {
      return;
    }

    const allFramesResolvable = track.frames.every(
      (frame) => !frame.image || hasCharacterImageSource(projectRoot, frame.image),
    );
    if (allFramesResolvable) {
      hydratedActionsRef.current.add(actionId);
      return;
    }

    void hydrateCharacterActionPreviews({
      actionId,
      characterId: record.id,
      projectRoot,
    })
      .then((nextTrack) => {
        hydratedActionsRef.current.add(actionId);
        onRecordChange({
          ...record,
          actions: record.actions.map((action) => (action.id === nextTrack.id ? nextTrack : action)),
        });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        void appLogger.error(`加载动作帧预览失败：${message}`);
      });
  }, [activeActionId, expandedActionId, onRecordChange, projectRoot, record]);

  useEffect(() => {
    if (!actions.some((action) => action.id === activeActionId)) {
      setActiveActionId(actions[0]?.id ?? "idle");
    }
  }, [actions, activeActionId]);

  useEffect(() => {
    if (previewSurfaceMode !== "animation") {
      setIsPlaying(false);
      return;
    }
    setActiveFrameIndex(0);
    setIsPlaying(true);
  }, [activeActionId, previewSurfaceMode]);

  useEffect(() => {
    return void listen<CharacterMotionPresetSelectedPayload>("character-motion-preset-selected", async (event) => {
      if (event.payload.characterId !== record.id || event.payload.projectRoot !== projectRoot) {
        return;
      }

      try {
        const nextRecord = await addCharacterActionTrack({
          actionId: event.payload.actionId,
          characterId: record.id,
          label: event.payload.label,
          projectRoot,
        });
        onRecordChange?.(nextRecord);
        setDraft((current) => ({
          ...current,
          motionPrompt: event.payload.motionPrompt,
          targetFrameCount: event.payload.defaultFrames,
        }));
        setActiveActionId(event.payload.actionId as CharacterActionTrackId);
        setExpandedActionId(event.payload.actionId as CharacterActionTrackId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await appLogger.error(`添加动作失败：${message}`);
      }
    });
  }, [onRecordChange, projectRoot, record.id]);

  function patchDraft(patch: Partial<ActionCardDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function runGenerate(actionId: CharacterActionTrackId, allViews: boolean, feedback?: string) {
    setIsGeneratingActions(true);
    try {
      const nextRecord = await generateActionWithFullPrep(
        record,
        projectRoot,
        {
          actionIds: [actionId],
          allViews,
          characterId: record.id,
          frameCount: draft.targetFrameCount,
          generationMode: draft.generationMode,
          loopMode: draft.loopMode,
          maxRetries: 3,
          motionPrompt: draft.motionPrompt.trim() || undefined,
          previewFps: draft.previewFps,
          projectRoot,
          userFeedback: feedback?.trim() || draft.userFeedback.trim() || undefined,
          viewKinds: allViews ? undefined : draft.facingDirections,
        },
        { mattingColorSpace: "rgb" },
      );
      onRecordChange?.(nextRecord);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await appLogger.error(`角色动作帧生成失败：id=${record.id} action=${actionId} message=${message}`);
    } finally {
      setIsGeneratingActions(false);
    }
  }

  async function handleGenerateAllPending() {
    const pending = actions.filter((action) => action.status === "empty" || action.status === "draft");
    for (const action of pending) {
      setActiveActionId(action.id);
      setExpandedActionId(action.id);
      await runGenerate(action.id, false);
    }
  }

  function handleAddAction() {
    void openCharacterMotionPresetLibrary({
      characterId: record.id,
      existingActionIds: actions.map((action) => action.id),
      projectRoot,
    });
  }

  async function handleDeleteAction(actionId: CharacterActionTrackId) {
    const action = actions.find((item) => item.id === actionId);
    if (!action) {
      return;
    }
    const confirmed = await confirmCharacterAction(`确定删除动作「${action.label}」？`, "删除动作");
    if (!confirmed) {
      return;
    }
    try {
      const nextRecord = await removeCharacterActionTrack({
        actionId,
        characterId: record.id,
        projectRoot,
      });
      onRecordChange?.(nextRecord);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await appLogger.error(`删除动作失败：${message}`);
    }
  }

  function handleDirectionsChange(viewKinds: DirectionViewKind[], previewViewKind: DirectionViewKind) {
    patchDraft({ facingDirections: viewKinds, previewViewKind });
  }

  return (
    <div className="character-action-workspace-canvas">
      <section className="character-action-workspace character-action-workspace--pp" aria-label={`${record.displayName} 动作生产工作区`}>
        <WorkbenchLayout
          className="character-action-layout character-action-layout--pp"
          inspector={
            <InspectorPanel className="character-action-left-panel" label="角色摘要">
              <section className="character-profile-block">
                <div className="character-profile-preview" aria-hidden="true">
                  {displayImageSrc ? (
                    <img alt="" className="character-profile-master-image" src={displayImageSrc} />
                  ) : (
                    <span className="character-action-sprite">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                </div>
                <div>
                  <strong>{record.displayName || record.selectedPlanName}</strong>
                  <p>{record.description || record.selectedPlanFocus}</p>
                </div>
              </section>
              <section className="character-spec-grid" aria-label="角色规格">
                <div>
                  <span>画布</span>
                  <strong>{record.size}</strong>
                </div>
                <div>
                  <span>方向</span>
                  <strong>{directionLabels[record.direction]}</strong>
                </div>
                <div>
                  <span>风格</span>
                  <strong>{record.style}</strong>
                </div>
                <div>
                  <span>状态</span>
                  <strong>{record.processing?.normalized ? "已规范化" : record.processing?.backgroundRemoved ? "已抠图" : "待准备"}</strong>
                </div>
              </section>
              <section className="character-keyword-block" aria-label="视觉关键词">
                <header>
                  <Layers3 aria-hidden="true" size={16} />
                  <strong>视觉关键词</strong>
                </header>
                <div>
                  {record.visualKeywords.map((keyword) => (
                    <Badge key={keyword} variant="outline">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </section>
            </InspectorPanel>
          }
          main={
            <InspectorPanel
              actions={
                <Button onClick={handleAddAction} size="sm" type="button" variant="outline">
                  <Plus aria-hidden="true" />
                  添加动作
                </Button>
              }
              className={cn(
                "character-action-cards-panel",
                actions.length >= 4 && "character-action-cards-panel--compact",
              )}
              description={`${actions.length} 个动作`}
              footer={
                <Button
                  className="character-action-batch-generate"
                  disabled={isGeneratingActions || pendingCount === 0}
                  onClick={() => void handleGenerateAllPending()}
                  type="button"
                >
                  生成全部 {pendingCount} 个待处理
                </Button>
              }
              icon={Film}
              label="动作列表"
              title="动作"
            >
              <div className="character-action-card-list">
                {actions.map((action) => (
                  <CharacterActionCard
                    allDirectionsLabel={allDirectionsLabel}
                    draft={draft}
                    expanded={expandedActionId === action.id}
                    isBusy={isGeneratingActions && activeActionId === action.id}
                    item={action}
                    key={action.id}
                    onAllDirections={() => void runGenerate(action.id, true)}
                    onDelete={() => void handleDeleteAction(action.id)}
                    onDirectionsChange={handleDirectionsChange}
                    onDraftChange={patchDraft}
                    onRegenerate={() => {
                      setActiveActionId(action.id);
                      void runGenerate(action.id, false);
                    }}
                    onSelect={() => {
                      setActiveActionId(action.id);
                      setActiveFrameIndex(0);
                    }}
                    onToggleExpand={() => setExpandedActionId((current) => (current === action.id ? null : action.id))}
                    projectRoot={projectRoot}
                    record={record}
                    selected={activeActionId === action.id}
                    showAllDirections={showAllDirections}
                  />
                ))}
              </div>
            </InspectorPanel>
          }
          aside={
            <>
              <CharacterActionPreviewPanel
                actionId={toBaseActionId(activeActionId)}
                activeAction={activeAction}
                activeDirection={activeDirection}
                activeFrameIndex={activeFrameIndex}
                activeViewKind={activeViewKind}
                assetPreviewMode={assetPreviewMode}
                draft={draft}
                isPlaying={isPlaying}
                onAssetPreviewModeChange={setAssetPreviewMode}
                onFrameChange={(index) => {
                  setActiveFrameIndex(index);
                  setIsPlaying(false);
                }}
                onPlaybackComplete={() => setIsPlaying(false)}
                onPlayToggle={() => setIsPlaying((current) => !current)}
                previewFrames={previewFrames}
                previewSurfaceMode={previewSurfaceMode}
                projectRoot={projectRoot}
                record={record}
                setPreviewSurfaceMode={setPreviewSurfaceMode}
                viewKindLabel={getViewKindLabel(activeViewKind)}
              />
              {activeAction.track ? (
                <FilmstripCutEditor
                  actionTrack={activeAction.track}
                  onRecordChange={onRecordChange}
                  projectRoot={projectRoot}
                  record={record}
                />
              ) : null}
            </>
          }
        />
      </section>
    </div>
  );
}

function getActionItems(record: CharacterAssetRecord): CharacterActionCardItem[] {
  const actionTracks = record.actions.length > 0 ? record.actions : createFallbackActionTracks(record);

  return actionTracks.map((track) => ({
    frameCount: track.frames.length > 0 ? track.frames.length : 6,
    id: track.id,
    label: track.label,
    note: track.note,
    status: track.status as CharacterActionCardItem["status"],
    track,
  }));
}

function getViewKindLabel(kind: string) {
  const labels: Record<string, string> = {
    back: "后",
    backLeft: "左后",
    backRight: "右后",
    front: "前",
    frontLeft: "左前",
    frontRight: "右前",
    left: "左",
    right: "右",
    single: "正面",
  };

  return labels[kind] ?? kind;
}

function getCharacterDisplayImage(
  record: CharacterAssetRecord,
  mode: AssetPreviewMode,
  viewKind: string,
  projectRoot: string,
) {
  const view = findCharacterView(record, viewKind, projectRoot);

  if (mode === "transparent") {
    return view?.transparentImage ?? view?.rawImage ?? record.masterImage;
  }

  if (mode === "original") {
    return view?.rawImage ?? record.masterImage;
  }

  return view?.transparentImage ?? view?.normalizedImage ?? view?.rawImage ?? record.masterImage;
}

function findCharacterView(record: CharacterAssetRecord, viewKind: string, projectRoot: string) {
  const views = record.views ?? [];
  const hasImage = (view: (typeof views)[number]) =>
    hasCharacterImageSource(projectRoot, view.transparentImage) ||
    hasCharacterImageSource(projectRoot, view.rawImage);

  return (
    views.find((view) => view.kind === viewKind && hasImage(view)) ??
    views.find((view) => view.kind === viewKind) ??
    views.find((view) => view.kind === "front" || view.kind === "single") ??
    views.find((view) => hasImage(view))
  );
}

function getPreviewFrames(action: CharacterActionCardItem, fps: number): CharacterActionFrame[] {
  if (action.track && action.track.frames.length > 0) {
    return action.track.frames;
  }

  return createPlaceholderFrames(toBaseActionId(action.id), fps);
}

function toBaseActionId(trackId: string): CharacterActionId {
  const base = trackId.split("-")[0];
  if (base === "walk" || base === "attack") {
    return base;
  }
  return "idle";
}

function createFallbackActionTracks(record: CharacterAssetRecord): CharacterActionTrack[] {
  return [
    {
      direction: record.direction,
      exportReady: false,
      frames: createPlaceholderFrames("idle", 12),
      id: "idle",
      label: "Idle 待机",
      loopMode: "loop",
      note: record.actionSuggestions.idle,
      previewFps: 12,
      status: "draft",
    },
    {
      direction: record.direction,
      exportReady: false,
      frames: createPlaceholderFrames("walk", 12),
      id: "walk",
      label: "Walk 行走",
      loopMode: "loop",
      note: record.actionSuggestions.walk,
      previewFps: 12,
      status: "empty",
    },
    {
      direction: record.direction,
      exportReady: false,
      frames: createPlaceholderFrames("attack", 12),
      id: "attack",
      label: "Attack 攻击",
      loopMode: "once",
      note: record.actionSuggestions.attack,
      previewFps: 12,
      status: "empty",
    },
  ];
}

function createPlaceholderFrames(actionId: CharacterActionId, fps: number): CharacterActionFrame[] {
  const frameCount = actionId === "attack" ? 6 : 8;
  const durationMs = Math.round(1000 / Math.max(1, fps));

  return Array.from({ length: frameCount }).map((_, index) => ({
    durationMs,
    id: `${actionId}-placeholder-frame-${index + 1}`,
    index,
    label: `${actionId} ${String(index + 1).padStart(2, "0")}`,
    source: "placeholder",
    status: index === 0 || index === frameCount - 1 ? "key" : "inbetween",
  }));
}
