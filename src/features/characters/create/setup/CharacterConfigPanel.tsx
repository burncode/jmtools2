import { open } from "@tauri-apps/plugin-dialog";
import { Crown, Droplets, Sparkles, Upload, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AppSelect,
  AppSlider,
  InspectorField,
  PanelSection,
  SegmentedControl,
} from "@/components/shared";
import { appLogger } from "@/lib/logger";
import { getAppSettings, importCharacterReferenceImages, listAiModelProviders, optimizeCharacterDescription } from "@/lib/tauri/commands";
import { getLocalGenerationLimits } from "@/lib/tauri/localModels";
import { cn } from "@/lib/utils";

import { getArchetypeTemplate } from "../../archetypes/templates";
import {
  backgroundModeOptions,
  canvasSizeOptions,
  classOccupationSuggestions,
  directionOptions,
  generationCountOptions,
  generationOptions,
  generationQualityOptions,
  raceSpeciesSuggestions,
} from "../../characterFixtures";
import type { CharacterWorkshopDraft, CreateSetupSection } from "../../types";
import type { CreateDraftValidationResult } from "../validation/validateCreateDraft";
import { TraitSmartTagField } from "./components/TraitSmartTagField";
import { useCharacterPresetLoader } from "./hooks/useCharacterPresetLoader";
import { getIssuesForField, getSectionStatus } from "../validation/validateCreateDraft";

interface CharacterConfigPanelProps {
  draft: CharacterWorkshopDraft;
  focusSection?: CreateSetupSection | null;
  onClearFocusSection?: () => void;
  onDraftChange: (patch: Partial<CharacterWorkshopDraft>) => void;
  projectRoot: string;
  validation: CreateDraftValidationResult;
}

const presetIcons = {
  blank: UserRound,
  daoist_cultivator: Sparkles,
  demon_boss: Crown,
  slime_enemy: Droplets,
} as const;

const innerSectionClass = "character-config-inner-section";

