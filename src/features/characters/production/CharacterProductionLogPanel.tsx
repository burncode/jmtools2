import { ChevronDown, ChevronUp, TerminalSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
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

export function CharacterProductionLogPanel() {
  const entries = useCharacterProductionLogStore((state) => state.entries);
  const isExpanded = useCharacterProductionLogStore((state) => state.isExpanded);
  const setExpanded = useCharacterProductionLogStore((state) => state.setExpanded);
  const errorCount = entries.filter((entry) => entry.level === "error").length;

  if (!isExpanded) {
    return (
      <button
        className="character-production-log-rail"
        onClick={() => setExpanded(true)}
        type="button"
      >
        <TerminalSquare aria-hidden="true" size={16} />
        <span>产线日志</span>
        {errorCount > 0 ? <span className="character-production-log-rail-badge">{errorCount}</span> : null}
        <ChevronUp aria-hidden="true" size={14} />
      </button>
    );
  }

  return (
    <section aria-label="产线日志" className="character-production-log-panel">
      <header className="character-production-log-header">
        <div>
          <TerminalSquare aria-hidden="true" size={16} />
          <strong>产线日志</strong>
        </div>
        <Button onClick={() => setExpanded(false)} size="sm" type="button" variant="ghost">
          <ChevronDown aria-hidden="true" />
          收起
        </Button>
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
    </section>
  );
}
