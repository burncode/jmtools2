import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveCharacterImageSrc } from "@/features/characters/characterImageSrc";
import { appLogger } from "@/lib/logger";
import { reextractFilmstripFrames } from "@/lib/tauri/projectCharacterGeneration";

import type { CharacterActionTrack, CharacterAssetRecord } from "../types";

interface FilmstripCutEditorProps {
  actionTrack: CharacterActionTrack;
  onRecordChange?: (record: CharacterAssetRecord) => void;
  projectRoot: string;
  record: CharacterAssetRecord;
}

export function FilmstripCutEditor({
  actionTrack,
  onRecordChange,
  projectRoot,
  record,
}: FilmstripCutEditorProps) {
  const stripSrc = resolveCharacterImageSrc(projectRoot, actionTrack.filmstripSource);
  const initialCuts = actionTrack.filmstripCutPositions ?? [];
  const [cuts, setCuts] = useState<number[]>(initialCuts);
  const [isApplying, setIsApplying] = useState(false);

  const frameCount = Math.max(1, actionTrack.frames.length);

  useEffect(() => {
    setCuts(initialCuts);
  }, [actionTrack.id, initialCuts]);

  if (!stripSrc || frameCount <= 1) {
    return null;
  }

  async function handleApply() {
    setIsApplying(true);
    try {
      const nextRecord = await reextractFilmstripFrames({
        actionId: actionTrack.id,
        characterId: record.id,
        cutPositions: cuts,
        projectRoot,
      });
      onRecordChange?.(nextRecord);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await appLogger.error(`重新切分 filmstrip 失败：${message}`);
    } finally {
      setIsApplying(false);
    }
  }

  function updateCut(index: number, value: number) {
    setCuts((current) => current.map((cut, cutIndex) => (cutIndex === index ? value : cut)));
  }

  return (
    <section aria-label="Filmstrip 切线" className="filmstrip-cut-editor">
      <header>
        <strong>Filmstrip 切线</strong>
        <span>自动切分后可微调切线位置并重新导出帧</span>
      </header>
      <div className="filmstrip-cut-editor-preview">
        <img alt="" className="filmstrip-cut-editor-strip" src={stripSrc} />
        {cuts.map((cut, index) => (
          <span
            className="filmstrip-cut-editor-line"
            key={`cut-${index}`}
            style={{ left: `${(cut / Math.max(1, actionTrack.filmstripSource?.width ?? 1)) * 100}%` }}
          />
        ))}
      </div>
      <div className="filmstrip-cut-editor-controls">
        {cuts.map((cut, index) => (
          <label key={`cut-input-${index}`}>
            切线 {index + 1}
            <Input
              min={1}
              onChange={(event) => updateCut(index, Number(event.target.value) || 0)}
              type="number"
              value={cut}
            />
          </label>
        ))}
        <Button disabled={isApplying} onClick={() => void handleApply()} size="sm" type="button">
          {isApplying ? "应用中…" : "应用切线并重切帧"}
        </Button>
      </div>
    </section>
  );
}
