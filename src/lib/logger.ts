import { invoke } from "@tauri-apps/api/core";

let isConsoleAttached = false;

export type LogLevel = "debug" | "error" | "info" | "warn";

export type LogFields = {
  command?: string;
  errorCode?: string;
  nodeId?: string;
  profileId?: string;
  runId?: string;
  scope?: string;
  taskId?: string;
  workflowId?: string;
  [key: string]: unknown;
};

export async function initializeLogger() {
  if (isConsoleAttached) {
    return;
  }

  try {
    isConsoleAttached = true;
    await appLogger.info("JMTools 前端日志已初始化。", { scope: "logger.init" });
  } catch (caughtError) {
    console.warn("JMTools 日志插件初始化失败，当前可能不是 Tauri 运行环境。", caughtError);
  }
}

function normalizeLogInput(message: string, fields?: LogFields) {
  return {
    fields: fields ? sanitizeFields(fields) : undefined,
    message,
  };
}

function sanitizeFields(fields: LogFields): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    next[key] = value;
  }
  return next;
}

async function writeAppLog(level: LogLevel, message: string, fields?: LogFields) {
  const payload = normalizeLogInput(message, fields);

  try {
    await invoke("write_app_log", {
      fields: payload.fields,
      level,
      message: payload.message,
    });
  } catch (caughtError) {
    const consoleMessage = `[${level}] ${payload.message}`;
    const detail = payload.fields ? ` ${JSON.stringify(payload.fields)}` : "";

    if (level === "error") {
      console.error(`${consoleMessage}${detail}`, caughtError);
      return;
    }

    if (level === "warn") {
      console.warn(`${consoleMessage}${detail}`, caughtError);
      return;
    }

    if (level === "debug") {
      console.debug(`${consoleMessage}${detail}`, caughtError);
      return;
    }

    console.info(`${consoleMessage}${detail}`, caughtError);
  }
}

export const appLogger = {
  debug(message: string, fields?: LogFields) {
    return writeAppLog("debug", message, fields);
  },
  error(message: string, fields?: LogFields) {
    return writeAppLog("error", message, fields);
  },
  info(message: string, fields?: LogFields) {
    return writeAppLog("info", message, fields);
  },
  warn(message: string, fields?: LogFields) {
    return writeAppLog("warn", message, fields);
  },
};

export type { LogFields as AppLogFields };
