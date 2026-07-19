import { Copy, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { InspectorPanel } from "@/components/shared/InspectorPanel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  emptyProjectCharacterGenerationSettings,
  type ProjectCharacterGenerationSettings,
} from "@/features/projects/characterGenerationTypes";
import { appLogger } from "@/lib/logger";
import { previewCharacterGenerationPrompts } from "@/lib/tauri/characterPipeline";
import { getProjectCharacterGeneration } from "@/lib/tauri/projectCharacterGeneration";

import { compileDraftPromptSections, compileDraftPromptText } from "../compile/draftToPromptInputs";
import { compileProjectAnchorPromptSections } from "../compile/projectAnchorPromptSections";
import { resolvePromptSectionFocus } from "../setup/promptSectionFocusMap";
import { PromptSectionCard } from "./studio/PromptSectionCard";
import type {
  CharacterMasterPlan,
  CharacterPlanGenerationState,
  CharacterWorkshopDraft,
  CreateSetupSection,
} from "../../types";

interface PromptPreviewPanelProps {
  draft: CharacterWorkshopDraft;
  generationState: CharacterPlanGenerationState;
  onFocusSection?: (section: CreateSetupSection) => void;
  projectRoot: string;
}

type PromptPreviewTab = "draft" | "image" | "master";

