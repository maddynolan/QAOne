/**
 * Traceable logger for frontend/desktop.
 * Use for issue tracking: session_id and trace_id can be reported to support and correlated with backend logs.
 * Replace noisy console.log in critical paths (license, API, recording, playback) with this logger.
 */

const SESSION_KEY = 'flowstral_session_id';
const TRACE_ID_HEADER = 'X-Trace-ID';

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

let sessionId: string | null = null;

export function getSessionId(): string {
  if (sessionId) return sessionId;
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    sessionId = storage?.getItem(SESSION_KEY) || genId();
    storage?.setItem(SESSION_KEY, sessionId);
  } catch {
    sessionId = genId();
  }
  return sessionId;
}

export function createTraceId(): string {
  return genId();
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatMessage(level: LogLevel, traceId: string | undefined, msg: string, data?: unknown): string {
  const sid = getSessionId();
  const tid = traceId || '-';
  const prefix = `[${sid}] [${tid}] ${level.toUpperCase()}`;
  if (data !== undefined) {
    try {
      const extra = typeof data === 'object' && data !== null ? JSON.stringify(data) : String(data);
      return `${prefix} ${msg} ${extra}`;
    } catch {
      return `${prefix} ${msg}`;
    }
  }
  return `${prefix} ${msg}`;
}

/** Use when calling backend so server can correlate with its trace_id */
export function getTraceIdHeader(): Record<string, string> {
  return { [TRACE_ID_HEADER]: createTraceId() };
}

/** Attach to fetch/axios so backend receives the same trace_id */
export function withTraceId(headers: HeadersInit = {}): HeadersInit {
  const h = typeof headers === 'object' && headers !== null && !Array.isArray(headers)
    ? { ...headers as Record<string, string> }
    : {};
  h[TRACE_ID_HEADER] = createTraceId();
  return h;
}

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

const log = {
  debug(msg: string, data?: unknown, traceId?: string): void {
    if (!isDev) return;
    const out = formatMessage('debug', traceId, msg, data);
    console.debug(out);
  },
  info(msg: string, data?: unknown, traceId?: string): void {
    const out = formatMessage('info', traceId, msg, data);
    console.info(out);
  },
  warn(msg: string, data?: unknown, traceId?: string): void {
    const out = formatMessage('warn', traceId, msg, data);
    console.warn(out);
  },
  error(msg: string, data?: unknown, traceId?: string): void {
    const out = formatMessage('error', traceId, msg, data);
    console.error(out);
  },
};

export default log;
