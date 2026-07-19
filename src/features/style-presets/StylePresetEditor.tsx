import { useMemo } from "react";

import {
  AppSlider,
  ColorThemeSelect,
  InspectorField,
  PalettePresetSelect,
  PaletteSwatchGrid,
  TagInput,
  VisualChoiceGrid,
  VisualReferenceStrip,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { StylePresetGallery } from "../workflows/components/StylePresetGallery";
import {
  COLOR_THEME_MODE_CHOICES,
  EDGE_STYLE_CHOICES,
  LIGHTING_TYPE_CHOICES,
  LINE_WEIGHT_CHOICES,
  MATERIAL_STYLE_CHOICES,
  PALETTE_MODE_CHOICES,
  PIXEL_DENSITY_CHOICES,
  RENDER_TYPE_CHOICES,
  SHADING_STYLE_CHOICES,
  TEXTURE_STYLE_CHOICES,
} from "../workflows/styleChoiceCatalog";
import { previewStyleProfile } from "../workflows/styleProfilePreview";
import type { StylePresetDefinition } from "../workflows/stylePresets";

import { parseArtReferences, parsePaletteColorsParam } from "./stylePresetParams";
import {
  BUILTIN_COLOR_THEME_CATALOG,
  DEFAULT_CUSTOM_COLOR_THEME_COLORS,
  resolveActiveColorThemeId,
  type ColorThemeDefinition,
} from "./colorThemeCatalog";
import {
  BUILTIN_PALETTE_CATALOG,
  getBuiltinPalette,
  resolveActivePalettePresetId,
  type BuiltinPaletteDefinition,
} from "./stylePaletteCatalog";
import { VisualDnaSummary } from "./VisualDnaSummary";

interface StylePresetEditorProps {
  label: string;
  onLabelChange: (value: string) => void;
  onParamsChange: (params: Record<string, unknown>) => void;
  onPresetSelect?: (presetId: string) => void;
  onSave?: () => void;
  onTaglineChange: (value: string) => void;
  onTagsChange: (tags: string[]) => void;
  params: Record<string, unknown>;
  presetId?: string;
  presets?: StylePresetDefinition[];
  projectRoot?: string;
  saveDisabled?: boolean;
  showPresetGallery?: boolean;
  tagline: string;
  tags: string[];
}

function readNumber(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function StylePresetEditor({
  label,
  onLabelChange,
  onParamsChange,
  onPresetSelect,
  onSave,
  onTaglineChange,
  onTagsChange,
  params,
  presetId,
  presets = [],
  projectRoot = "",
  saveDisabled = false,
  showPresetGallery = false,
  tagline,
  tags,
}: StylePresetEditorProps) {
  const preview = useMemo(() => previewStyleProfile(params), [params]);
  const paletteColors = parsePaletteColorsParam(params.paletteColors ?? "[]");
  const maxColors = Math.round(readNumber(params, "maxColors", 16));
  const paletteMode = String(params.paletteMode ?? "preset");
  const paletteReadOnly = paletteMode === "preset" || paletteMode === "locked";
  const paletteLockForced = paletteMode === "locked";
  const activePalettePresetId = resolveActivePalettePresetId(params);
  const activePresetId = presetId ?? String(params.preset ?? params.presetId ?? "pixel_retro_16");
  const artReferences = parseArtReferences(params);
  const colorThemeMode = String(params.colorThemeMode ?? "preset");
  const activeColorThemeId = resolveActiveColorThemeId(params);
  const customColorThemeColors = parsePaletteColorsParam(
    params.customColorThemeColors ?? JSON.stringify(DEFAULT_CUSTOM_COLOR_THEME_COLORS),
  );

  function applyBuiltinColorTheme(theme: ColorThemeDefinition) {
    patchParams({
      colorTheme: theme.id,
      colorThemeMode: "preset",
    });
  }

  function handleColorThemeModeChange(mode: string) {
    if (mode === "custom") {
      const colors =
        customColorThemeColors.length >= 1
          ? customColorThemeColors
          : DEFAULT_CUSTOM_COLOR_THEME_COLORS.slice(0, 2);
      patchParams({
        colorThemeMode: "custom",
        customColorThemeColors: JSON.stringify(colors),
      });
      return;
    }

    const theme = BUILTIN_COLOR_THEME_CATALOG.find((item) => item.id === activeColorThemeId) ?? BUILTIN_COLOR_THEME_CATALOG[0];
    patchParams({
      colorTheme: theme.id,
      colorThemeMode: "preset",
    });
  }

  function applyBuiltinPalette(palette: BuiltinPaletteDefinition) {
    patchParams({
      maxColors: palette.maxColors,
      paletteColors: JSON.stringify(palette.colors),
      paletteMode: "preset",
      palettePresetId: palette.id,
    });
  }

  function patchParams(nextParams: Record<string, unknown>) {
    onParamsChange({ ...params, ...nextParams });
  }

  function patchParam(key: string, value: unknown) {
    patchParams({ [key]: value });
  }

  function handlePaletteModeChange(mode: string) {
    const next: Record<string, unknown> = { paletteMode: mode };

    if (mode === "preset") {
      const palette =
        getBuiltinPalette(activePalettePresetId) ?? BUILTIN_PALETTE_CATALOG[0];
      next.palettePresetId = palette.id;
      next.paletteColors = JSON.stringify(palette.colors);
      next.maxColors = palette.maxColors;
      if (!params.paletteLock) {
        next.paletteLock = true;
      }
    } else if (mode === "manual") {
      next.palettePresetId = "";
    } else if (mode === "locked") {
      next.paletteLock = true;
    }

    patchParams(next);
  }

  function handleArtReferencesChange(paths: string[]) {
    patchParams({
      artReference: paths[0] ?? "",
      artReferences: paths,
    });
  }

  return (
    <Tabs className="style-preset-editor-shell" defaultValue="overview" orientation="vertical">
      <TabsList className="style-preset-editor-nav" variant="line">
        <TabsTrigger className="style-preset-editor-nav-item" data-tab="overview" value="overview">
          概览
        </TabsTrigger>
        <TabsTrigger className="style-preset-editor-nav-item" data-tab="visualDna" value="visualDna">
          视觉基因
        </TabsTrigger>
        <TabsTrigger className="style-preset-editor-nav-item" data-tab="palette" value="palette">
          调色系统
        </TabsTrigger>
        <TabsTrigger className="style-preset-editor-nav-item" data-tab="lighting" value="lighting">
          光照模型
        </TabsTrigger>
        <TabsTrigger className="style-preset-editor-nav-item" data-tab="constraints" value="constraints">
          约束引擎
        </TabsTrigger>
        <TabsTrigger className="style-preset-editor-nav-item" data-tab="output" value="output">
          输出预览
        </TabsTrigger>
      </TabsList>

      <div className="style-preset-editor-content">
        <TabsContent className="style-preset-editor-panel" value="overview">
          <StylePresetSectionHeader
            description="编辑预设名称、标签与整体描述，保存后写入全局预设库。"
            title="概览"
          />
          <div className="style-preset-editor-meta">
            <InspectorField label="预设名称">
              <Input onChange={(event) => onLabelChange(event.target.value)} placeholder="如 像素复古 16 色" value={label} />
            </InspectorField>
            <InspectorField description="简短说明，显示在卡片副标题" label="描述">
              <Input
                onChange={(event) => onTaglineChange(event.target.value)}
                placeholder="如 16 色 · 平光 · 复古 RPG"
                value={tagline}
              />
            </InspectorField>
            <InspectorField description="用于库内搜索与筛选" label="标签">
              <TagInput onChange={onTagsChange} value={tags} />
            </InspectorField>
            {onSave ? (
              <div className="style-preset-editor-meta-actions">
                <Button disabled={saveDisabled} onClick={onSave} size="sm" type="button">
                  保存预设
                </Button>
              </div>
            ) : null}
          </div>
          <VisualDnaSummary params={params} />
          {showPresetGallery && presets.length && onPresetSelect ? (
            <InspectorField label="风格预设">
              <StylePresetGallery
                onSelect={onPresetSelect}
                presets={presets}
                selectedId={activePresetId}
                variant="library"
              />
            </InspectorField>
          ) : null}
          <InspectorField description="上传 1–4 张参考图，辅助生成时对齐构图与风格" label="视觉参考">
            <VisualReferenceStrip
              maxCount={4}
              onChange={handleArtReferencesChange}
              paths={artReferences}
              projectRoot={projectRoot}
            />
          </InspectorField>
        </TabsContent>

        <TabsContent className="style-preset-editor-panel" value="visualDna">
          <StylePresetSectionHeader
            description="定义渲染类型、材质与画面基础特征，影响生成 prompt 的核心风格词。"
            title="视觉基因"
          />
          <InspectorField label="渲染类型">
            <VisualChoiceGrid
              ariaLabel="渲染类型"
              className="workflow-visual-choice-grid"
              onValueChange={(value) => {
                patchParams({
                  renderType: value,
                  styleType: value === "realistic" ? "realism" : value === "hand_drawn" || value === "low_poly" ? "stylized" : value,
                });
              }}
              options={RENDER_TYPE_CHOICES}
              value={String(params.renderType ?? "pixel")}
            />
          </InspectorField>
          <InspectorField label="像素密度">
            <VisualChoiceGrid
              ariaLabel="像素密度"
              columns={4}
              onValueChange={(value) => patchParam("pixelDensity", value)}
              options={PIXEL_DENSITY_CHOICES}
              size="compact"
              value={normalizePixelDensityParam(params.pixelDensity)}
            />
          </InspectorField>
          <InspectorField label="边缘风格">
            <VisualChoiceGrid
              ariaLabel="边缘风格"
              columns={3}
              onValueChange={(value) => patchParam("edgeStyle", value)}
              options={EDGE_STYLE_CHOICES}
              size="compact"
              value={String(params.edgeStyle ?? "hard")}
            />
          </InspectorField>
          <InspectorField label="线稿粗细">
            <VisualChoiceGrid
              ariaLabel="线稿粗细"
              columns={4}
              onValueChange={(value) => patchParam("lineWeight", value)}
              options={LINE_WEIGHT_CHOICES}
              size="compact"
              value={String(params.lineWeight ?? "medium")}
            />
          </InspectorField>
          <InspectorField label="材质风格">
            <VisualChoiceGrid
              ariaLabel="材质风格"
              columns={5}
              onValueChange={(value) => patchParam("materialStyle", value)}
              options={MATERIAL_STYLE_CHOICES}
              size="compact"
              value={String(params.materialStyle ?? "flat")}
            />
          </InspectorField>
          <InspectorField label="明暗风格">
            <VisualChoiceGrid
              ariaLabel="明暗风格"
              columns={4}
              onValueChange={(value) => patchParam("shadingStyle", value)}
              options={SHADING_STYLE_CHOICES}
              size="compact"
              value={String(params.shadingStyle ?? "hard_cel")}
            />
          </InspectorField>
          <InspectorField label="纹理风格">
            <VisualChoiceGrid
              ariaLabel="纹理风格"
              columns={4}
              onValueChange={(value) => patchParam("textureStyle", value)}
              options={TEXTURE_STYLE_CHOICES}
              size="compact"
              value={String(params.textureStyle ?? "smooth")}
            />
          </InspectorField>
          <AppSlider
            hint="控制画面细节密度，数值越高纹理与结构越丰富。"
            label="细节等级"
            onChange={(value) => patchParam("detail", value)}
            value={readNumber(params, "detail", 0.6)}
          />
          <AppSlider
            hint="调整明暗反差，较高对比度适合像素与赛璐璐风格。"
            label="对比度"
            onChange={(value) => patchParam("contrast", value)}
            value={readNumber(params, "contrast", 0.7)}
          />
          <AppSlider
            hint="控制色彩鲜艳程度，过高可能导致色偏。"
            label="饱和度"
            onChange={(value) => patchParam("saturation", value)}
            value={readNumber(params, "saturation", 0.6)}
          />
          <AppSlider
            hint="提升边缘清晰度，像素风格可适当提高。"
            label="锐度"
            onChange={(value) => patchParam("sharpness", value)}
            value={readNumber(params, "sharpness", 0.4)}
          />
          <InspectorField
            description="追加到 stylePrompt 末尾的自定义风格关键词"
            label="自定义风格词"
          >
            <Input
              onChange={(event) => patchParam("visualDnaCustomKeywords", event.target.value)}
              placeholder="如 hand-painted foliage, retro RPG mood"
              value={String(params.visualDnaCustomKeywords ?? "")}
            />
          </InspectorField>
        </TabsContent>

        <TabsContent className="style-preset-editor-panel" value="palette">
          <StylePresetSectionHeader
            description="配置配色氛围与色板约束；预设 / 手动 / 锁定决定颜色来源与是否允许 drift。"
            title="调色系统"
          />
          <InspectorField label="配色模式">
            <VisualChoiceGrid
              ariaLabel="配色模式"
              columns={2}
              onValueChange={handleColorThemeModeChange}
              options={COLOR_THEME_MODE_CHOICES}
              value={colorThemeMode}
            />
          </InspectorField>
          {colorThemeMode === "preset" ? (
            <InspectorField
              hint="影响整体明暗与氛围，不绑定具体 hex 色板"
              label="配色主题"
            >
              <ColorThemeSelect
                onSelect={applyBuiltinColorTheme}
                selectedId={activeColorThemeId}
                themes={BUILTIN_COLOR_THEME_CATALOG}
              />
            </InspectorField>
          ) : (
            <InspectorField description="点击 + 添加颜色，至少保留 2 色" label="自定义配色">
              <div className="style-preset-editor-custom-theme-colors">
                <PaletteSwatchGrid
                  colors={customColorThemeColors}
                  maxColors={6}
                  onChange={(nextColors) => patchParam("customColorThemeColors", JSON.stringify(nextColors))}
                  removable={customColorThemeColors.length > 2}
                />
              </div>
            </InspectorField>
          )}
          <InspectorField label="调色模式">
            <VisualChoiceGrid
              ariaLabel="调色模式"
              columns={3}
              onValueChange={handlePaletteModeChange}
              options={PALETTE_MODE_CHOICES}
              value={paletteMode}
            />
          </InspectorField>
          {paletteMode === "preset" ? (
            <InspectorField description="从内置色板库选择，选中后下方预览只读" label="内置色板">
              <PalettePresetSelect
                onSelect={applyBuiltinPalette}
                palettes={BUILTIN_PALETTE_CATALOG}
                selectedId={activePalettePresetId}
              />
            </InspectorField>
          ) : null}
          <AppSlider
            label="最大色数"
            max={64}
            min={2}
            onChange={(value) => patchParam("maxColors", Math.round(value))}
            step={1}
            value={maxColors}
          />
          <AppSlider
            hint="色板约束在最终 prompt 中的权重。"
            label="色板强度"
            onChange={(value) => patchParam("paletteStrength", value)}
            value={readNumber(params, "paletteStrength", 0.85)}
          />
          <div className="workflow-style-switch-row">
            <span>抖动</span>
            <Switch checked={Boolean(params.dithering ?? true)} onCheckedChange={(checked) => patchParam("dithering", checked)} />
          </div>
          <div className="app-inspector-field">
            <span className="app-inspector-label">色板预览 ({paletteColors.length} / {maxColors})</span>
            <PaletteSwatchGrid
              colors={paletteColors}
              maxColors={maxColors}
              onChange={(nextColors) => patchParam("paletteColors", JSON.stringify(nextColors))}
              readOnly={paletteReadOnly}
              removable={!paletteReadOnly}
            />
            <small className="app-inspector-description">
              {paletteMode === "manual"
                ? "点击色块编辑；点 + 添加颜色"
                : paletteMode === "locked"
                  ? "锁定模式：色板只读，禁止 drift"
                  : "预设模式：已选内置色板，不可手动编辑"}
            </small>
          </div>
        </TabsContent>

        <TabsContent className="style-preset-editor-panel" value="lighting">
          <StylePresetSectionHeader
            description="选择光照类型并调节阴影、高光与环境光强度。"
            title="光照模型"
          />
          <InspectorField label="光照类型">
            <VisualChoiceGrid
              ariaLabel="光照类型"
              className="workflow-visual-choice-grid"
              onValueChange={(value) => patchParam("lightingType", value)}
              options={LIGHTING_TYPE_CHOICES}
              value={String(params.lightingType ?? "flat")}
            />
          </InspectorField>
          <AppSlider label="阴影强度" onChange={(value) => patchParam("shadowStrength", value)} value={readNumber(params, "shadowStrength", 0.5)} />
          <AppSlider label="高光强度" onChange={(value) => patchParam("highlightStrength", value)} value={readNumber(params, "highlightStrength", 0.3)} />
          <AppSlider label="环境光" onChange={(value) => patchParam("ambient", value)} value={readNumber(params, "ambient", 0.4)} />
        </TabsContent>

        <TabsContent className="style-preset-editor-panel" value="constraints">
          <StylePresetSectionHeader
            description="锁定色板 / 线稿 / 身份，并控制跨批次一致性强度。"
            title="约束引擎"
          />
          <StyleSwitchField
            checked={Boolean(params.paletteLock)}
            disabled={paletteLockForced}
            hint={paletteLockForced ? "锁定模式下色板约束不可关闭" : undefined}
            label="锁定色板"
            onChange={(checked) => patchParam("paletteLock", checked)}
          />
          <StyleSwitchField checked={Boolean(params.lineStyleLock)} label="锁定线稿" onChange={(checked) => patchParam("lineStyleLock", checked)} />
          <StyleSwitchField checked={Boolean(params.identityLock)} label="锁定身份" onChange={(checked) => patchParam("identityLock", checked)} />
          <AppSlider
            hint="跨批次生成时保持风格一致性的强度。"
            label="一致性强度"
            onChange={(value) => patchParam("consistencyStrength", value)}
            value={readNumber(params, "consistencyStrength", 0.85)}
          />
        </TabsContent>

        <TabsContent className="style-preset-editor-panel" value="output">
          <StylePresetSectionHeader
            description="查看由当前参数合成的 stylePrompt 与 styleProfile JSON。"
            title="输出预览"
          />
          <InspectorField label="stylePrompt">
            <Textarea className="workflow-style-output-text" readOnly rows={4} value={preview.stylePrompt} />
          </InspectorField>
          <InspectorField label="负向建议">
            <Textarea className="workflow-style-output-text" readOnly rows={3} value={preview.negativeHints.join(", ")} />
          </InspectorField>
          <InspectorField label="styleProfile JSON">
            <pre className="workflow-prompt-preview-block">{JSON.stringify(preview.styleProfile, null, 2)}</pre>
          </InspectorField>
        </TabsContent>
      </div>
    </Tabs>
  );
}

function StylePresetSectionHeader({ description, title }: { description: string; title: string }) {
  return (
    <div className="style-preset-editor-section-header">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function StyleSwitchField({
  checked,
  disabled = false,
  hint,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="workflow-style-switch-row">
      <span>
        {label}
        {hint ? <small className="app-inspector-description">{hint}</small> : null}
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

function normalizePixelDensityParam(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text === "none") {
    return "none";
  }
  return text;
}
