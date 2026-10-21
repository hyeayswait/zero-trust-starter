// scripts/mock-idp.mjs —— 本地最小 OIDC Provider，用于本地开发与界面演示。
//
// 实现 openid-client 需要的四件事：
//   1. /.well-known/openid-configuration  发现文档
//   2. /authorize                          授权码端点（自动通过，角色可配置）
//   3. /token                              令牌端点（返回真 JWT，RS256 签名）
//   4. /jwks                               JWKS（供 id_token 验签）
//
// 用法：
//   node scripts/mock-idp.mjs --port 8080 --user demo --roles admin,member
//   再把 OIDC_ISSUER 指向 http://127.0.0.1:8080/.well-known/openid-configuration
//
// 用于本地开发。生产请用真实 IdP（Keycloak / Auth0 / Entra ID 等）。
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const PORT = Number(arg("port", "8080"));
const ISSUER = arg("issuer", "http://127.0.0.1:" + PORT);
const CLIENT_ID = arg("client-id", "zt-starter");
const USER = arg("user", "demo");
const ROLES = arg("roles", "admin,member").split(",").map((r) => r.trim()).filter(Boolean);
const EMAIL = arg("email", "demo@zerotrust.local");
const NAME = arg("name", "Demo User");

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "mock-idp-key", use: "sig", alg: "RS256" };

const codes = new Map();
const tokens = new Set();

const discovery = {
  issuer: ISSUER,
  authorization_endpoint: ISSUER + "/authorize",
  token_endpoint: ISSUER + "/token",
  jwks_uri: ISSUER + "/jwks",
  userinfo_endpoint: ISSUER + "/userinfo",
  end_session_endpoint: ISSUER + "/logout",
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  subject_types_supported: ["public"],
  id_token_signing_alg_values_supported: ["RS256"],
  scopes_supported: ["openid", "email", "profile"],
  token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
};

const send = (res, status, body, type = "application/json") => {
  const data = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": type + "; charset=utf-8", "Cache-Control": "no-store" });
  res.end(data);
};

const readBody = async (req) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, ISSUER);
  const path = url.pathname;

  if (path === "/.well-known/openid-configuration") return send(res, 200, discovery);
  if (path === "/jwks") return send(res, 200, { keys: [jwk] });

  if (path === "/authorize") {
    const redirectUri = url.searchParams.get("redirect_uri");
    const state = url.searchParams.get("state");
    const nonce = url.searchParams.get("nonce");
    if (!redirectUri) return send(res, 400, { error: "invalid_request", detail: "missing redirect_uri" });
    const code = randomUUID();
    codes.set(code, { redirectUri, nonce });
    const back = new URL(redirectUri);
    back.searchParams.set("code", code);
    if (state) back.searchParams.set("state", state);
    res.writeHead(302, { Location: back.toString() });
    return res.end();
  }

  if (path === "/token" && req.method === "POST") {
    const raw = await readBody(req);
    const form = new URLSearchParams(raw);
    const code = form.get("code");
    const entry = codes.get(code);
    if (!entry) return send(res, 400, { error: "invalid_grant", detail: "unknown code" });
    codes.delete(code);

    const now = Math.floor(Date.now() / 1000);
    const idToken = await new SignJWT({
      email: EMAIL,
      name: NAME,
      realm_access: { roles: ROLES },
      roles: ROLES,
      ...(entry.nonce ? { nonce: entry.nonce } : {}),
    })
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setSubject(USER)
      .setIssuedAt(now)
      .setExpirationTime(now + 900)
      .sign(privateKey);

    const accessToken = randomUUID();
    tokens.add(accessToken);
    return send(res, 200, {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 900,
      id_token: idToken,
      scope: "openid email profile",
    });
  }

  if (path === "/userinfo") {
    const auth = req.headers.authorization ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!tokens.has(bearer)) return send(res, 401, { error: "invalid_token" });
    return send(res, 200, { sub: USER, email: EMAIL, name: NAME });
  }

  if (path === "/logout") {
    res.writeHead(302, { Location: url.searchParams.get("post_logout_redirect_uri") ?? "/" });
    return res.end();
  }

  send(res, 404, { error: "not_found", path });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("[mock-idp] listening on " + ISSUER);
  console.log("[mock-idp] user=" + USER + " roles=" + ROLES.join(","));
  console.log("[mock-idp] OIDC_ISSUER=" + ISSUER + "/.well-known/openid-configuration");
});
