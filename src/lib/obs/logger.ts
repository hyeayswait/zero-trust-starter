/**
 * 结构化日志 + 请求追踪。
 *
 * 生产排障的关键：一次请求的所有日志必须能串起来。
 * 给每个请求分配 traceId（优先复用上游网关传来的
 * x-request-id / traceparent），日志统一输出单行 JSON，
 * 便于 ELK / Loki / CloudWatch 直接索引。
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = LEVELS[(process.env.LOG_LEVEL as LogLevel) ?? "info"] ?? 20;

export interface LogFields {
  traceId?: string;
  actor?: string;
  action?: string;
  ip?: string;
  ok?: boolean;
  durationMs?: number;
  [key: string]: unknown;
}

function emit(level: LogLevel, msg: string, fields: LogFields = {}) {
  if (LEVELS[level] < MIN) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, f?: LogFields) => emit("debug", msg, f),
  info: (msg: string, f?: LogFields) => emit("info", msg, f),
  warn: (msg: string, f?: LogFields) => emit("warn", msg, f),
  error: (msg: string, f?: LogFields) => emit("error", msg, f),
};

/** 从请求头取 traceId，没有则生成 */
export function traceIdOf(headers: Headers): string {
  const upstream =
    headers.get("x-request-id") ??
    headers.get("x-correlation-id") ??
    headers.get("traceparent")?.split("-")[1];
  return upstream && upstream.length >= 8 ? upstream : crypto.randomUUID();
}

/** 计时器 */
export function stopwatch() {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}
