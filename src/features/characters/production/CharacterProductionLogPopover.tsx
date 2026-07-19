import { TerminalSquare } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCharacterProductionLogStore,
  type CharacterProductionLogEntry,
} from "@/stores/characterProductionLogStore";

import "./CharacterProductionLogPanel.css";

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function filterEntries(entries: CharacterProductionLogEntry[], tab: string) {
  if (tab === "qc") {
    return entries.filter((entry) => entry.level === "qc");
  }
  if (tab === "errors") {
    return entries.filter((entry) => entry.level === "error");
  }
  return entries;
}

export function CharacterProductionLogPopover() {
  const entries = useCharacterProductionLogStore((state) => state.entries);
  const errorCount = entries.filter((entry) => entry.level === "error").length;
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          <TerminalSquare aria-hidden="true" size={15} />
          产线日志
          {errorCount > 0 ? <span className="character-production-log-trigger-badge">{errorCount}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="character-production-log-popover" side="bottom">
        <header className="character-production-log-popover-header">
          <strong>产线日志</strong>
          <span>步骤、QC 与错误记录</span>
        </header>
        <Tabs className="character-production-log-tabs" defaultValue="steps">
          <TabsList variant="line">
            <TabsTrigger value="steps">步骤</TabsTrigger>
            <TabsTrigger value="qc">QC</TabsTrigger>
            <TabsTrigger className="character-production-log-tab-danger" value="errors">
              错误 {errorCount > 0 ? errorCount : ""}
            </TabsTrigger>
          </TabsList>
          {(["steps", "qc", "errors"] as const).map((tab) => (
            <TabsContent className="character-production-log-content" key={tab} value={tab}>
              <ul className="character-production-log-list">
                {filterEntries(entries, tab).length === 0 ? (
                  <li className="character-production-log-empty">暂无记录</li>
                ) : (
                  filterEntries(entries, tab).map((entry) => (
                    <li className="character-production-log-item" data-level={entry.level} key={entry.id}>
                      <time>{formatTime(entry.timestamp)}</time>
                      {entry.phase ? <span className="character-production-log-phase">[{entry.phase}]</span> : null}
                      <span>{entry.message}</span>
                    </li>
                  ))
                )}
              </ul>
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
