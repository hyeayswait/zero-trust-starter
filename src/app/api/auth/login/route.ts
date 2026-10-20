import { NextRequest, NextResponse } from "next/server";
import { getOidcClient } from "@/lib/auth/oidc";

// 发起 OIDC 授权码流程（零信任：身份由外部 IdP 背书）
export async function GET(req: NextRequest) {
  const client = await getOidcClient();
  const codeVerifier = client.randomPKCEVerifier();
  const state = client.randomState();
  const url = client.authorizationUrl({
    scope: "openid email profile",
    state,
    code_challenge: await client.codeChallenge(codeVerifier),
    code_challenge_method: "S256",
  });
  const res = NextResponse.redirect(url);
  res.cookies.set("oidc_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  res.cookies.set("oidc_verifier", codeVerifier, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  return res;
}