export function PromptPreviewPanel({
  draft,
  generationState,
  onFocusSection,
  projectRoot,
}: PromptPreviewPanelProps) {
  const [projectSettings, setProjectSettings] = useState<ProjectCharacterGenerationSettings>(
    emptyProjectCharacterGenerationSettings(),
  );
  const [activeTab, setActiveTab] = useState<PromptPreviewTab>("draft");
  const [imagePrompts, setImagePrompts] = useState<Array<{ planId: string; planName: string; prompt: string }>>(
    [],
  );
  const [imagePromptsLoading, setImagePromptsLoading] = useState(false);
  const [imagePromptsError, setImagePromptsError] = useState<string>();
  const [selectedImagePlanId, setSelectedImagePlanId] = useState<string>();

  const masterPlan = useMemo(() => resolveMasterPlan(generationState), [generationState]);
  const hasMasterPlan = Boolean(masterPlan);

  useEffect(() => {
    void getProjectCharacterGeneration(projectRoot)
      .then((settings) => setProjectSettings({ ...emptyProjectCharacterGenerationSettings(), ...settings }))
      .catch(() => setProjectSettings(emptyProjectCharacterGenerationSettings()));
  }, [projectRoot]);

  const draftSections = useMemo(() => {
    const anchorSections = compileProjectAnchorPromptSections(projectSettings, draft.styleAnchorVariantKey);
    const compiledSections = compileDraftPromptSections(draft);
    return [...anchorSections, ...compiledSections];
  }, [draft, projectSettings]);

  const masterPlanSections = useMemo(() => {
    if (!masterPlan) {
      return [];
    }

    return buildMasterPlanSections(masterPlan);
  }, [masterPlan]);

  useEffect(() => {
    if (activeTab !== "image" || !masterPlan) {
      return;
    }

    let cancelled = false;
    setImagePromptsLoading(true);
    setImagePromptsError(undefined);

    void previewCharacterGenerationPrompts({
      compiledPrompt: compileDraftPromptText(draft),
      draft,
      masterPlan,
      projectRoot,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        setImagePrompts(result.prompts);
        setSelectedImagePlanId(result.prompts[0]?.planId);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        setImagePromptsError(message);
        setImagePrompts([]);
      })
      .finally(() => {
        if (!cancelled) {
          setImagePromptsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, draft, masterPlan, projectRoot]);

  async function handleCopyActiveTab() {
    let promptText = "";

    if (activeTab === "draft") {
      promptText = draftSections.map((section) => `${section.title}: ${section.value}`).join("\n\n");
    } else if (activeTab === "master" && masterPlan) {
      promptText = masterPlanSections.map((section) => `${section.title}: ${section.value}`).join("\n\n");
    } else if (activeTab === "image") {
      promptText = imagePrompts
        .map((item) => `【${item.planName}】\n${item.prompt}`)
        .join("\n\n---\n\n");
    }

    if (!promptText.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(promptText);
      await appLogger.info("当前 Tab Prompt 已复制到剪贴板。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await appLogger.error(`复制 Prompt 失败：message=${message}`);
    }
  }

  const selectedImagePrompt = imagePrompts.find((item) => item.planId === selectedImagePlanId) ?? imagePrompts[0];

  return (
    <InspectorPanel
      actions={
        <Button onClick={() => void handleCopyActiveTab()} size="sm" type="button" variant="outline">
          <Copy aria-hidden="true" size={14} />
          复制当前 Tab
        </Button>
      }
      className="character-prompt-preview-inspector"
      description="分阶段查看设定编译、母版方案与图像 Prompt"
      label="Prompt 预览"
      title="Prompt 预览"
    >
      <Tabs
        className="character-prompt-preview-tabs"
        onValueChange={(value) => setActiveTab(value as PromptPreviewTab)}
        value={activeTab}
      >
        <TabsList className="character-prompt-preview-tab-list" variant="line">
          <TabsTrigger value="draft">设定编译</TabsTrigger>
          <TabsTrigger disabled={!hasMasterPlan} value="master">
            母版方案
          </TabsTrigger>
          <TabsTrigger disabled={!hasMasterPlan} value="image">
            图像 Prompt
          </TabsTrigger>
        </TabsList>

        <TabsContent className="character-prompt-preview-tab-content" value="draft">
          <ScrollArea className="character-prompt-preview-scroll app-scroll-ghost">
            <div className="character-prompt-preview-sections">
              {draftSections.map((section, index) => {
                const focusSection = resolvePromptSectionFocus(section.title);

                return (
                  <PromptSectionCard
                    key={`${section.title}-${index}`}
                    locked={section.locked}
                    onFocus={focusSection && onFocusSection ? () => onFocusSection(focusSection) : undefined}
                    title={section.title}
                    value={section.value}
                    variant="compact"
                  />
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent className="character-prompt-preview-tab-content" value="master">
          {hasMasterPlan ? (
            <ScrollArea className="character-prompt-preview-scroll app-scroll-ghost">
              <div className="character-prompt-preview-sections">
                {masterPlanSections.map((section) => (
                  <PromptSectionCard
                    key={section.title}
                    locked
                    title={section.title}
                    value={section.value}
                    variant="compact"
                  />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="character-prompt-preview-empty">生成母版后可查看文本 AI 产出的方案结构。</p>
          )}
        </TabsContent>

        <TabsContent className="character-prompt-preview-tab-content" value="image">
          {!hasMasterPlan ? (
            <p className="character-prompt-preview-empty">生成母版后可预览各候选方案的图像 Prompt。</p>
          ) : imagePromptsLoading ? (
            <div className="character-prompt-preview-loading">
              <LoaderCircle aria-hidden="true" className="character-candidate-thumbnail-spinner" />
              <span>正在编译图像 Prompt…</span>
            </div>
          ) : imagePromptsError ? (
            <p className="character-prompt-preview-error">{imagePromptsError}</p>
          ) : imagePrompts.length === 0 ? (
            <p className="character-prompt-preview-empty">暂无候选方案图像 Prompt。</p>
          ) : (
            <div className="character-prompt-preview-image-tab">
              {imagePrompts.length > 1 ? (
                <Tabs
                  onValueChange={setSelectedImagePlanId}
                  value={selectedImagePlanId ?? imagePrompts[0]?.planId}
                >
                  <TabsList className="character-prompt-preview-plan-tabs" variant="line">
                    {imagePrompts.map((item) => (
                      <TabsTrigger key={item.planId} value={item.planId}>
                        {item.planName}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              ) : null}
              <ScrollArea className="character-prompt-preview-scroll app-scroll-ghost">
                <pre className="character-prompt-preview-pre">{selectedImagePrompt?.prompt}</pre>
              </ScrollArea>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </InspectorPanel>
  );
}

function resolveMasterPlan(generationState: CharacterPlanGenerationState): CharacterMasterPlan | undefined {
  if (generationState.status === "success") {
    return generationState.result.plan;
  }

  if (generationState.status === "generating" && generationState.pendingPlan) {
    return generationState.pendingPlan;
  }

  return undefined;
}

function buildMasterPlanSections(masterPlan: CharacterMasterPlan) {
  return [
    { title: "方案摘要", value: masterPlan.summary || "—" },
    { title: "角色定位", value: masterPlan.rolePositioning || "—" },
    {
      title: "像素提示词",
      value: masterPlan.pixelPrompt || "—",
    },
    {
      title: "视觉关键词",
      value: masterPlan.visualKeywords.length > 0 ? masterPlan.visualKeywords.join("、") : "—",
    },
    {
      title: "方向一致性",
      value:
        masterPlan.directionConsistency.length > 0 ? masterPlan.directionConsistency.join("；") : "—",
    },
    {
      title: "候选方案",
      value: masterPlan.candidatePlans
        .map(
          (plan) =>
            `${plan.name}（${plan.focus || "无重点"}，推荐 ${plan.recommendationScore}%）`,
        )
        .join("\n"),
    },
    {
      title: "动作建议",
      value: `待机：${masterPlan.actionSuggestions.idle}\n行走：${masterPlan.actionSuggestions.walk}\n攻击：${masterPlan.actionSuggestions.attack}`,
    },
    {
      title: "导出说明",
      value: masterPlan.exportNotes.length > 0 ? masterPlan.exportNotes.join("；") : "—",
    },
  ];
}
