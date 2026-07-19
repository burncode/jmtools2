import { Download } from "lucide-react";
import { useState } from "react";

import { AppSelect, InspectorField, SegmentedControl } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CharacterAssetRecord } from "@/features/characters/types";
import { exportAnimation } from "@/lib/tauri/characterPipeline";
import { logProductionError, logProductionStep } from "@/stores/characterProductionLogStore";

interface CharacterExportPopoverProps {
  projectRoot: string;
  record: CharacterAssetRecord;
}

type ExportFormat = "png" | "json" | "godot" | "spritesheet" | "aseprite" | "manifest";

export function CharacterExportPopover({ projectRoot, record }: CharacterExportPopoverProps) {
  const actions = record.actions.length > 0 ? record.actions : [{ id: "idle", label: "idle" }];
  const [exportActionId, setExportActionId] = useState(actions[0]?.id ?? "idle");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  async function handleExport() {
    setIsBusy(true);
    setMessage("");
    logProductionStep("正在导出…", "export");
    try {
      const result = await exportAnimation({
        actionId: exportActionId,
        characterId: record.id,
        exportFormat,
        projectRoot,
      });
      setMessage(`导出完成：${result.path}`);
      logProductionStep(`导出完成：${result.path}`, "export");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessage(`导出失败：${errorMessage}`);
      logProductionError(`导出失败：${errorMessage}`, "export");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button type="button">
          <Download aria-hidden="true" />
          导出
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="character-export-popover" side="bottom">
        <header className="character-export-popover-header">
          <strong>导出动作</strong>
          <span>导出到项目 exports 目录</span>
        </header>
        <InspectorField label="动作">
          <AppSelect
            ariaLabel="导出动作"
            onValueChange={setExportActionId}
            options={actions.map((action) => ({
              label: action.label ?? action.id,
              value: action.id,
            }))}
            value={exportActionId}
          />
        </InspectorField>
        <InspectorField label="格式">
          <SegmentedControl
            ariaLabel="导出格式"
            onValueChange={(value) => setExportFormat(value as ExportFormat)}
            options={[
              { label: "PNG", value: "png" },
              { label: "Manifest", value: "manifest" },
              { label: "Aseprite", value: "aseprite" },
              { label: "JSON", value: "json" },
              { label: "Godot", value: "godot" },
            ]}
            value={exportFormat}
          />
        </InspectorField>
        {message ? <p className="character-tool-message">{message}</p> : null}
        <Button className="character-export-popover-submit" disabled={isBusy} onClick={() => void handleExport()} type="button">
          {isBusy ? "导出中…" : "开始导出"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
