import { save } from "@tauri-apps/plugin-dialog";
import {
  Copy,
  Download,
  FolderOpen,
  RefreshCw,
  ScrollText,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  SettingsCheckboxRow,
  SettingsField,
  SettingsSelect,
} from "../components/SettingsControls";
import { SettingsCardGrid } from "../components/SettingsPanelPrimitives";
import { SettingsSectionCard } from "../components/SettingsSectionCard";
import {
  exportLogEntries,
  getLogDirectory,
  getLogSettings,
  listLogFiles,
  openLogDirectory,
  queryLogEntries,
  setLogSettings,
  type LogEntry,
  type LogQueryInput,
  type LogSettings,
} from "@/lib/tauri/diagnostics";

const LOG_LEVEL_OPTIONS = [
  { label: "Error", value: "error" },
  { label: "Warn", value: "warn" },
  { label: "Info", value: "info" },
  { label: "Debug", value: "debug" },
] as const;

const TARGET_PREFIX_OPTIONS = [
  { label: "全部模块", value: "" },
  { label: "Tauri 命令", value: "jmtools::commands" },
  { label: "本地生图", value: "jmtools::local_inference" },
  { label: "工作流", value: "jmtools::workflow" },
  { label: "角色管线", value: "jmtools::character" },
  { label: "前端桥接", value: "jmtools::frontend" },
] as const;

const TIME_RANGE_OPTIONS = [
  { label: "全部", value: "all" },
  { label: "今天", value: "today" },
  { label: "最近 1 小时", value: "1h" },
] as const;

const FILTER_LEVELS = ["ERROR", "WARN", "INFO", "DEBUG"] as const;

type TimeRange = (typeof TIME_RANGE_OPTIONS)[number]["value"];

function buildSinceIso(range: TimeRange): string | undefined {
  if (range === "all") {
    return undefined;
  }

  const now = new Date();
  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }

  return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
}

function formatTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function levelBadgeVariant(level: string): "default" | "destructive" | "outline" | "secondary" {
  const normalized = level.toUpperCase();
  if (normalized === "ERROR") {
    return "destructive";
  }
  if (normalized === "WARN") {
    return "secondary";
  }
  if (normalized === "DEBUG") {
    return "outline";
  }
  return "default";
}

