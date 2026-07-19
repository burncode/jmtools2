import { BookMarked, Plus, Tags, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CharacterTraitDictionaryEntry, PresetDictionaries, PresetDictionaryEntry } from "@/lib/tauri/commands";

import { invalidateCharacterTraitDictionaryCache } from "@/features/characters/create/hooks/useCharacterTraitDictionary";
import { defaultCharacterTraits } from "@/features/settings/settingsDefaults";

import { SettingsCallout, SettingsCardGrid } from "../components/SettingsPanelPrimitives";
import { SettingsSectionCard } from "../components/SettingsSectionCard";
import type { SettingsPanelProps } from "./types";

type DictionaryKey = keyof PresetDictionaries;

interface DictionaryEditorProps {
  description: string;
  entries: PresetDictionaryEntry[];
  kind: "feature" | "style";
  onEntriesChange: (entries: PresetDictionaryEntry[]) => void;
  title: string;
}

const maxEntries = {
  feature: 64,
  style: 32,
} as const;

export function PresetDictionarySettingsPanel({ settings, updateSettings }: SettingsPanelProps) {
  function updateDictionary(dictionaryKey: DictionaryKey, entries: PresetDictionaries[DictionaryKey]) {
    updateSettings({
      presetDictionaries: {
        ...settings.presetDictionaries,
        [dictionaryKey]: entries,
      },
    });
    if (dictionaryKey === "characterTraits") {
      invalidateCharacterTraitDictionaryCache();
    }
  }

  const traitEntries = settings.presetDictionaries.characterTraits?.length
    ? settings.presetDictionaries.characterTraits
    : defaultCharacterTraits;

  return (
    <div className="preset-dictionary-shell">
      <SettingsCallout className="preset-dictionary-intro" icon={BookMarked} title="应用级生产字典">
        这些预设会进入生成提示词和工作流参数，后续可继续扩展到场景、道具、特效、去背景、切割素材等工具。
      </SettingsCallout>

      <SettingsCardGrid wide>
        <DictionaryEditor
          description="维护角色生成左侧“像素风格”下拉选项，值会参与生成提示词。"
          entries={settings.presetDictionaries.characterStyles}
          kind="style"
          onEntriesChange={(entries) => updateDictionary("characterStyles", entries)}
          title="角色像素风格"
        />
        <DictionaryEditor
          description="维护角色生成左侧“特色元素”候选标签，适合装备、部件和职业特征。"
          entries={settings.presetDictionaries.characterFeatures}
          kind="feature"
          onEntriesChange={(entries) => updateDictionary("characterFeatures", entries)}
          title="角色特色元素"
        />
        <TraitDictionaryEditor
          entries={traitEntries}
          onEntriesChange={(entries) => updateDictionary("characterTraits", entries)}
        />
      </SettingsCardGrid>
    </div>
  );
}

function DictionaryEditor({ description, entries, kind, onEntriesChange, title }: DictionaryEditorProps) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [entryDescription, setEntryDescription] = useState("");
  const enabledCount = entries.filter((entry) => entry.enabled).length;

  function handleAddEntry() {
    const nextLabel = label.trim();
    const nextValue = (value.trim() || nextLabel).trim();

    if (!nextLabel || entries.length >= maxEntries[kind]) {
      return;
    }

    const isDuplicate = entries.some(
      (entry) => entry.label.trim() === nextLabel || entry.value.trim() === nextValue,
    );

    if (isDuplicate) {
      return;
    }

    onEntriesChange([
      ...entries,
      {
        description: entryDescription.trim().slice(0, 160),
        enabled: true,
        id: createPresetEntryId(kind),
        label: nextLabel.slice(0, 16),
        value: nextValue.slice(0, kind === "style" ? 80 : 32),
      },
    ]);
    setLabel("");
    setValue("");
    setEntryDescription("");
  }

  function updateEntry(entryId: string, nextEntry: Partial<PresetDictionaryEntry>) {
    onEntriesChange(entries.map((entry) => (entry.id === entryId ? { ...entry, ...nextEntry } : entry)));
  }

  function removeEntry(entryId: string) {
    onEntriesChange(entries.filter((entry) => entry.id !== entryId));
  }

  return (
    <SettingsSectionCard description={description} icon={kind === "style" ? BookMarked : Tags} title={title}>
      <div className="preset-dictionary-summary">
        <span>
          已维护 <strong>{entries.length}</strong> 项
        </span>
        <span>
          启用 <strong>{enabledCount}</strong> 项
        </span>
      </div>

      <div className="preset-dictionary-form">
        <Input
          maxLength={16}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={kind === "style" ? "风格名称，如 16bit RPG" : "元素名称，如 盔甲"}
          value={label}
        />
        <Input
          maxLength={kind === "style" ? 80 : 32}
          onChange={(event) => setValue(event.target.value)}
          placeholder={kind === "style" ? "提示词值，留空则使用名称" : "标签值，留空则使用名称"}
          value={value}
        />
        <Textarea
          maxLength={160}
          onChange={(event) => setEntryDescription(event.target.value)}
          placeholder="备注，可选"
          value={entryDescription}
        />
        <Button disabled={!label.trim() || entries.length >= maxEntries[kind]} onClick={handleAddEntry} type="button">
          <Plus aria-hidden="true" />
          添加预设
        </Button>
      </div>

      <div className="preset-dictionary-list" aria-label={`${title}列表`}>
        {entries.length > 0 ? (
          entries.map((entry) => (
            <article className="preset-dictionary-item" data-disabled={!entry.enabled} key={entry.id}>
              <div>
                <strong>{entry.label}</strong>
                <span>{entry.value}</span>
                {entry.description ? <small>{entry.description}</small> : null}
              </div>
              <Badge variant={entry.enabled ? "default" : "secondary"}>{entry.enabled ? "已启用" : "已停用"}</Badge>
              <Button
                onClick={() => updateEntry(entry.id, { enabled: !entry.enabled })}
                size="sm"
                type="button"
                variant="outline"
              >
                {entry.enabled ? "停用" : "启用"}
              </Button>
              <Button
                aria-label={`删除预设 ${entry.label}`}
                onClick={() => removeEntry(entry.id)}
                size="icon"
                type="button"
                variant="outline"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </article>
          ))
        ) : (
          <div className="preset-dictionary-empty">暂无预设，添加后会出现在对应生成工具中。</div>
        )}
      </div>
    </SettingsSectionCard>
  );
}

