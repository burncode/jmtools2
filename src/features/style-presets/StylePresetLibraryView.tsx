import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { StylePresetCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { getStylePreset, getStylePresetThumbnail, STYLE_PRESETS, toStylePresetDefinition } from "../workflows/stylePresets";

import { StylePresetEditor } from "./StylePresetEditor";
import { buildStylePresetSummary } from "./buildStylePresetSummary";
import {
  countPresetsByCategory,
  filterPresetsByCategory,
} from "./stylePresetCategories";
import { STYLE_PRESET_CATEGORY_NAV } from "./stylePresetCategoryNav";
import {
  emitStylePresetSelected,
  parseStylePresetLibrarySearchParams,
} from "./stylePresetLibraryWindow";
import { findStylePreset, useStylePresets } from "./useStylePresets";
import { BUILTIN_PRESET_TAGS } from "./stylePresetTagOptions";
import type { StylePresetRecord } from "./types";

type LibraryScope = "all" | "mine";

function createDraftPreset(): StylePresetRecord {
  const seed = STYLE_PRESETS[0];
  const id = `custom_${Date.now()}`;

  return {
    createdAt: Date.now(),
    id,
    isBuiltin: false,
    label: "新建预设",
    params: { ...seed.params },
    tagline: "自定义风格",
    tags: [],
    thumbnail: seed.thumbnail,
    updatedAt: Date.now(),
  };
}

function resolvePresetTags(record: StylePresetRecord): string[] {
  if (record.tags.length > 0) {
    return record.tags;
  }
  return BUILTIN_PRESET_TAGS[record.id] ?? [];
}

function resolveActiveRecord(
  draft: StylePresetRecord | null,
  presets: StylePresetRecord[],
  selectedId: string,
): StylePresetRecord {
  if (draft) {
    return draft;
  }

  const stored = findStylePreset(presets, selectedId);
  if (stored) {
    return stored;
  }

  const fallback = getStylePreset(selectedId) ?? STYLE_PRESETS[0];
  return {
    ...toStylePresetDefinition(fallback),
    tags: BUILTIN_PRESET_TAGS[fallback.id] ?? [],
  };
}

function filterPresetsBySearch(presets: StylePresetRecord[], query: string): StylePresetRecord[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return presets;
  }

  return presets.filter(
    (preset) =>
      preset.label.toLowerCase().includes(normalized) ||
      preset.tagline.toLowerCase().includes(normalized) ||
      preset.id.toLowerCase().includes(normalized) ||
      resolvePresetTags(preset).some((tag) => tag.toLowerCase().includes(normalized)),
  );
}

function filterPresetsByScope(presets: StylePresetRecord[], scope: LibraryScope): StylePresetRecord[] {
  if (scope === "mine") {
    return presets.filter((preset) => !preset.isBuiltin);
  }
  return presets;
}

