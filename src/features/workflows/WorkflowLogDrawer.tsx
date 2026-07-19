import { AlertTriangle, History, TerminalSquare } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { getWorkflowNodeDefinition } from "./nodeCatalog";
import type { WorkflowRun, WorkflowRunLog } from "./types";
import { getWorkflowRunStatusLabel } from "./workflowLabels";

interface WorkflowLogDrawerProps {
  errorCount: number;
  onFocusNode?: (nodeId: string) => void;
  onSelectRun: (run: WorkflowRun) => void;
  run?: WorkflowRun;
  runs: WorkflowRun[];
  selectedRunId?: string;
}

export function WorkflowLogDrawer({ errorCount, onFocusNode, onSelectRun, run, runs, selectedRunId }: WorkflowLogDrawerProps) {
  const logs = flattenLogs(run);
  const errors = run?.nodeRuns.filter((nodeRun) => nodeRun.error) ?? [];

  return (
    <section className="workflow-log-drawer">
      <header className="workflow-log-drawer-header">
        <div>
          <TerminalSquare aria-hidden="true" />
          <strong className="workflow-type-section">运行日志</strong>
          <span className="workflow-type-caption">{run ? `${run.workflowName} · ${getWorkflowRunStatusLabel(run.status)}` : "暂无运行记录"}</span>
        </div>
      </header>

      <Tabs className="workflow-log-tabs" defaultValue="logs">
        <TabsList className="workflow-tabs-list" variant="line">
          <TabsTrigger className="workflow-tab-trigger" value="history">
            <History aria-hidden="true" />
            运行历史
          </TabsTrigger>
          <TabsTrigger className="workflow-tab-trigger" value="logs">
            运行日志
          </TabsTrigger>
          <TabsTrigger className="workflow-tab-trigger" value="outputs">
            节点输出
          </TabsTrigger>
          <TabsTrigger className="workflow-tab-trigger workflow-tab-trigger-danger" value="errors">
            错误 {errorCount > 0 ? errorCount : ""}
          </TabsTrigger>
          <TabsTrigger className="workflow-tab-trigger" value="performance">
            性能
          </TabsTrigger>
        </TabsList>

        <TabsContent className="workflow-log-content" value="history">
          {runs.length ? (
            <div className="workflow-log-table">
              <div className="workflow-log-data-header">
                <span>时间</span>
                <span>状态</span>
                <span>摘要</span>
              </div>
              {runs.map((historyRun) => (
                <button
                  className="workflow-log-history-row"
                  data-selected={historyRun.id === selectedRunId}
                  key={historyRun.id}
                  onClick={() => onSelectRun(historyRun)}
                  type="button"
                >
                  <span className="workflow-type-caption">{formatRunTime(historyRun.startedAt)}</span>
                  <strong className="workflow-type-section" data-status={historyRun.status}>
                    {getWorkflowRunStatusLabel(historyRun.status)}
                  </strong>
                  <span className="workflow-type-body">{historyRun.error || summarizeRun(historyRun)}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyLog text="当前工作流还没有运行历史。" />
          )}
        </TabsContent>

        <TabsContent className="workflow-log-content" value="logs">
          {logs.length ? (
            <div className="workflow-log-table">
              <div className="workflow-log-table-header">
                <span>时间</span>
                <span>事件</span>
                <span>消息</span>
              </div>
              {logs.map((log) => (
                <LogLine key={`${log.nodeId}-${log.timestamp}-${log.event}-${log.message}`} log={log} onFocusNode={onFocusNode} />
              ))}
            </div>
          ) : (
            <EmptyLog />
          )}
        </TabsContent>

        <TabsContent className="workflow-log-content" value="outputs">
          {run?.nodeRuns.some((nodeRun) => nodeRun.outputSummary) ? (
            <div className="workflow-log-table">
              <div className="workflow-log-data-header">
                <span>节点</span>
                <span>输出摘要</span>
              </div>
              {run.nodeRuns.map((nodeRun) => (
                <div className="workflow-log-data-row" key={nodeRun.nodeId}>
                  <span className="workflow-type-section">{getWorkflowNodeDefinition(nodeRun.nodeKind)?.label ?? nodeRun.nodeKind}</span>
                  <strong className="workflow-type-body">{nodeRun.outputSummary || "无输出摘要"}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyLog />
          )}
        </TabsContent>

        <TabsContent className="workflow-log-content" value="errors">
          {errors.length ? (
            <div className="workflow-log-table">
              <div className="workflow-log-error-header">
                <span aria-hidden="true" />
                <span>节点</span>
                <span>错误信息</span>
              </div>
              {errors.map((nodeRun) => (
                <button
                  className="workflow-log-error-row"
                  key={nodeRun.nodeId}
                  onClick={() => onFocusNode?.(nodeRun.nodeId)}
                  type="button"
                >
                  <AlertTriangle aria-hidden="true" />
                  <span className="workflow-type-section">{getWorkflowNodeDefinition(nodeRun.nodeKind)?.label ?? nodeRun.nodeKind}</span>
                  <strong className="workflow-type-body">{nodeRun.error}</strong>
                </button>
              ))}
            </div>
          ) : (
            <EmptyLog text="暂无错误。" />
          )}
        </TabsContent>

        <TabsContent className="workflow-log-content" value="performance">
          {run?.nodeRuns.length ? (
            <div className="workflow-log-table">
              <div className="workflow-log-data-header">
                <span>节点</span>
                <span>耗时</span>
              </div>
              {run.nodeRuns.map((nodeRun) => (
                <div className="workflow-log-data-row" key={nodeRun.nodeId}>
                  <span className="workflow-type-section">{getWorkflowNodeDefinition(nodeRun.nodeKind)?.label ?? nodeRun.nodeKind}</span>
                  <strong className="workflow-type-body">
                    {formatDuration(nodeRun.durationMs)} · {nodeRun.cacheHit ? "缓存命中" : "本次执行"}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyLog />
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function LogLine({ log, onFocusNode }: { log: WorkflowRunLog; onFocusNode?: (nodeId: string) => void }) {
  const canFocus = Boolean(log.nodeId && onFocusNode && (log.level === "error" || log.level === "warn"));

  if (!canFocus) {
    return (
      <div className="workflow-log-row" data-level={log.level}>
        <span className="workflow-type-caption">{formatTime(log.timestamp)}</span>
        <strong className="workflow-type-section">{log.event}</strong>
        <span className="workflow-type-body">{log.message}</span>
      </div>
    );
  }

  return (
    <button className="workflow-log-row workflow-log-row-action" data-level={log.level} onClick={() => onFocusNode?.(log.nodeId!)} type="button">
      <span className="workflow-type-caption">{formatTime(log.timestamp)}</span>
      <strong className="workflow-type-section">{log.event}</strong>
      <span className="workflow-type-body">{log.message}</span>
    </button>
  );
}

function EmptyLog({ text = "运行后会在这里显示节点事件。" }: { text?: string }) {
  return <p className="workflow-type-body workflow-muted">{text}</p>;
}

function flattenLogs(run: WorkflowRun | undefined) {
  return (run?.nodeRuns.flatMap((nodeRun) => nodeRun.logs ?? []) ?? []).sort((left, right) => left.timestamp - right.timestamp);
}

function formatDuration(durationMs: number | undefined) {
  if (durationMs === undefined) {
    return "未记录耗时";
  }

  return `${durationMs} ms`;
}

function formatRunTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString("zh-CN", { hour12: false });
}

function formatTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleTimeString("zh-CN", { hour12: false });
}

function summarizeRun(run: WorkflowRun) {
  const failedCount = run.nodeRuns.filter((nodeRun) => nodeRun.status === "failed" || nodeRun.error).length;
  const succeededCount = run.nodeRuns.filter((nodeRun) => nodeRun.status === "succeeded").length;

  return `${succeededCount} 个节点成功${failedCount ? `，${failedCount} 个失败` : ""}`;
}