function createPresetEntryId(kind: "feature" | "style") {
  return `character-${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface TraitDictionaryEditorProps {
  entries: CharacterTraitDictionaryEntry[];
  onEntriesChange: (entries: CharacterTraitDictionaryEntry[]) => void;
}

function TraitDictionaryEditor({ entries, onEntriesChange }: TraitDictionaryEditorProps) {
  const [label, setLabel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<CharacterTraitDictionaryEntry["category"]>("costume");

  function handleAddEntry() {
    const nextLabel = label.trim();
    const nextPrompt = prompt.trim();
    if (!nextLabel || !nextPrompt || entries.length >= 96) {
      return;
    }

    onEntriesChange([
      ...entries,
      {
        category,
        description: "",
        enabled: true,
        entityTypes: ["humanoid"],
        id: `trait-${Date.now().toString(36)}`,
        label: nextLabel.slice(0, 32),
        prompt: nextPrompt.slice(0, 160),
        value: nextLabel.slice(0, 32),
      },
    ]);
    setLabel("");
    setPrompt("");
  }

  function updateEntry(entryId: string, nextEntry: Partial<CharacterTraitDictionaryEntry>) {
    onEntriesChange(entries.map((entry) => (entry.id === entryId ? { ...entry, ...nextEntry } : entry)));
  }

  function removeEntry(entryId: string) {
    onEntriesChange(entries.filter((entry) => entry.id !== entryId));
  }

  return (
    <SettingsSectionCard
      description="维护创建向导「外观特征」资源库条目，可按实体类型过滤。"
      icon={Tags}
      title="角色外观特征"
    >
      <div className="preset-dictionary-form">
        <Input maxLength={32} onChange={(event) => setLabel(event.target.value)} placeholder="特征名称，如 道袍" value={label} />
        <Input maxLength={160} onChange={(event) => setPrompt(event.target.value)} placeholder="Prompt 描述" value={prompt} />
        <Input onChange={(event) => setCategory(event.target.value as CharacterTraitDictionaryEntry["category"])} placeholder="分类 costume/weapon/body/effect/other" value={category} />
        <Button disabled={!label.trim() || !prompt.trim()} onClick={handleAddEntry} type="button">
          <Plus aria-hidden="true" />
          添加特征
        </Button>
      </div>
      <div className="preset-dictionary-list" aria-label="角色外观特征列表">
        {entries.map((entry) => (
          <article className="preset-dictionary-item" data-disabled={!entry.enabled} key={entry.id}>
            <div>
              <strong>{entry.label}</strong>
              <span>{entry.category}</span>
              <small>{entry.prompt}</small>
            </div>
            <Badge variant={entry.enabled ? "default" : "secondary"}>{entry.enabled ? "已启用" : "已停用"}</Badge>
            <Button onClick={() => updateEntry(entry.id, { enabled: !entry.enabled })} size="sm" type="button" variant="outline">
              {entry.enabled ? "停用" : "启用"}
            </Button>
            <Button aria-label={`删除特征 ${entry.label}`} onClick={() => removeEntry(entry.id)} size="icon" type="button" variant="outline">
              <Trash2 aria-hidden="true" />
            </Button>
          </article>
        ))}
      </div>
    </SettingsSectionCard>
  );
}