export function StylePresetLibraryView() {
  const initialPayload = useMemo(
    () => parseStylePresetLibrarySearchParams(window.location.search),
    [],
  );
  const { presets, refresh, save } = useStylePresets();
  const [selectedId, setSelectedId] = useState(initialPayload.presetId ?? "pixel_retro_16");
  const [draft, setDraft] = useState<StylePresetRecord | null>(null);
  const [label, setLabel] = useState("");
  const [tagline, setTagline] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [editorParams, setEditorParams] = useState<Record<string, unknown>>(STYLE_PRESETS[0].params);
  const [searchQuery, setSearchQuery] = useState("");
  const [scope, setScope] = useState<LibraryScope>("all");
  const [categoryId, setCategoryId] = useState("all");

  const activeRecord = resolveActiveRecord(draft, presets, selectedId);
  const activeIsBuiltin = draft ? false : Boolean(findStylePreset(presets, selectedId)?.isBuiltin);
  const isPickMode = initialPayload.mode === "pick";

  const scopedPresets = useMemo(() => filterPresetsByScope(presets, scope), [presets, scope]);
  const categoryPresets = useMemo(
    () => filterPresetsByCategory(scopedPresets, categoryId),
    [scopedPresets, categoryId],
  );
  const visiblePresets = useMemo(
    () => filterPresetsBySearch(categoryPresets, searchQuery),
    [categoryPresets, searchQuery],
  );

  useEffect(() => {
    setLabel(activeRecord.label);
    setTagline(activeRecord.tagline);
    setTags(resolvePresetTags(activeRecord));
    setEditorParams(activeRecord.params);
  }, [activeRecord]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen("style-preset-library-open", (event) => {
      const payload = event.payload as { presetId?: string };
      if (payload.presetId) {
        setDraft(null);
        setSelectedId(payload.presetId);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  function handleSelectPreset(presetId: string) {
    setDraft(null);
    setSelectedId(presetId);
  }

  function handleCreatePreset() {
    const nextDraft = createDraftPreset();
    setDraft(nextDraft);
    setSelectedId(nextDraft.id);
  }

  async function handleSavePreset() {
    const id = draft?.id ?? selectedId;
    await save({
      id,
      label: label.trim() || "未命名预设",
      params: editorParams,
      tagline: tagline.trim(),
      tags,
      thumbnail: id,
    });
    await emit("style-preset-saved", { presetId: id });
    setDraft(null);
    setSelectedId(id);
    await refresh();
  }

  async function handleUsePreset(presetId?: string) {
    await emitStylePresetSelected({
      nodeId: initialPayload.nodeId,
      presetId: presetId ?? draft?.id ?? selectedId,
    });
    await getCurrentWindow().close();
  }

  async function handleCloseWindow() {
    await getCurrentWindow().close();
  }

  return (
    <div className="style-preset-library-shell">
      <header className="style-preset-library-header">
        <div className="style-preset-library-header-title">
          <h1>风格预设库</h1>
          <p>浏览、新建并编辑全局风格预设。节点侧仅保留快选与局部覆盖。</p>
        </div>

        <div className="style-preset-library-search">
          <Search aria-hidden="true" className="style-preset-library-search-icon" />
          <Input
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索名称、标签或 ID"
            value={searchQuery}
          />
        </div>

        <div className="style-preset-library-header-actions">
          <Button onClick={handleCreatePreset} size="sm" type="button" variant="outline">
            新建空白预设
          </Button>
          {isPickMode ? (
            <Button onClick={() => void handleUsePreset()} size="sm" type="button">
              使用此预设
            </Button>
          ) : null}
          <Button aria-label="关闭窗口" onClick={() => void handleCloseWindow()} size="icon-sm" type="button" variant="ghost">
            <X aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="style-preset-library-body">
        <aside className="style-preset-library-filters">
          <div className="style-preset-library-scope-menu" role="group" aria-label="模板范围">
            {(
              [
                { id: "all", label: "全部模板" },
                { id: "mine", label: "我的模板" },
              ] as const
            ).map((item) => (
              <button
                className={cn(
                  "style-preset-library-scope-menu-item",
                  scope === item.id && "active",
                )}
                key={item.id}
                onClick={() => setScope(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <nav aria-label="风格分类" className="style-preset-library-category-list">
            {STYLE_PRESET_CATEGORY_NAV.map((category) => {
              const count = countPresetsByCategory(scopedPresets, category.id);
              const isActive = categoryId === category.id;

              return (
                <button
                  className={cn("style-preset-library-category-nav-item", isActive && "active")}
                  key={category.id}
                  onClick={() => setCategoryId(category.id)}
                  type="button"
                >
                  <span className="style-preset-library-category-label">{category.label}</span>
                  <span className="style-preset-library-category-count">{count}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="style-preset-library-grid-panel">
          <div className="style-preset-library-grid-header">
            <span>共 {visiblePresets.length} 个模板</span>
          </div>
          <div className="style-preset-library-grid">
            {visiblePresets.map((preset) => {
              const isSelected = (draft?.id ?? selectedId) === preset.id;
              const cardParams = isSelected ? editorParams : preset.params;

              return (
              <StylePresetCard
                key={preset.id}
                onSelect={() => handleSelectPreset(preset.id)}
                onUse={() => void handleUsePreset(preset.id)}
                selected={isSelected}
                showUseButton={isPickMode}
                tagline={buildStylePresetSummary(cardParams)}
                thumbnail={getStylePresetThumbnail(preset.thumbnail || preset.id)}
                title={isSelected ? label || preset.label : preset.label}
                variant="library"
              />
              );
            })}
          </div>
        </section>

        <section className="style-preset-library-editor-panel">
          <StylePresetEditor
            label={label}
            onLabelChange={setLabel}
            onParamsChange={setEditorParams}
            onSave={() => void handleSavePreset()}
            onTaglineChange={setTagline}
            onTagsChange={setTags}
            params={editorParams}
            presetId={draft?.id ?? selectedId}
            projectRoot={initialPayload.projectRoot ?? ""}
            saveDisabled={activeIsBuiltin}
            tagline={tagline}
            tags={tags}
          />
        </section>
      </div>

      <footer className="style-preset-library-footer">
        <span>找不到合适风格？</span>
        <button className="style-preset-library-footer-link" onClick={handleCreatePreset} type="button">
          新建空白预设
        </button>
      </footer>
    </div>
  );
}
