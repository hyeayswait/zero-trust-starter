import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/security/guard";
import { rateLimit } from "@/lib/security/rateLimit";
import { hasPermission, type Permission } from "@/lib/auth/types";
import { appendAudit } from "@/lib/audit/log";

// 统一入口：限流 + 鉴权 + 权限 + 审计
export async function protect(
  req: NextRequest,
  perm: Permission,
  handler: (user: Awaited<ReturnType<typeof getSessionFromRequest>>) => Promise<Response>
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const rl = await rateLimit(`api:${ip}`, 120, 60);
  if (!rl.allowed) return NextResponse.json({ error: "too many requests" }, { status: 429 });

  const user = await getSessionFromRequest(req);
  const ok = !!user && hasPermission(user, perm);
  await appendAudit({ actor: user?.sub ?? "anonymous", action: req.nextUrl.pathname, ip, ok });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return handler(user);
}
