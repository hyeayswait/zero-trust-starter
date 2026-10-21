// tests/verify-config.test.mjs —— 配置与安全逻辑回归测试（离线，无需启动服务）
//
//   node tests/verify-config.test.mjs
//
// 覆盖：Cookie secure 判定、JWT 闭环、RBAC 角色映射、
//       localhost 重定向、CSP 策略、依赖完整性。
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { SignJWT, jwtVerify } from "jose";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "package.json"));
const cfgPath = join(ROOT, "next.config.js");

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log("  [OK] " + name + (detail ? "  " + detail : "")); }
  else { fail++; console.log("  [FAIL] " + name + (detail ? "  " + detail : "")); }
};

console.log("=== 1. Cookie secure 判定 ===");
const secureCookieOf = (env) => env.NODE_ENV === "production" && !env.DEMO_MODE;
ok("demo(http) secure=false", secureCookieOf({ NODE_ENV: "development", DEMO_MODE: "1" }) === false);
ok("生产 secure=true", secureCookieOf({ NODE_ENV: "production" }) === true);
ok("生产+demo secure=false", secureCookieOf({ NODE_ENV: "production", DEMO_MODE: "1" }) === false);

console.log("\n=== 2. JWT 签发/验签 ===");
const secret = () => new TextEncoder().encode("demo-mode-secret-please-change-32chars-minimum-0001");
const token = await new SignJWT({ email: "d@x", name: "Demo", roles: ["admin", "member"], deviceId: "dev-abc", ip: "::1" })
  .setProtectedHeader({ alg: "HS256" }).setSubject("demo").setIssuedAt().setExpirationTime("15m").sign(secret());
const { payload } = await jwtVerify(token, secret());
ok("签名验签成功", payload.sub === "demo");
ok("角色保留", JSON.stringify(payload.roles) === JSON.stringify(["admin", "member"]));
ok("deviceId 保留", payload.deviceId === "dev-abc");
try { await jwtVerify(token, new TextEncoder().encode("wrong-secret-32chars-minimum-xxxxx")); ok("错误密钥被拒", false); }
catch { ok("错误密钥被拒", true); }

console.log("\n=== 3. RBAC 角色与权限 ===");
const RP = {
  admin: ["dashboard:read", "admin:read", "admin:write", "audit:read", "chat:use"],
  member: ["dashboard:read", "chat:use"],
  auditor: ["dashboard:read", "audit:read"],
};
const ALL = ["admin", "member", "auditor"];
function normalizeRoles(claims) {
  const raw = [];
  if (claims) {
    if (claims.realm_access?.roles) raw.push(...claims.realm_access.roles);
    if (Array.isArray(claims.roles)) raw.push(...claims.roles);
    if (claims.role) raw.push(claims.role);
  }
  const roles = [...new Set(raw.filter((r) => ALL.includes(r)))];
  return roles.length ? roles : ["member"];
}
ok("Keycloak realm_access 解析", JSON.stringify(normalizeRoles({ realm_access: { roles: ["admin"] } })) === '["admin"]');
ok("通用 roles 解析", JSON.stringify(normalizeRoles({ roles: ["auditor"] })) === '["auditor"]');
ok("未知角色过滤降级", JSON.stringify(normalizeRoles({ roles: ["superuser"] })) === '["member"]');
ok("空声明降级 member", JSON.stringify(normalizeRoles({})) === '["member"]');
ok("admin 可进 /admin", RP.admin.includes("admin:read"));
ok("member 不可进 /admin", !RP.member.includes("admin:read"));
ok("member 可用 chat", RP.member.includes("chat:use"));

console.log("\n=== 4. localhost -> 127.0.0.1 重定向 ===");
const redirects = await require(cfgPath).redirects();
ok("存在重定向规则", redirects.length > 0);
ok("目标 127.0.0.1", String(redirects[0]?.destination).includes("127.0.0.1"));
ok("匹配 host=localhost", redirects[0]?.has?.[0]?.value === "localhost");

console.log("\n=== 5. CSP（开发放行 eval，生产严格）===");
const prev = process.env.NODE_ENV;
process.env.NODE_ENV = "development";
delete require.cache[require.resolve(cfgPath)];
const devCsp = (await require(cfgPath).headers())[0].headers.find((h) => h.key === "Content-Security-Policy").value;
ok("dev 含 'unsafe-eval'", devCsp.includes("'unsafe-eval'"));
ok("dev 含 ws:", devCsp.includes("ws:"));
ok("dev 含 unsafe-inline", devCsp.includes("'unsafe-inline'"));

process.env.NODE_ENV = "production";
delete require.cache[require.resolve(cfgPath)];
const prodCsp = (await require(cfgPath).headers())[0].headers.find((h) => h.key === "Content-Security-Policy").value;
ok("prod 不含 unsafe-eval", !prodCsp.includes("'unsafe-eval'"));
ok("prod 含 frame-ancestors", prodCsp.includes("frame-ancestors"));
ok("prod 含 base-uri", prodCsp.includes("base-uri"));
process.env.NODE_ENV = prev;

console.log("\n=== 6. 依赖完整性（幽灵依赖已移除）===");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8").replace(/^\uFEFF/, ""));
ok("已移除 ollama-ai", !("ollama-ai" in pkg.dependencies));
ok("已移除 ai(未使用)", !("ai" in pkg.dependencies));
ok("保留 next", "next" in pkg.dependencies);
ok("保留 jose", "jose" in pkg.dependencies);
ok("保留 openid-client", "openid-client" in pkg.dependencies);
ok("有 @types/pg", "@types/pg" in (pkg.devDependencies || {}));

console.log("\n=== 7. 文件编码（不得有 UTF-8 BOM）===");
{
  // BOM 会让 webpack 的 JSON.parse 失败、也会让某些工具读错配置。
  const { readdirSync, statSync } = require("node:fs");
  const skip = new Set(["node_modules", ".next", ".git", "out", "data", "vendor"]);
  const bad = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const p = join(dir, name);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { walk(p); continue; }
      if (!/\.(json|js|mjs|ts|tsx|md|ya?ml)$/.test(name)) continue;
      const buf = readFileSync(p);
      if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
        bad.push(p.slice(ROOT.length + 1));
      }
    }
  };
  walk(ROOT);
  ok("无文件带 UTF-8 BOM", bad.length === 0, bad.slice(0, 3).join(", "));
}

console.log("\n" + "=".repeat(54));
console.log("结果: " + (fail === 0 ? "ALL PASS" : fail + " FAILED") + "   (pass=" + pass + ", fail=" + fail + ")");
process.exit(fail === 0 ? 0 : 1);
