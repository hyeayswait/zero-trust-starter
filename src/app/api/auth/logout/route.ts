import { NextRequest, NextResponse } from "next/server";
import { verifySessionFull } from "@/lib/auth/session";
import { revoke } from "@/lib/auth/revocation";
import { appendAudit } from "@/lib/audit/log";

/**
 * 退出登录。
 *
 * 关键点：仅删除 Cookie 是不够的——JWT 在到期前仍然有效，
 * 攻击者若已截获 token，仍可继续访问。零信任要求「始终验证」，
 * 因此这里把 jti 写入撤销表，让 token 立即失效。
 *
 * 同时支持 GET（页面链接）与 POST（fetch 调用）。
 */
async function clearSession(req: NextRequest) {
  const token = req.cookies.get("zt_token")?.value;

  if (token) {
    const session = await verifySessionFull(token);
    if (session) {
      const remaining = Math.max(0, session.expiresAt - Math.floor(Date.now() / 1000));
      await revoke(session.jti, remaining);
      await appendAudit({
        actor: session.user.sub,
        action: "auth.logout",
        ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown",
        ok: true,
      });
    }
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.delete("zt_token");
  // 零信任上下文也要清理，避免残留设备绑定影响下次登录
  res.cookies.delete("device_id");
  res.cookies.delete("oidc_state");
  res.cookies.delete("oidc_verifier");
  return res;
}

export async function GET(req: NextRequest) {
  return clearSession(req);
}

export async function POST(req: NextRequest) {
  return clearSession(req);
}
