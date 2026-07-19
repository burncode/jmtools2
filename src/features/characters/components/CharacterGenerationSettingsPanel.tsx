import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { AppSelect, InspectorField, PanelSection } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyProjectCharacterGenerationSettings,
  type ProjectCharacterGenerationSettings,
} from "@/features/projects/characterGenerationTypes";
import { appLogger } from "@/lib/logger";
import {
  getProjectCharacterGeneration,
  updateProjectCharacterGeneration,
} from "@/lib/tauri/projectCharacterGeneration";

import type { CharacterLibraryRecord } from "../types";

const NONE_LAYOUT_ANCHOR = "__none__";

interface CharacterGenerationSettingsPanelProps {
  libraryRecords: CharacterLibraryRecord[];
  projectRoot: string;
}

export function CharacterGenerationSettingsPanel({
  libraryRecords,
  projectRoot,
}: CharacterGenerationSettingsPanelProps) {
  const [settings, setSettings] = useState<ProjectCharacterGenerationSettings>(
    emptyProjectCharacterGenerationSettings(),
  );
  const [variantEntries, setVariantEntries] = useState<Array<{ key: string; value: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    void getProjectCharacterGeneration(projectRoot)
      .then((loaded) => {
        if (!mounted) {
          return;
        }
        const next = { ...emptyProjectCharacterGenerationSettings(), ...loaded };
        setSettings(next);
        setVariantEntries(
          Object.entries(next.styleAnchorVariants ?? {}).map(([key, value]) => ({ key, value })),
        );
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message : String(error);
        void appLogger.error(`读取角色生成配置失败：${text}`);
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [projectRoot]);

  function patchSettings(patch: Partial<ProjectCharacterGenerationSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function patchTemplate(field: keyof ProjectCharacterGenerationSettings["generationTemplate"], value: string) {
    setSettings((current) => ({
      ...current,
      generationTemplate: {
        ...current.generationTemplate,
        [field]: value,
      },
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    setMessage("");
    try {
      const styleAnchorVariants = Object.fromEntries(
        variantEntries
          .map((entry) => [entry.key.trim(), entry.value.trim()] as const)
          .filter(([key, value]) => key && value),
      );
      const saved = await updateProjectCharacterGeneration(projectRoot, {
        ...settings,
        styleAnchorVariants,
      });
      setSettings(saved);
      setVariantEntries(Object.entries(saved.styleAnchorVariants ?? {}).map(([key, value]) => ({ key, value })));
      setMessage("已保存项目角色生成配置。");
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setMessage(text);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <div className="character-generation-settings-loading">正在读取项目生成配置…</div>;
  }

  return (
    <div className="character-generation-settings-panel">
      <PanelSection description="全项目共用的风格锚点与生成模板，会注入到母版/视图/动作 prompt。" title="风格锚点">
        <InspectorField label="默认 STYLE ANCHOR">
          <Textarea
            onChange={(event) => patchSettings({ styleAnchor: event.target.value })}
            placeholder="例如：Top-down 2D chibi, soft cel-shaded, clean outlines…"
            rows={4}
            value={settings.styleAnchor ?? ""}
          />
        </InspectorField>
      </PanelSection>

      <PanelSection description="自定义 key，创建角色时可选；不写死 hero/enemy 分类。" title="风格变体">
        <div className="character-generation-variant-list">
          {variantEntries.map((entry, index) => (
            <div className="character-generation-variant-row" key={`variant-${index}`}>
              <Input
                aria-label="变体 key"
                onChange={(event) =>
                  setVariantEntries((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, key: event.target.value } : item,
                    ),
                  )
                }
                placeholder="variant_key"
                value={entry.key}
              />
              <Textarea
                aria-label="变体描述"
                onChange={(event) =>
                  setVariantEntries((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, value: event.target.value } : item,
                    ),
                  )
                }
                placeholder="该变体的额外风格描述"
                rows={2}
                value={entry.value}
              />
              <Button
                aria-label="删除变体"
                onClick={() => setVariantEntries((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" size={14} />
              </Button>
            </div>
          ))}
        </div>
        <Button
          onClick={() => setVariantEntries((current) => [...current, { key: "", value: "" }])}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" size={14} />
          添加变体
        </Button>
      </PanelSection>

      <PanelSection description="跨角色布局/画风引用" title="布局基准">
        <InspectorField label="布局基准角色">
          <AppSelect
            ariaLabel="布局基准角色"
            onValueChange={(value) =>
              patchSettings({ layoutAnchorCharacterId: value === NONE_LAYOUT_ANCHOR ? "" : value })
            }
            options={[
              { label: "未设置", value: NONE_LAYOUT_ANCHOR },
              ...libraryRecords.map((record) => ({
                label: record.displayName || record.id,
                value: record.id,
              })),
            ]}
            value={settings.layoutAnchorCharacterId?.trim() ? settings.layoutAnchorCharacterId : NONE_LAYOUT_ANCHOR}
          />
        </InspectorField>
        <InspectorField label="布局描述">
          <Textarea
            onChange={(event) => patchSettings({ layoutAnchorDescription: event.target.value })}
            placeholder="例如：equal-width filmstrip columns, consistent body scale"
            rows={2}
            value={settings.layoutAnchorDescription ?? ""}
          />
        </InspectorField>
      </PanelSection>

      <PanelSection description="按需注入母版与 walk filmstrip prompt" title="生成模板">
        <InspectorField label="镜头 / 视角">
          <Input
            onChange={(event) => patchTemplate("perspective", event.target.value)}
            placeholder="strict top-down, camera directly above"
            value={settings.generationTemplate?.perspective ?? ""}
          />
        </InspectorField>
        <InspectorField label="比例">
          <Input
            onChange={(event) => patchTemplate("proportion", event.target.value)}
            placeholder="chibi, large head small body"
            value={settings.generationTemplate?.proportion ?? ""}
          />
        </InspectorField>
        <InspectorField label="背景">
          <Input
            onChange={(event) => patchTemplate("background", event.target.value)}
            placeholder="solid chroma or white, no scene"
            value={settings.generationTemplate?.background ?? ""}
          />
        </InspectorField>
        <InspectorField label="Walk cycle 提示">
          <Input
            onChange={(event) => patchTemplate("walkCycleHints", event.target.value)}
            placeholder="exaggerated leg movement, clear loop phases"
            value={settings.generationTemplate?.walkCycleHints ?? ""}
          />
        </InspectorField>
      </PanelSection>

      <footer className="character-generation-settings-footer">
        {message ? <span>{message}</span> : <span>配置写入 jmproject.json 的 characterGeneration 字段。</span>}
        <Button disabled={isSaving} onClick={() => void handleSave()} type="button">
          <Save aria-hidden="true" size={14} />
          {isSaving ? "保存中…" : "保存配置"}
        </Button>
      </footer>
    </div>
  );
}
