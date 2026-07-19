import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { InspectorField } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { MotionPresetPicker } from "../components/MotionPresetPicker";
import {
  characterMotionPresetCatalog,
  type CharacterMotionPreset,
} from "./motionPresets";
import {
  emitCharacterMotionPresetSelected,
  parseCharacterMotionPresetLibrarySearchParams,
  type CharacterMotionPresetLibraryOpenPayload,
} from "./characterMotionPresetLibraryWindow";

function normalizeActionSlug(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function CharacterMotionPresetLibraryView() {
  const [payload, setPayload] = useState<CharacterMotionPresetLibraryOpenPayload>(() =>
    parseCharacterMotionPresetLibrarySearchParams(window.location.search),
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>();
  const [customSlug, setCustomSlug] = useState("hurt");
  const [customLabel, setCustomLabel] = useState("受击");
  const [customFrames, setCustomFrames] = useState(4);
  const [customPrompt, setCustomPrompt] = useState("hit reaction, knockback");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return void listen<CharacterMotionPresetLibraryOpenPayload>(
      "character-motion-preset-library-open",
      (event) => {
        setPayload(event.payload);
        setError("");
      },
    );
  }, []);

  const existingIds = useMemo(() => new Set(payload.existingActionIds), [payload.existingActionIds]);

  async function handleClose() {
    await getCurrentWindow().close();
  }

  async function submitSelection(selection: {
    actionId: string;
    defaultFrames: number;
    label: string;
    motionPrompt: string;
  }) {
    const actionId = normalizeActionSlug(selection.actionId);
    if (!actionId) {
      setError("动作 ID 无效，请使用字母、数字或下划线。");
      return;
    }
    if (existingIds.has(actionId)) {
      setError(`动作「${actionId}」已存在，请选择其他预设或修改 ID。`);
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await emitCharacterMotionPresetSelected({
        actionId,
        characterId: payload.characterId,
        defaultFrames: selection.defaultFrames,
        label: selection.label.trim() || actionId,
        motionPrompt: selection.motionPrompt.trim(),
        projectRoot: payload.projectRoot,
      });
      await handleClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePresetSelect(preset: CharacterMotionPreset) {
    setSelectedPresetId(preset.id);
    await submitSelection({
      actionId: preset.actionId,
      defaultFrames: preset.defaultFrames,
      label: preset.label,
      motionPrompt: preset.prompt,
    });
  }

  async function handleCustomSubmit() {
    await submitSelection({
      actionId: customSlug,
      defaultFrames: customFrames,
      label: customLabel,
      motionPrompt: customPrompt,
    });
  }

  return (
    <div className="character-motion-preset-library-shell">
      <header className="character-motion-preset-library-header">
        <div className="character-motion-preset-library-header-title">
          <h1>添加动作</h1>
          <p>从预设选择或创建自定义动作轨道</p>
        </div>
        <Button aria-label="关闭" onClick={() => void handleClose()} size="sm" type="button" variant="ghost">
          <X aria-hidden="true" size={16} />
        </Button>
      </header>

      <div className="character-motion-preset-library-body">
        <aside className="character-motion-preset-library-sidebar">
          <nav aria-label="动作分类" className="character-motion-preset-library-nav">
            {characterMotionPresetCatalog.categories.map((category) => (
              <div className="character-motion-preset-library-nav-group" key={category.id}>
                <strong>{category.label}</strong>
                <span>{category.presets.length} 项</span>
              </div>
            ))}
          </nav>
        </aside>

        <section className="character-motion-preset-library-main">
          <MotionPresetPicker onSelect={(preset) => void handlePresetSelect(preset)} selectedPresetId={selectedPresetId} />
        </section>
      </div>

      <footer className="character-motion-preset-library-footer">
        <div className="character-motion-preset-library-custom">
          <strong>自定义动作</strong>
          <div className="character-motion-preset-library-custom-fields">
            <InspectorField label="动作 ID">
              <Input
                onChange={(event) => setCustomSlug(event.target.value)}
                placeholder="hurt"
                value={customSlug}
              />
            </InspectorField>
            <InspectorField label="显示名">
              <Input onChange={(event) => setCustomLabel(event.target.value)} value={customLabel} />
            </InspectorField>
            <InspectorField label="默认帧数">
              <Input
                max={16}
                min={2}
                onChange={(event) => setCustomFrames(Number(event.target.value) || 4)}
                type="number"
                value={customFrames}
              />
            </InspectorField>
          </div>
          <InspectorField label="动作描述（建议英文）">
            <Input onChange={(event) => setCustomPrompt(event.target.value)} value={customPrompt} />
          </InspectorField>
          {error ? <p className="character-motion-preset-library-error">{error}</p> : null}
          <Button disabled={isSubmitting} onClick={() => void handleCustomSubmit()} type="button">
            {isSubmitting ? "添加中…" : "添加自定义动作"}
          </Button>
        </div>
        <Badge variant="outline">已有 {existingIds.size} 个动作</Badge>
      </footer>
    </div>
  );
}
