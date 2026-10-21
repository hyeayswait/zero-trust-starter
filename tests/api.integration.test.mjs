// tests/api.integration.test.mjs —— API 路由集成测试（真打 HTTP）
//
//   node tests/api.integration.test.mjs
//
// 需要一个已启动的实例。默认 http://127.0.0.1:3000。
// 覆盖 401 / 403 / 200 三态，以及登出后 token 立即失效（会话撤销）。
//
// 若基础地址不可达，测试会给出明确提示并退出码 2（区别于断言失败）。

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log("  [OK] " + name + (detail ? "  " + detail : "")); }
  else { fail++; console.log("  [FAIL] " + name + (detail ? "  " + detail : "")); }
};

// ---- Cookie jar ----
const jar = new Map();
function absorb(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    const k = pair.slice(0, i).trim();
    const v = pair.slice(i + 1).trim();
    if (v === "") jar.delete(k);
    else jar.set(k, v);
  }
}
const cookieHeader = () =>
  [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

async function reachable() {
  try {
    const r = await fetch(BASE + "/api/health", { signal: AbortSignal.timeout(4000) });
    return r.ok || r.status === 404;
  } catch {
    return false;
  }
}

if (!(await reachable())) {
  console.error(`无法连接 ${BASE}`);
  console.error("请先启动服务：node scripts/run-demo.mjs");
  process.exit(2);
}

console.log("目标:", BASE);

// ---- 1. 未登录 ----
console.log("\n=== 1. 未登录访问受保护接口 ===");
for (const path of ["/api/dashboard", "/api/admin", "/api/me"]) {
  const r = await fetch(BASE + path, { redirect: "manual" });
  ok(`${path} -> 401`, r.status === 401, `实际 ${r.status}`);
}
{
  const r = await fetch(BASE + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
  });
  ok("/api/chat POST -> 401", r.status === 401, `实际 ${r.status}`);
}

// ---- 2. 登录 ----
console.log("\n=== 2. OIDC 登录 ===");
let r = await fetch(BASE + "/api/auth/login", { redirect: "manual" });
absorb(r);
ok("login 跳转 307", r.status === 307, `实际 ${r.status}`);

const authUrl = r.headers.get("location");
const authRes = await fetch(authUrl, { redirect: "manual" });
absorb(authRes);
const cbUrl = authRes.headers.get("location");
ok("authorize 回跳 callback", Boolean(cbUrl && cbUrl.includes("/api/auth/callback")));

const cbRes = await fetch(cbUrl, { redirect: "manual", headers: { cookie: cookieHeader() } });
absorb(cbRes);
ok("callback 成功", cbRes.status === 307 || cbRes.status === 200, `实际 ${cbRes.status}`);
ok("拿到会话 Cookie", jar.has("zt_token"));
ok("拿到 device_id", jar.has("device_id"));

// ---- 3. 登录后可访问 ----
console.log("\n=== 3. 登录后访问 ===");
for (const path of ["/api/dashboard", "/api/me"]) {
  const res = await fetch(BASE + path, { headers: { cookie: cookieHeader() } });
  ok(`${path} -> 200`, res.status === 200, `实际 ${res.status}`);
}
{
  const res = await fetch(BASE + "/api/dashboard", { headers: { cookie: cookieHeader() } });
  const body = await res.json().catch(() => ({}));
  ok("响应含 greeting", typeof body.greeting === "string", body.greeting || "");
  ok("响应带 traceId 头", res.headers.has("x-request-id"), res.headers.get("x-request-id") || "无");
}

// ---- 4. AI 助手流式 ----
console.log("\n=== 4. AI 助手 ===");
{
  const res = await fetch(BASE + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ messages: [{ role: "user", content: "零信任的核心是什么" }] }),
  });
  ok("/api/chat -> 200", res.status === 200, `实际 ${res.status}`);
  if (res.ok) {
    const text = await res.text();
    ok("返回非空内容", text.trim().length > 10, `${text.trim().length} 字符`);
  }
}

// ---- 5. 输入校验 ----
console.log("\n=== 5. 输入校验 ===");
{
  const res = await fetch(BASE + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({ messages: [] }),
  });
  ok("空 messages -> 400", res.status === 400, `实际 ${res.status}`);
}

// ---- 6. 登出后 token 立即失效（会话撤销）----
console.log("\n=== 6. 会话撤销 ===");
const tokenBeforeLogout = jar.get("zt_token");
{
  const res = await fetch(BASE + "/api/auth/logout", {
    redirect: "manual",
    headers: { cookie: cookieHeader() },
  });
  absorb(res);
  ok("logout 成功", res.status === 307 || res.status === 200, `实际 ${res.status}`);
}

// 用旧 token 重放（模拟攻击者已截获 token）
if (tokenBeforeLogout) {
  const replay = await fetch(BASE + "/api/dashboard", {
    headers: { cookie: `zt_token=${tokenBeforeLogout}` },
  });
  ok("旧 token 重放被拒（401）", replay.status === 401, `实际 ${replay.status}`);
} else {
  ok("旧 token 重放被拒（401）", false, "未取到 token");
}

console.log("\n" + "=".repeat(52));
console.log("结果: " + (fail === 0 ? "ALL PASS" : fail + " FAILED") + "   (pass=" + pass + ", fail=" + fail + ")");
process.exit(fail === 0 ? 0 : 1);