export function CharacterConfigPanel({
  draft,
  focusSection,
  onClearFocusSection,
  onDraftChange,
  projectRoot,
  validation,
}: CharacterConfigPanelProps) {
  const presetSectionRef = useRef<HTMLDivElement>(null);
  const [openSection, setOpenSection] = useState<string | undefined>("concept");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string>();
  const [referenceError, setReferenceError] = useState<string>();
  const [isImportingReferences, setIsImportingReferences] = useState(false);
  const [characterProviderPreset, setCharacterProviderPreset] = useState<string | null>(null);
  const [localMaxSide, setLocalMaxSide] = useState<number | null>(null);
  const [localImg2imgSupported, setLocalImg2imgSupported] = useState(false);

  const showLocalTurnaroundVramWarning =
    characterProviderPreset === "local-diffusion" &&
    (draft.direction === "four" || draft.direction === "eight");

  const showLocalReferenceImg2imgWarning =
    characterProviderPreset === "local-diffusion" &&
    draft.referenceImages.length > 0 &&
    !localImg2imgSupported;

  const {
    handleBuiltinTemplateSelect,
    handleDeleteProjectTemplate,
    handleProjectTemplateSelect,
    handleSaveProjectTemplate,
    isSavingTemplate,
    primaryPresets,
    projectTemplates,
    projectTemplatesError,
    secondaryPresets,
  } = useCharacterPresetLoader(projectRoot, onDraftChange);

  const canImportMoreReferences = draft.referenceImages.length < 4;

  const activeTemplateDescription = useMemo(() => {
    if (!draft.archetypeTemplateId) {
      return undefined;
    }

    const builtinTemplate = getArchetypeTemplate(draft.archetypeTemplateId);
    if (builtinTemplate) {
      return builtinTemplate.description;
    }

    const projectTemplate = projectTemplates.find((item) => item.id === draft.archetypeTemplateId);
    return projectTemplate?.description || "项目自定义模板";
  }, [draft.archetypeTemplateId, projectTemplates]);

  const secondarySelectValue = useMemo(() => {
    if (draft.archetypeTemplateId && secondaryPresets.some((item) => item.id === draft.archetypeTemplateId)) {
      return draft.archetypeTemplateId;
    }

    if (draft.archetypeTemplateId && projectTemplates.some((item) => item.id === draft.archetypeTemplateId)) {
      return `project:${draft.archetypeTemplateId}`;
    }

    return "";
  }, [draft.archetypeTemplateId, projectTemplates, secondaryPresets]);

  useEffect(() => {
    if (!focusSection) {
      return;
    }

    if (focusSection === "preset") {
      presetSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      onClearFocusSection?.();
      return;
    }

    setOpenSection(focusSection);

    window.requestAnimationFrame(() => {
      document.querySelector(`[data-setup-section="${focusSection}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      onClearFocusSection?.();
    });
  }, [focusSection, onClearFocusSection]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [settings, providers] = await Promise.all([getAppSettings(), listAiModelProviders()]);
        if (cancelled) {
          return;
        }

        const provider = providers.find((item) => item.id === settings.aiCharacterProviderId);
        setCharacterProviderPreset(provider?.preset ?? null);
        if (provider?.preset === "local-diffusion") {
          const limits = await getLocalGenerationLimits("");
          setLocalMaxSide(limits.limits.maxSide);
          setLocalImg2imgSupported(limits.img2imgSupported);
        } else {
          setLocalMaxSide(null);
          setLocalImg2imgSupported(false);
        }
      } catch {
        if (!cancelled) {
          setCharacterProviderPreset(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function patchIdentity(field: Partial<CharacterWorkshopDraft["identity"]>) {
    onDraftChange({
      identity: {
        ...draft.identity,
        ...field,
      },
    });
  }

  async function handleOptimizeDescription() {
    if (!draft.description.trim()) {
      setOptimizeError("请先填写角色描述。");
      return;
    }

    setIsOptimizing(true);
    setOptimizeError(undefined);

    try {
      const settings = await getAppSettings();
      const providerId = settings.aiTextProviderId.trim();
      const model = settings.aiTextModel.trim();
      if (!providerId || !model) {
        throw new Error("请先在设置中为「文本生成」绑定服务商和模型。");
      }

      const optimized = await optimizeCharacterDescription({
        classOrOccupation: draft.identity.classOrOccupation,
        description: draft.description,
        entityType: draft.identity.entityType,
        model,
        providerId,
        role: draft.identity.role,
      });

      onDraftChange({ description: optimized.slice(0, 300) });
    } catch (error) {
      setOptimizeError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsOptimizing(false);
    }
  }

  async function handleImportReferenceImages() {
    if (!canImportMoreReferences || isImportingReferences) {
      return;
    }

    setReferenceError(undefined);
    setIsImportingReferences(true);

    try {
      const selectedPaths = await open({
        filters: [{ extensions: ["png", "jpg", "jpeg", "webp"], name: "参考图片" }],
        multiple: true,
        title: "选择角色参考图",
      });

      const imagePaths = normalizeSelectedPaths(selectedPaths).slice(0, 4 - draft.referenceImages.length);
      if (imagePaths.length === 0) {
        return;
      }

      const importedImages = await importCharacterReferenceImages({
        imagePaths,
        projectRoot,
      });

      onDraftChange({
        referenceImages: [...draft.referenceImages, ...importedImages].slice(0, 4),
      });
      await appLogger.info(`角色参考图导入完成：count=${importedImages.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setReferenceError(message);
      await appLogger.error(`角色参考图导入失败：message=${message}`);
    } finally {
      setIsImportingReferences(false);
    }
  }

  function handleSecondaryPresetChange(value: string) {
    if (!value) {
      return;
    }

    if (value.startsWith("project:")) {
      const templateId = value.slice("project:".length);
      const template = projectTemplates.find((item) => item.id === templateId);
      if (template) {
        handleProjectTemplateSelect(template);
      }
      return;
    }

    handleBuiltinTemplateSelect(value);
  }

  return (
    <div className="character-config-panel">
      <div className="character-config-preset-section" data-setup-section="preset" ref={presetSectionRef}>
        <div className="character-config-preset-header">
          <div>
            <p className="panel-label">起始预设</p>
            <p className="character-config-preset-hint">选择模板后，下方表单自动灌入默认设定</p>
          </div>
          <SectionStatusBadge status={getSectionStatus(validation, "preset")} />
        </div>

        <div className="character-config-preset-row">
          {primaryPresets.map((template) => {
            const Icon = presetIcons[template.id as keyof typeof presetIcons] ?? UserRound;
            const isActive = draft.archetypeTemplateId === template.id;

            return (
              <Button
                className={cn("character-config-preset-btn", isActive && "character-config-preset-btn-active")}
                data-active={isActive}
                key={template.id}
                onClick={() => handleBuiltinTemplateSelect(template.id)}
                type="button"
                variant={isActive ? "default" : "outline"}
              >
                <Icon aria-hidden="true" size={16} />
                <span>{template.label}</span>
              </Button>
            );
          })}
        </div>

        {activeTemplateDescription ? (
          <p className="character-config-active-template-desc">{activeTemplateDescription}</p>
        ) : null}

        <div className="character-config-preset-secondary">
          <AppSelect
            ariaLabel="更多模板"
            onValueChange={handleSecondaryPresetChange}
            options={[
              ...secondaryPresets.map((template) => ({
                label: template.label,
                value: template.id,
              })),
              ...projectTemplates.map((template) => ({
                label: `项目 · ${template.label}`,
                value: `project:${template.id}`,
              })),
            ]}
            placeholder="更多模板（灵宠、像素骑士、项目模板…）"
            value={secondarySelectValue}
          />
          <Button
            disabled={isSavingTemplate}
            onClick={() => void handleSaveProjectTemplate(draft)}
            size="sm"
            type="button"
            variant="outline"
          >
            {isSavingTemplate ? "保存中…" : "保存为项目模板"}
          </Button>
        </div>

        {projectTemplates.length > 0 ? (
          <div className="character-config-project-templates">
            {projectTemplates.map((template) => (
              <div className="character-config-project-template-item" key={template.id}>
                <Button
                  data-active={draft.archetypeTemplateId === template.id}
                  onClick={() => handleProjectTemplateSelect(template)}
                  size="sm"
                  type="button"
                  variant={draft.archetypeTemplateId === template.id ? "default" : "ghost"}
                >
                  {template.label}
                </Button>
                <Button
                  aria-label={`删除项目模板 ${template.label}`}
                  onClick={() => void handleDeleteProjectTemplate(template.id)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  删除
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        {projectTemplatesError ? <p className="field-error-text">{projectTemplatesError}</p> : null}
        <FieldMessages field="identity.entityType" validation={validation} />
        <FieldMessages field="identity.role" validation={validation} />
        <FieldMessages field="style" validation={validation} />
      </div>

      <Accordion
        className="character-config-accordion"
        collapsible
        onValueChange={setOpenSection}
        type="single"
        value={openSection}
      >
        <AccordionItem className="character-config-accordion-item" data-setup-section="concept" value="concept">
          <AccordionTrigger className="character-config-accordion-trigger">
            <span className="character-config-accordion-trigger-label">概念与特征</span>
            <SectionStatusBadge status={getSectionStatus(validation, "concept")} />
          </AccordionTrigger>
          <AccordionContent className="character-config-accordion-content">
            <PanelSection className={innerSectionClass} description="名称与身份是生成母版的核心输入" title="基本信息">
              <label className="field-group">
                <span>角色名称 *</span>
                <div className="field-with-count">
                  <Input maxLength={20} onChange={(event) => onDraftChange({ name: event.target.value })} value={draft.name} />
                  <small>{draft.name.length} / 20</small>
                </div>
                <FieldMessages field="name" validation={validation} />
              </label>

              <InspectorField label="种族 / 物种">
                <Input
                  list="race-species-suggestions"
                  onChange={(event) => patchIdentity({ raceOrSpecies: event.target.value })}
                  placeholder="人类、妖兽、魔龙、史莱姆…"
                  value={draft.identity.raceOrSpecies}
                />
                <datalist id="race-species-suggestions">
                  {raceSpeciesSuggestions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </InspectorField>

              <InspectorField label="职业 / 定位">
                <Input
                  list="class-occupation-suggestions"
                  onChange={(event) => patchIdentity({ classOrOccupation: event.target.value })}
                  placeholder="道士、剑修、守门 Boss、杂兵…"
                  value={draft.identity.classOrOccupation}
                />
                <datalist id="class-occupation-suggestions">
                  {classOccupationSuggestions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </InspectorField>
            </PanelSection>

            <PanelSection className={innerSectionClass} description="详细描述可显著提升生成稳定性" title="描述核心">
              <div className="field-group">
                <span className="character-config-desc-row">
                  <span>角色描述 *</span>
                  <Button
                    className="inline-ai-action"
                    disabled={isOptimizing}
                    onClick={() => void handleOptimizeDescription()}
                    type="button"
                    variant="outline"
                  >
                    <Sparkles aria-hidden="true" size={13} />
                    {isOptimizing ? "优化中…" : "AI 优化"}
                  </Button>
                </span>
                <Textarea
                  className="character-description-input"
                  maxLength={300}
                  onChange={(event) => onDraftChange({ description: event.target.value })}
                  placeholder="描述角色的外观、气质、装备与用途…"
                  value={draft.description}
                />
                <small>{draft.description.length} / 300</small>
                {optimizeError ? <p className="field-error-text">{optimizeError}</p> : null}
                <FieldMessages field="description" validation={validation} />
              </div>
            </PanelSection>

            <PanelSection className={innerSectionClass} description="Enter 添加标签，或点击快捷特征" title="特征标签">
              <TraitSmartTagField draft={draft} onDraftChange={onDraftChange} />
              <FieldMessages field="appearanceTraits" validation={validation} />
            </PanelSection>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem className="character-config-accordion-item" data-setup-section="output" value="output">
          <AccordionTrigger className="character-config-accordion-trigger">
            <span className="character-config-accordion-trigger-label">产出与控制</span>
            <SectionStatusBadge status={getSectionStatus(validation, "output")} />
          </AccordionTrigger>
          <AccordionContent className="character-config-accordion-content">
            <PanelSection className={innerSectionClass} description="画布与方向影响后续多视图与动作产线" title="画布规格">
              <InspectorField label="画布规格 *" description={formatCanvasSizeHint(draft)}>
                <SegmentedControl
                  ariaLabel="画布规格"
                  className="character-canvas-size-control"
                  onValueChange={(size) => onDraftChange({ size })}
                  options={canvasSizeOptions.map((size) => ({ label: size, value: size }))}
                  value={draft.size}
                />
                {draft.size === "自定义" ? (
                  <div className="custom-canvas-size-row">
                    <label>
                      <span>宽</span>
                      <Input
                        max={256}
                        min={16}
                        onChange={(event) =>
                          onDraftChange({ customWidth: normalizeCanvasSide(event.target.value, draft.customWidth) })
                        }
                        type="number"
                        value={draft.customWidth}
                      />
                    </label>
                    <label>
                      <span>高</span>
                      <Input
                        max={256}
                        min={16}
                        onChange={(event) =>
                          onDraftChange({ customHeight: normalizeCanvasSide(event.target.value, draft.customHeight) })
                        }
                        type="number"
                        value={draft.customHeight}
                      />
                    </label>
                  </div>
                ) : null}
                <FieldMessages field="size" validation={validation} />
              </InspectorField>

              <InspectorField label="方向规格 *">
                <SegmentedControl
                  ariaLabel="方向规格"
                  className="character-direction-control"
                  onValueChange={(direction) => onDraftChange({ direction })}
                  options={directionOptions.map((option) => ({
                    description: option.description,
                    label: option.label,
                    value: option.value,
                  }))}
                  value={draft.direction}
                />
                <FieldMessages field="direction" validation={validation} />
                {showLocalTurnaroundVramWarning ? (
                  <p className="character-setup-hint character-setup-hint--warning">
                    当前角色生成绑定本地生图：四向/八向 turnaround 会占用大量显存，低显存设备建议改用单向前向或 sdxs-512
                    档位。
                    {localImg2imgSupported
                      ? " 本地参考图 img2img 已启用，上传参考图可提升一致性。"
                      : " 当前 Runtime 暂不支持参考图 img2img，将回退纯文生图。"}
                    {localMaxSide ? ` 当前生图上限约 ${localMaxSide}px，可在「设置 → 本地生图 → 生图参数」调整。` : null}
                  </p>
                ) : null}
              </InspectorField>

              {draft.identity.entityType === "boss" ? (
                <p className="character-setup-hint">Boss 建议使用 64×64 或更大画布，以保留剪影细节。</p>
              ) : null}
            </PanelSection>

            <PanelSection className={innerSectionClass} description="参考图可显著提升风格与轮廓一致性" title="参考素材">
              <button
                className="reference-dropzone"
                disabled={!canImportMoreReferences || isImportingReferences}
                onClick={() => void handleImportReferenceImages()}
                type="button"
              >
                <Upload aria-hidden="true" size={22} />
                <strong>{isImportingReferences ? "正在导入参考图" : "点击或拖拽上传参考图片"}</strong>
                <small>支持 PNG / JPG / WEBP，最多 4 张</small>
              </button>
              {referenceError ? <small className="field-error-text">{referenceError}</small> : null}
              {draft.referenceImages.length > 0 ? (
                <div className="reference-thumb-row">
                  {draft.referenceImages.map((image) => (
                    <figure className="reference-thumb imported" key={image.id}>
                      <img alt={image.fileName} src={image.dataUrl} />
                      <figcaption>
                        <Badge variant="secondary">{image.role}</Badge>
                        <button
                          aria-label={`移除参考图 ${image.fileName}`}
                          onClick={() =>
                            onDraftChange({
                              referenceImages: draft.referenceImages.filter((item) => item.id !== image.id),
                            })
                          }
                          type="button"
                        >
                          移除
                        </button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : null}
              {showLocalReferenceImg2imgWarning ? (
                <p className="character-setup-hint character-setup-hint--warning">
                  已上传参考图，但当前 sd-cpp Runtime 不支持 img2img。生成时将报错或无法使用参考图，请在「设置 → 本地生图 → 生图 Runtime」升级
                  Runtime 后再试。
                </p>
              ) : null}
              <AppSlider
                hint="越高越贴近参考图轮廓与配色"
                label={`参考图权重 · ${draft.referenceStrength.toFixed(2)}`}
                max={1}
                min={0}
                onChange={(referenceStrength) => onDraftChange({ referenceStrength })}
                step={0.05}
                value={draft.referenceStrength}
              />
              <FieldMessages field="referenceImages" validation={validation} />
            </PanelSection>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem className="character-config-accordion-item" data-setup-section="advanced" value="advanced">
          <AccordionTrigger className="character-config-accordion-trigger">
            <span className="character-config-accordion-trigger-label">高级生成选项</span>
            <SectionStatusBadge status={getSectionStatus(validation, "advanced")} />
          </AccordionTrigger>
          <AccordionContent className="character-config-accordion-content">
            <PanelSection className={innerSectionClass} description="控制候选数量、质量与背景处理" title="生成参数">
              <InspectorField label="生成数量">
                <SegmentedControl
                  ariaLabel="生成数量"
                  className="equal-segmented"
                  onValueChange={(generationCount) => onDraftChange({ generationCount })}
                  options={generationCountOptions.map((option) => ({ label: option, value: option }))}
                  value={draft.generationCount}
                />
              </InspectorField>

              <InspectorField label="生成质量">
                <AppSelect
                  ariaLabel="生成质量"
                  onValueChange={(generationQuality) =>
                    onDraftChange({
                      generationQuality: generationQuality as CharacterWorkshopDraft["generationQuality"],
                    })
                  }
                  options={generationQualityOptions.map((option) => ({ label: option, value: option }))}
                  value={draft.generationQuality}
                />
              </InspectorField>

              <InspectorField label="背景模式">
                <SegmentedControl
                  ariaLabel="背景模式"
                  className="background-mode-control"
                  onValueChange={(backgroundMode) =>
                    onDraftChange({ backgroundMode: backgroundMode as CharacterWorkshopDraft["backgroundMode"] })
                  }
                  options={backgroundModeOptions.map((option) => ({ label: option.label, value: option.value }))}
                  value={draft.backgroundMode}
                />
              </InspectorField>

              <div className="generation-option-list">
                {generationOptions.map((option) => (
                  <label key={option.label}>
                    <Checkbox
                      checked={draft.generationOptions.includes(option.value)}
                      onCheckedChange={() =>
                        onDraftChange({
                          generationOptions: toggleStringValue(draft.generationOptions, option.value),
                        })
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </PanelSection>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function SectionStatusBadge({ status }: { status: "complete" | "error" | "idle" | "warning" }) {
  if (status === "complete" || status === "idle") {
    return null;
  }

  return (
    <Badge className="character-config-section-badge" variant={status === "error" ? "destructive" : "secondary"}>
      {status === "error" ? "必填" : "建议"}
    </Badge>
  );
}

function FieldMessages({ field, validation }: { field: string; validation: CreateDraftValidationResult }) {
  const issues = getIssuesForField(validation, field);
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="character-config-field-messages">
      {issues.map((issue) => (
        <p className={issue.type === "blocking" ? "field-error-text" : "character-setup-hint"} key={`${issue.field}-${issue.message}`}>
          {issue.message}
        </p>
      ))}
    </div>
  );
}

function normalizeCanvasSide(value: string, fallback: number) {
  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(256, Math.max(16, parsedValue));
}

function formatCanvasSizeHint(draft: CharacterWorkshopDraft) {
  if (draft.size === "自定义") {
    return `${draft.customWidth}(W) x ${draft.customHeight}(H) 像素`;
  }

  const [width, height] = draft.size.split("x");
  return `${width}(W) x ${height}(H) 像素`;
}

function normalizeSelectedPaths(value: string | string[] | null) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function toggleStringValue(values: string[], value: string) {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }

  return [...values, value];
}
