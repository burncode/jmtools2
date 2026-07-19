import { ChevronDown, ChevronUp, Compass, Trash2, Wand2 } from "lucide-react";

import { AppSelect, InspectorField, SegmentedControl } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { CharacterActionTrackId, CharacterAssetRecord } from "../types";
import { resolveCharacterImageSrc } from "../characterImageSrc";
import { CharacterDirectionPicker } from "./CharacterDirectionPicker";
import type { DirectionViewKind } from "./CharacterDirectionGrid";

export interface ActionCardDraft {
  facingDirections: DirectionViewKind[];
  generationMode: "filmstrip" | "perFrame";
  loopMode: "loop" | "once";
  motionPrompt: string;
  previewFps: number;
  previewViewKind: DirectionViewKind;
  targetFrameCount: number;
  userFeedback: string;
}

export interface CharacterActionCardItem {
  frameCount: number;
  id: CharacterActionTrackId;
  label: string;
  note: string;
  status: "draft" | "empty" | "generated" | "ready";
  track?: CharacterAssetRecord["actions"][number];
}

interface CharacterActionCardProps {
  allDirectionsLabel: string;
  draft: ActionCardDraft;
  expanded: boolean;
  isBusy: boolean;
  item: CharacterActionCardItem;
  onDelete: () => void;
  onDirectionsChange: (viewKinds: DirectionViewKind[], previewViewKind: DirectionViewKind) => void;
  onDraftChange: (patch: Partial<ActionCardDraft>) => void;
  onAllDirections: () => void;
  onRegenerate: () => void;
  onSelect: () => void;
  onToggleExpand: () => void;
  projectRoot: string;
  record: CharacterAssetRecord;
  selected: boolean;
  showAllDirections: boolean;
}

function getStatusDot(status: CharacterActionCardItem["status"], qualityScore?: number) {
  if (status === "generated" || status === "ready") {
    if (qualityScore !== undefined && qualityScore < 70) {
      return "warning";
    }
    return "complete";
  }
  if (status === "draft") {
    return "draft";
  }
  return "empty";
}

export function CharacterActionCard({
  allDirectionsLabel,
  draft,
  expanded,
  isBusy,
  item,
  onDelete,
  onDirectionsChange,
  onDraftChange,
  onAllDirections,
  onRegenerate,
  onSelect,
  onToggleExpand,
  projectRoot,
  record,
  selected,
  showAllDirections,
}: CharacterActionCardProps) {
  const qualityScore = item.track?.qualityScore;
  const statusDot = getStatusDot(item.status, qualityScore);
  const frameThumbs = item.track?.frames ?? [];

  return (
    <article
      className="character-action-card"
      data-expanded={expanded ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
    >
      <header className="character-action-card-header">
        <button className="character-action-card-select" onClick={onSelect} type="button">
          <span className="character-action-card-status" data-status={statusDot} />
          <div className="character-action-card-title">
            <strong>{item.label}</strong>
            <small>{item.id}</small>
          </div>
          <Badge variant="outline">{item.frameCount} 帧</Badge>
        </button>
        <div className="character-action-card-header-actions">
          <Button aria-label={expanded ? "收起动作卡片" : "展开动作卡片"} onClick={onToggleExpand} size="sm" type="button" variant="ghost">
            {expanded ? <ChevronUp aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
          </Button>
          <Button aria-label={`删除 ${item.label}`} onClick={onDelete} size="sm" type="button" variant="ghost">
            <Trash2 aria-hidden="true" size={14} />
          </Button>
        </div>
      </header>

      {frameThumbs.length > 0 ? (
        <div aria-hidden={!expanded && !selected} className="character-action-card-strip">
          {frameThumbs.slice(0, 8).map((frame) => {
            const frameSrc = resolveCharacterImageSrc(projectRoot, frame.image);
            return (
              <span className="character-action-card-thumb" key={frame.id}>
                {frameSrc ? <img alt="" src={frameSrc} /> : <i>{frame.index + 1}</i>}
              </span>
            );
          })}
        </div>
      ) : null}

      {expanded ? (
        <div className="character-action-card-body">
          <div className="character-action-card-params">
            <InspectorField label="帧数">
              <Input
                max={16}
                min={2}
                onChange={(event) => onDraftChange({ targetFrameCount: Number(event.target.value) || 6 })}
                type="number"
                value={draft.targetFrameCount}
              />
            </InspectorField>
            <InspectorField label="帧率">
              <Input
                max={60}
                min={1}
                onChange={(event) => onDraftChange({ previewFps: Number(event.target.value) || 12 })}
                type="number"
                value={draft.previewFps}
              />
            </InspectorField>
            <InspectorField label="循环">
              <AppSelect
                ariaLabel="循环模式"
                onValueChange={(value) => onDraftChange({ loopMode: value as ActionCardDraft["loopMode"] })}
                options={[
                  { label: "循环", value: "loop" },
                  { label: "一次", value: "once" },
                ]}
                size="compact"
                value={draft.loopMode}
              />
            </InspectorField>
          </div>
          <InspectorField label="动作描述（建议英文）">
            <Textarea
              onChange={(event) => onDraftChange({ motionPrompt: event.target.value })}
              placeholder="例如：drop to knees in defeat"
              value={draft.motionPrompt}
            />
          </InspectorField>
          <InspectorField label="面向方向">
            <CharacterDirectionPicker
              direction={record.direction}
              onChange={(viewKinds, previewViewKind) => {
                onDraftChange({ facingDirections: viewKinds, previewViewKind });
                onDirectionsChange(viewKinds, previewViewKind);
              }}
              previewViewKind={draft.previewViewKind}
              projectRoot={projectRoot}
              record={record}
              showEightWayHint={record.direction === "eight"}
              value={draft.facingDirections}
            />
          </InspectorField>
          <div className="character-action-card-actions">
            <Button className="primary-action" disabled={isBusy} onClick={onRegenerate} size="sm" type="button">
              <Wand2 aria-hidden="true" />
              {isBusy ? "生成中…" : "重新生成"}
            </Button>
            {showAllDirections ? (
              <Button disabled={isBusy} onClick={onAllDirections} size="sm" type="button" variant="outline">
                <Compass aria-hidden="true" />
                {allDirectionsLabel}
              </Button>
            ) : null}
          </div>
          <Collapsible className="character-action-card-advanced">
            <CollapsibleTrigger asChild>
              <Button size="sm" type="button" variant="ghost">
                高级选项
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="character-action-card-advanced-body">
              <InspectorField label="生成模式">
                <SegmentedControl
                  ariaLabel="生成模式"
                  onValueChange={(value) =>
                    onDraftChange({ generationMode: value as ActionCardDraft["generationMode"] })
                  }
                  options={[
                    { label: "Filmstrip", value: "filmstrip" },
                    { label: "逐帧", value: "perFrame" },
                  ]}
                  value={draft.generationMode}
                />
              </InspectorField>
              <InspectorField label="反馈再生">
                <Textarea
                  onChange={(event) => onDraftChange({ userFeedback: event.target.value })}
                  placeholder="帧数不够、动作幅度太小…"
                  value={draft.userFeedback}
                />
              </InspectorField>
            </CollapsibleContent>
          </Collapsible>
          {item.track?.qualityScore !== undefined ? (
            <Badge variant="secondary">
              QC {item.track.qualityGrade ?? "unknown"} · {item.track.qualityScore}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
