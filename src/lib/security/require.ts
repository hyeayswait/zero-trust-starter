import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/security/guard";
import { rateLimit } from "@/lib/security/rateLimit";
import { hasPermission, type Permission, type SessionUser } from "@/lib/auth/types";
import { appendAudit } from "@/lib/audit/log";
import { log, traceIdOf, stopwatch } from "@/lib/obs/logger";

/**
 * 统一入口：限流 -> 鉴权 -> 权限 -> 审计 -> 业务。
 *
 * 所有受保护路由都必须走这里，避免漏调导致越权。
 * 每个请求带 traceId，日志与审计可用它串联。
 */
export async function protect(
  req: NextRequest,
  perm: Permission,
  handler: (user: SessionUser, ctx: { traceId: string }) => Promise<Response>
) {
  const traceId = traceIdOf(req.headers);
  const elapsed = stopwatch();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const action = req.nextUrl.pathname;

  // 1) 限流
  const rl = await rateLimit(`api:${ip}`, 120, 60);
  if (!rl.allowed) {
    log.warn("rate limited", { traceId, action, ip, remaining: rl.remaining });
    await appendAudit({ actor: "anonymous", action, ip, ok: false, meta: { reason: "rate_limited", traceId } });
    return NextResponse.json({ error: "too many requests", traceId }, { status: 429 });
  }

  // 2) 鉴权
  const user = await getSessionFromRequest(req);
  if (!user) {
    log.info("unauthorized", { traceId, action, ip, durationMs: elapsed() });
    await appendAudit({ actor: "anonymous", action, ip, ok: false, meta: { reason: "unauthenticated", traceId } });
    return NextResponse.json({ error: "unauthorized", traceId }, { status: 401 });
  }

  // 3) 权限
  const granted = hasPermission(user, perm);
  if (!granted) {
    log.warn("forbidden", { traceId, action, ip, actor: user.sub, need: perm, durationMs: elapsed() });
    await appendAudit({ actor: user.sub, action, ip, ok: false, meta: { reason: "forbidden", need: perm, traceId } });
    return NextResponse.json({ error: "forbidden", traceId }, { status: 403 });
  }

  // 4) 业务 + 成功审计
  try {
    const res = await handler(user, { traceId });
    const durationMs = elapsed();
    log.info("ok", { traceId, action, ip, actor: user.sub, durationMs });
    await appendAudit({ actor: user.sub, action, ip, ok: true, meta: { traceId, durationMs } });
    res.headers.set("x-request-id", traceId);
    return res;
  } catch (err) {
    const durationMs = elapsed();
    log.error("handler failed", {
      traceId, action, ip, actor: user.sub, durationMs,
      error: (err as Error).message,
    });
    await appendAudit({ actor: user.sub, action, ip, ok: false, meta: { reason: "exception", traceId } });
    return NextResponse.json({ error: "internal error", traceId }, { status: 500 });
  }
}
