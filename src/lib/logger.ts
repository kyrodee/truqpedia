type LogMeta = Record<string, unknown>;

export function logInfo(event: string, meta: LogMeta = {}) {
  writeLog("info", event, meta);
}

export function logWarn(event: string, meta: LogMeta = {}) {
  writeLog("warn", event, meta);
}

export function logError(event: string, error: unknown, meta: LogMeta = {}) {
  writeLog("error", event, {
    ...meta,
    error: serializeError(error),
  });
}

function writeLog(level: "info" | "warn" | "error", event: string, meta: LogMeta) {
  const payload = {
    level,
    event,
    time: new Date().toISOString(),
    ...meta,
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  return { message: String(error) };
}

