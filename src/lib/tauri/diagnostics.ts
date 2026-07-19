import { invoke } from "@tauri-apps/api/core";

import type { LogFields } from "@/lib/logger";
import { appLogger } from "@/lib/logger";

export interface LogSettings {
  logLevel: "debug" | "error" | "info" | "trace" | "warn";
  logRedactPrompts: boolean;
}

export interface LogFileInfo {
  kind: "jsonl" | "text" | string;
  name: string;
  path: string;
  sizeBytes: number;
}

export interface LogEntry {
  command: string;
  fields: Record<string, unknown>;
  level: string;
  message: string;
  raw: Record<string, unknown>;
  runId: string;
  scope: string;
  target: string;
  taskId: string;
  timestamp: string;
}

export interface LogQueryInput {
  keyword?: string;
  levels?: string[];
  limit?: number;
  offset?: number;
  runId?: string;
  since?: string;
  targetPrefix?: string;
  taskId?: string;
  until?: string;
}

export interface LogQueryResult {
  entries: LogEntry[];
  hasMore: boolean;
  totalMatched: number;
}

export function getLogSettings() {
  return invoke<LogSettings>("get_log_settings");
}

export function setLogSettings(settings: LogSettings) {
  return invoke<LogSettings>("set_log_settings", { settings });
}

export function getLogDirectory() {
  return invoke<string>("get_log_directory");
}

export function listLogFiles() {
  return invoke<LogFileInfo[]>("list_log_files_command");
}

export function queryLogEntries(query: LogQueryInput) {
  return invoke<LogQueryResult>("query_log_entries_command", { query });
}

export function exportLogEntries(outputPath: string, query: LogQueryInput) {
  return invoke<number>("export_log_entries_command", {
    input: { outputPath, query },
  });
}

export function openLogDirectory() {
  return invoke<void>("open_log_directory");
}

interface InvokeLogMeta extends LogFields {
  command: string;
}

export async function invokeWithLog<T>(
  command: string,
  args?: Record<string, unknown>,
  meta?: Omit<InvokeLogMeta, "command">,
): Promise<T> {
  const startedAt = performance.now();
  const fields: InvokeLogMeta = {
    command,
    ...meta,
  };

  await appLogger.debug(`调用命令：${command}`, fields);

  try {
    const result = await invoke<T>(command, args);
    await appLogger.info(`命令完成：${command}`, {
      ...fields,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return result;
  } catch (error) {
    await appLogger.error(`命令失败：${command}`, {
      ...fields,
      durationMs: Math.round(performance.now() - startedAt),
      errorCode: "invoke_failed",
    });
    throw error;
  }
}
