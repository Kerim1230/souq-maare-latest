/**
 * Enhanced server-side structured logger with request context tracking.
 * Supports AsyncLocalStorage for per-request trace ID propagation,
 * JSON output in production, colored console in development,
 * log buffering, child loggers, performance timers, and error capture.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

// ── Types ───────────────────────────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  traceId?: string;
  context?: string;
  durationMs?: number;
  [key: string]: unknown;
}

interface RequestContext {
  traceId: string;
  userId?: string;
  method?: string;
  path?: string;
  ip?: string;
  startTime: number;
  queryCount: number;
  extra: Record<string, unknown>;
}

interface BufferedEntry {
  entry: LogEntry;
  receivedAt: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
  fatal: '\x1b[35m', // magenta
};

const RESET_COLOR = '\x1b[0m';
const DIM_COLOR = '\x1b[2m';

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const isProduction = process.env.NODE_ENV === 'production';
const BUFFER_MAX = 1000;

// ── Log Buffer ──────────────────────────────────────────────────────────────

const logBuffer: BufferedEntry[] = [];

function pushToBuffer(entry: LogEntry): void {
  logBuffer.push({ entry, receivedAt: Date.now() });
  if (logBuffer.length > BUFFER_MAX) {
    logBuffer.splice(0, logBuffer.length - BUFFER_MAX);
  }
}

export function getBufferedLogs(count = 100): BufferedEntry[] {
  return logBuffer.slice(-count);
}

export function clearBuffer(): void {
  logBuffer.length = 0;
}

// ── AsyncLocalStorage ───────────────────────────────────────────────────────

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function getTraceId(): string | undefined {
  return requestContextStorage.getStore()?.traceId;
}

// ── Core Logging ────────────────────────────────────────────────────────────

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function formatColored(entry: LogEntry): string {
  const color = LOG_COLORS[entry.level];
  const dim = DIM_COLOR;
  const reset = RESET_COLOR;

  const ts = dim + entry.timestamp + reset;
  const level = color + entry.level.toUpperCase().padEnd(5) + reset;
  const trace = entry.traceId ? dim + '[' + entry.traceId + ']' + reset + ' ' : '';
  const ctx = entry.context ? dim + '[' + entry.context + ']' + reset + ' ' : '';
  const duration = entry.durationMs !== undefined ? dim + entry.durationMs + 'ms' + reset + ' ' : '';

  // Build extra fields
  const extraKeys = Object.keys(entry).filter(
    (k) => !['timestamp', 'level', 'message', 'traceId', 'context', 'durationMs'].includes(k)
  );
  const extra = extraKeys.length > 0
    ? ' ' + dim + extraKeys.map((k) => `${k}=${typeof entry[k] === 'object' ? JSON.stringify(entry[k]) : String(entry[k])}`).join(' ') + reset
    : '';

  return `${ts} ${level} ${trace}${ctx}${duration}${entry.message}${extra}`;
}

function formatEntry(entry: LogEntry): string {
  return isProduction ? formatJson(entry) : formatColored(entry);
}

function buildEntry(
  level: LogLevel,
  message: string,
  contextOrMeta?: string | Record<string, unknown>,
  meta?: Record<string, unknown>
): LogEntry {
  const ctx = getRequestContext();
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (ctx?.traceId) entry.traceId = ctx.traceId;
  if (ctx?.userId) entry.userId = ctx.userId;

  // Handle overloaded arguments: (msg, contextString, meta) or (msg, metaObject)
  if (typeof contextOrMeta === 'string') {
    entry.context = contextOrMeta;
    if (meta) Object.assign(entry, meta);
  } else if (contextOrMeta) {
    Object.assign(entry, contextOrMeta);
  }

  return entry;
}

function emit(level: LogLevel, entry: LogEntry): void {
  if (!shouldLog(level)) return;

  const formatted = formatEntry(entry);

  switch (level) {
    case 'debug':
      console.debug(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
    case 'fatal':
      console.error(formatted);
      break;
  }

  pushToBuffer(entry);
}

// ── Performance Timer ───────────────────────────────────────────────────────

export function startTimer(_label?: string): { stop: () => number } {
  const start = performance.now();

  return {
    stop(): number {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      return durationMs;
    },
  };
}

// ── Error Capture ───────────────────────────────────────────────────────────

export function captureError(
  error: unknown,
  contextOrMessage?: string,
  meta?: Record<string, unknown>
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = contextOrMessage || err.message;

  const errorMeta: Record<string, unknown> = {
    ...meta,
    errorName: err.name,
    errorMessage: err.message,
  };

  if (err.stack) {
    // Only include the first 5 stack frames in non-production for readability
    const frames = err.stack.split('\n').slice(1, 6);
    errorMeta.stack = isProduction ? frames.slice(0, 3) : frames;
  }

  emit('error', buildEntry('error', message, undefined, errorMeta));
}

// ── Child Logger ────────────────────────────────────────────────────────────

interface ChildLogger {
  debug(_message: string, _meta?: Record<string, unknown>): void;
  info(_message: string, _meta?: Record<string, unknown>): void;
  warn(_message: string, _meta?: Record<string, unknown>): void;
  error(_message: string, _meta?: Record<string, unknown>): void;
  fatal(_message: string, _meta?: Record<string, unknown>): void;
  withContext(_fields: Record<string, unknown>): ChildLogger;
  captureError(_error: unknown, _message?: string): void;
}

export function withContext(persistentFields: Record<string, unknown>): ChildLogger {
  return createChildLogger(persistentFields);
}

function createChildLogger(persistentFields: Record<string, unknown>): ChildLogger {
  function log(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>
  ): void {
    const merged = { ...persistentFields, ...meta };
    emit(level, buildEntry(level, message, undefined, merged));
  }

  return {
    debug(message: string, meta?: Record<string, unknown>) {
      log('debug', message, meta);
    },
    info(message: string, meta?: Record<string, unknown>) {
      log('info', message, meta);
    },
    warn(message: string, meta?: Record<string, unknown>) {
      log('warn', message, meta);
    },
    error(message: string, meta?: Record<string, unknown>) {
      log('error', message, meta);
    },
    fatal(message: string, meta?: Record<string, unknown>) {
      log('fatal', message, meta);
    },
    withContext(fields: Record<string, unknown>): ChildLogger {
      return createChildLogger({ ...persistentFields, ...fields });
    },
    captureError(error: unknown, message?: string) {
      captureError(error, message, persistentFields);
    },
  };
}

// ── Request Logger Factory ──────────────────────────────────────────────────

export function getRequestLogger(
  request: Request,
  overrides?: Partial<Pick<RequestContext, 'userId'>>
): ChildLogger {
  const url = new URL(request.url);
  const fields: Record<string, unknown> = {
    method: request.method,
    path: url.pathname,
  };

  if (url.search) fields.query = url.search;
  if (overrides?.userId) fields.userId = overrides.userId;

  return withContext(fields);
}

// ── Main Logger Export ──────────────────────────────────────────────────────

export const logger = {
  debug(message: string, context?: string | Record<string, unknown>, meta?: Record<string, unknown>) {
    emit('debug', buildEntry('debug', message, context, meta));
  },

  info(message: string, context?: string | Record<string, unknown>, meta?: Record<string, unknown>) {
    emit('info', buildEntry('info', message, context, meta));
  },

  warn(message: string, context?: string | Record<string, unknown>, meta?: Record<string, unknown>) {
    emit('warn', buildEntry('warn', message, context, meta));
  },

  error(message: string, context?: string | Record<string, unknown>, meta?: Record<string, unknown>) {
    emit('error', buildEntry('error', message, context, meta));
  },

  fatal(message: string, context?: string | Record<string, unknown>, meta?: Record<string, unknown>) {
    // fatal always logs
    emit('fatal', buildEntry('fatal', message, context, meta));
  },

  captureError,
  startTimer,
  withContext,
  getRequestLogger,

  /** Get current trace ID if inside a request context */
  getTraceId,
};

// ── Exports ─────────────────────────────────────────────────────────────────

export type { LogLevel, LogEntry, RequestContext, BufferedEntry, ChildLogger };
