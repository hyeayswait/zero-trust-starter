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

  // Secure Cookie 只在 HTTPS 下才会被浏览器保存。
  // 本地开发/演示走 http://127.0.0.1，若强制 secure:true，浏览器会丢弃
  // Set-Cookie，导致「登录成功但所有 API 都 401」。
  const secureCookie =
    process.env.NODE_ENV === "production" && !process.env.DEMO_MODE;

  res.cookies.set("zt_token", token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });

  // 把设备 ID 落到 Cookie，后续请求用它做零信任上下文校验；
  // 不写回的话每次请求 device_id 都缺失，设备绑定形同虚设。
  res.cookies.set("device_id", deviceId, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });

  // OIDC 临时 Cookie 用完即删
  res.cookies.delete("oidc_state");
  res.cookies.delete("oidc_verifier");

  return res;
}
