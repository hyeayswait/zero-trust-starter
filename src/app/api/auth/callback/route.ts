import { NextRequest, NextResponse } from "next/server";
import { getOidcClient } from "@/lib/auth/oidc";
import { signSession } from "@/lib/auth/session";
import { appendAudit } from "@/lib/audit/log";
import { normalizeRoles } from "@/lib/auth/types";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const client = await getOidcClient();
  const tokens = await client.callback(
    process.env.OIDC_REDIRECT_URI!,
    Object.fromEntries(params),
    {
      state: req.cookies.get("oidc_state")?.value,
      code_verifier: req.cookies.get("oidc_verifier")?.value,
    }
  );
  const claims = tokens.claims() as Record<string, unknown>;
  const deviceId = req.cookies.get("device_id")?.value ?? crypto.randomUUID();

  const user = {
    sub: String(claims.sub),
    email: String(claims.email ?? ""),
    name: String(claims.name ?? claims.email ?? "user"),
    // 角色来自 IdP（Keycloak 走 realm_access.roles；通用 OIDC 走 roles 声明）。
    // 缺失时按最小权限原则降级为 member，绝不默认提权。
    roles: normalizeRoles(claims),
    deviceId,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown",
  };
  const token = await signSession(user);
  await appendAudit({ actor: user.sub, action: "auth.login", ip: user.ip, ok: true });

  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set("zt_token", token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 15,
  });
  return res;
}
