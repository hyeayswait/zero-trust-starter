import { NextRequest, NextResponse } from "next/server";
import { generators } from "openid-client";
import { getOidcClient } from "@/lib/auth/oidc";

// 发起 OIDC 授权码流程（零信任：身份由外部 IdP 背书）
// 注意：openid-client v5 的 PKCE/state 生成器在 generators 上，
// 不是 v6 的 client.randomPKCEVerifier()。用错版本会导致登录直接 500。
export async function GET(req: NextRequest) {
  const client = await getOidcClient();

  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  const state = generators.state();

  const url = client.authorizationUrl({
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const res = NextResponse.redirect(url);
  // secure:true 在 http://127.0.0.1 的本地演示下浏览器会丢弃 Cookie，
  // 因此仅在生产（https）时开启。
  const secure = process.env.NODE_ENV === "production" && !process.env.DEMO_MODE;
  res.cookies.set("oidc_state", state, { httpOnly: true, secure, sameSite: "lax", path: "/" });
  res.cookies.set("oidc_verifier", codeVerifier, { httpOnly: true, secure, sameSite: "lax", path: "/" });
  return res;
}