export function DiagnosticsSettingsPanel() {
  const [logSettings, setLogSettingsState] = useState<LogSettings>({
    logLevel: "info",
    logRedactPrompts: true,
  });
  const [logDirectory, setLogDirectory] = useState("");
  const [logFileSummary, setLogFileSummary] = useState("");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [totalMatched, setTotalMatched] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [autoTail, setAutoTail] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [filterLevels, setFilterLevels] = useState<string[]>(["ERROR", "WARN", "INFO"]);
  const [targetPrefix, setTargetPrefix] = useState("");
  const [taskId, setTaskId] = useState("");
  const [runId, setRunId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  const queryInput = useMemo<LogQueryInput>(() => {
    const input: LogQueryInput = {
      keyword: keyword.trim() || undefined,
      levels: filterLevels.length > 0 ? filterLevels.map((level) => level.toLowerCase()) : undefined,
      limit: 500,
      offset: 0,
      runId: runId.trim() || undefined,
      since: buildSinceIso(timeRange),
      targetPrefix: targetPrefix.trim() || undefined,
      taskId: taskId.trim() || undefined,
    };
    return input;
  }, [filterLevels, keyword, runId, targetPrefix, taskId, timeRange]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entryKey(entry) === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  );

  const loadEntries = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsRefreshing(true);
      }
      setError("");

      try {
        const result = await queryLogEntries(queryInput);
        setEntries(result.entries);
        setTotalMatched(result.totalMatched);
        setHasMore(result.hasMore);

        if (result.entries.length === 0) {
          setSelectedEntryId(null);
        } else if (!selectedEntryId || !result.entries.some((entry) => entryKey(entry) === selectedEntryId)) {
          setSelectedEntryId(entryKey(result.entries[0]));
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        setIsRefreshing(false);
      }
    },
    [queryInput, selectedEntryId],
  );

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      setIsLoading(true);
      setError("");

      try {
        const [settings, directory, files] = await Promise.all([
          getLogSettings(),
          getLogDirectory(),
          listLogFiles(),
        ]);

        if (!isMounted) {
          return;
        }

        setLogSettingsState(settings);
        setLogDirectory(directory);
        setLogFileSummary(
          files.length > 0
            ? files.map((file) => `${file.name} (${formatBytes(file.sizeBytes)})`).join(" · ")
            : "暂无日志文件",
        );
      } catch (bootstrapError) {
        if (isMounted) {
          setError(bootstrapError instanceof Error ? bootstrapError.message : String(bootstrapError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    void loadEntries();
  }, [isLoading, loadEntries]);

  useEffect(() => {
    if (!autoTail) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadEntries({ silent: true });
    }, 2000);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoTail, loadEntries]);

  async function handleSaveLogSettings() {
    setIsSavingSettings(true);
    setError("");
    setMessage("");

    try {
      const saved = await setLogSettings(logSettings);
      setLogSettingsState(saved);
      setMessage("日志级别设置已保存并立即生效。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleExport() {
    setError("");
    setMessage("");

    const outputPath = await save({
      defaultPath: `jmtools-logs-${new Date().toISOString().slice(0, 10)}.jsonl`,
      filters: [{ extensions: ["jsonl", "json"], name: "日志导出" }],
      title: "导出筛选后的日志",
    });

    if (!outputPath) {
      return;
    }

    try {
      const count = await exportLogEntries(outputPath, queryInput);
      setMessage(`已导出 ${count} 条日志到 ${outputPath}`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : String(exportError));
    }
  }

  async function handleOpenDirectory() {
    setError("");
    try {
      await openLogDirectory();
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError));
    }
  }

  async function handleCopyDetail() {
    if (!selectedEntry) {
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(selectedEntry.raw, null, 2));
    setMessage("已复制选中日志详情。");
  }

  function toggleFilterLevel(level: string) {
    setFilterLevels((current) =>
      current.includes(level) ? current.filter((item) => item !== level) : [...current, level],
    );
  }

  if (isLoading) {
    return <div className="settings-empty-state">正在加载诊断与日志…</div>;
  }

  return (
    <div className="diagnostics-settings-shell">
      <SettingsCardGrid>
        <SettingsSectionCard
          description="调整 tracing 输出级别与 Prompt 脱敏策略，保存后立即生效。"
          icon={ScrollText}
          title="日志级别"
        >
          <SettingsSelect
            label="最低输出级别"
            onChange={(logLevel) => setLogSettingsState((current) => ({ ...current, logLevel }))}
            options={LOG_LEVEL_OPTIONS}
            value={logSettings.logLevel}
          />
          <SettingsCheckboxRow
            checked={logSettings.logRedactPrompts}
            description="Debug 级别下仍可在详情侧栏查看摘要字段。"
            label="脱敏 Prompt 与 API Key"
            onChange={(logRedactPrompts) => setLogSettingsState((current) => ({ ...current, logRedactPrompts }))}
          />
          <div className="diagnostics-inline-actions">
            <Button disabled={isSavingSettings} onClick={() => void handleSaveLogSettings()} size="sm" type="button">
              {isSavingSettings ? "保存中…" : "保存日志设置"}
            </Button>
            <span className="diagnostics-path-hint">{logDirectory || "日志目录未知"}</span>
          </div>
          <p className="diagnostics-file-summary">{logFileSummary}</p>
        </SettingsSectionCard>
      </SettingsCardGrid>

      <section className="diagnostics-viewer-panel">
        <header className="diagnostics-toolbar">
          <div className="diagnostics-toolbar-row">
            <div className="diagnostics-level-filters">
              {FILTER_LEVELS.map((level) => (
                <Button
                  data-active={filterLevels.includes(level)}
                  key={level}
                  onClick={() => toggleFilterLevel(level)}
                  size="sm"
                  type="button"
                  variant={filterLevels.includes(level) ? "default" : "outline"}
                >
                  {level}
                </Button>
              ))}
            </div>
            <SettingsSelect
              label="模块"
              onChange={setTargetPrefix}
              options={TARGET_PREFIX_OPTIONS}
              value={targetPrefix}
            />
            <SettingsSelect
              label="时间范围"
              onChange={(value) => setTimeRange(value as TimeRange)}
              options={TIME_RANGE_OPTIONS}
              value={timeRange}
            />
          </div>

          <div className="diagnostics-toolbar-row">
            <SettingsField label="task_id">
              <Input onChange={(event) => setTaskId(event.target.value)} placeholder="例如 workflow-candidates-…" value={taskId} />
            </SettingsField>
            <SettingsField label="run_id">
              <Input onChange={(event) => setRunId(event.target.value)} placeholder="例如 run-…" value={runId} />
            </SettingsField>
            <SettingsField label="关键词">
              <div className="diagnostics-search-field">
                <Search aria-hidden="true" />
                <Input onChange={(event) => setKeyword(event.target.value)} placeholder="消息或字段内容" value={keyword} />
              </div>
            </SettingsField>
          </div>

          <div className="diagnostics-toolbar-actions">
            <Button disabled={isRefreshing} onClick={() => void loadEntries()} size="sm" type="button" variant="outline">
              <RefreshCw className={isRefreshing ? "diagnostics-spin" : undefined} />
              刷新
            </Button>
            <Button
              data-active={autoTail}
              onClick={() => setAutoTail((current) => !current)}
              size="sm"
              type="button"
              variant={autoTail ? "default" : "outline"}
            >
              自动 Tail（2s）
            </Button>
            <Button onClick={() => void handleExport()} size="sm" type="button" variant="outline">
              <Download />
              导出筛选结果
            </Button>
            <Button onClick={() => void handleOpenDirectory()} size="sm" type="button" variant="outline">
              <FolderOpen />
              打开日志目录
            </Button>
          </div>

          {(error || message) && (
            <p className="diagnostics-status" data-error={error ? "true" : "false"}>
              {error || message}
            </p>
          )}
        </header>

        <div className="diagnostics-viewer-body">
          <div className="diagnostics-log-table-wrap">
            <table className="diagnostics-log-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>级别</th>
                  <th>模块</th>
                  <th>消息</th>
                  <th>task_id</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td className="diagnostics-empty-cell" colSpan={5}>
                      当前筛选条件下没有日志条目。
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const key = entryKey(entry);
                    const isSelected = key === selectedEntryId;

                    return (
                      <tr
                        data-selected={isSelected ? "true" : "false"}
                        key={key}
                        onClick={() => setSelectedEntryId(key)}
                      >
                        <td>{formatTimestamp(entry.timestamp)}</td>
                        <td>
                          <Badge variant={levelBadgeVariant(entry.level)}>{entry.level.toUpperCase()}</Badge>
                        </td>
                        <td>{shortTarget(entry.target)}</td>
                        <td>{entry.message}</td>
                        <td>{entry.taskId || "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <footer className="diagnostics-table-footer">
              <span>
                匹配 {totalMatched} 条{hasMore ? "（已截断显示前 500 条）" : ""}
              </span>
            </footer>
          </div>

          <aside className="diagnostics-detail-panel">
            <header>
              <strong>详情</strong>
              <Button disabled={!selectedEntry} onClick={() => void handleCopyDetail()} size="sm" type="button" variant="outline">
                <Copy />
                复制 JSON
              </Button>
            </header>
            {selectedEntry ? (
              <Textarea
                className="diagnostics-detail-textarea"
                readOnly
                rows={24}
                value={JSON.stringify(selectedEntry.raw, null, 2)}
              />
            ) : (
              <div className="diagnostics-detail-empty">选择一行日志查看完整 fields。</div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

function entryKey(entry: LogEntry) {
  return `${entry.timestamp}|${entry.level}|${entry.message}|${entry.taskId}|${entry.runId}`;
}

function shortTarget(target: string) {
  return target.replace(/^jmtools::/, "");
}

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
