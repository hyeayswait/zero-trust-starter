// 端到端测 /api/chat：模拟浏览器带 cookie 登录后调用
const BASE = "http://127.0.0.1:3000";
const IDP = "http://127.0.0.1:8080";

async function main() {
  // 1. 走完 OIDC 登录拿 zt_token
  const loginRes = await fetch(BASE + "/api/auth/login", { redirect: "manual" });
  console.log("login ->", loginRes.status, "| location:", (loginRes.headers.get("location") || "").slice(0, 90));
  const cookies1 = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
  console.log("  set-cookie 数量:", cookies1.length);

  const state = (cookies1.find(c => c.startsWith("oidc_state=")) || "").split(";")[0].split("=")[1];
  const verifier = (cookies1.find(c => c.startsWith("oidc_verifier=")) || "").split(";")[0].split("=")[1];
  console.log("  state:", (state||"").slice(0,16), "| verifier:", (verifier||"").slice(0,12));

  // 2. 跟随授权端点
  const authUrl = loginRes.headers.get("location");
  const authRes = await fetch(authUrl, { redirect: "manual" });
  const cbUrl = authRes.headers.get("location");
  console.log("authorize ->", authRes.status, "| callback:", (cbUrl||"").slice(0, 100));

  // 3. 回调换 token
  const cbRes = await fetch(cbUrl, {
    redirect: "manual",
    headers: { cookie: `oidc_state=${state}; oidc_verifier=${verifier}` },
  });
  console.log("callback ->", cbRes.status);
  const cbCookies = cbRes.headers.getSetCookie ? cbRes.headers.getSetCookie() : [];
  console.log("  set-cookie:", cbCookies.map(c => c.split("=")[0]).join(", "));
  const zt = (cbCookies.find(c => c.startsWith("zt_token=")) || "").split(";")[0];
  const dev = (cbCookies.find(c => c.startsWith("device_id=")) || "").split(";")[0];
  console.log("  拿到 zt_token:", zt ? "✓" : "✗", "| device_id:", dev ? "✓" : "✗");

  // 4. 调用 /api/chat
  const chatRes = await fetch(BASE + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: [zt, dev].filter(Boolean).join("; ") },
    body: JSON.stringify({ messages: [{ role: "user", content: "零信任是什么" }] }),
  });
  console.log("\n/api/chat ->", chatRes.status, "| content-type:", chatRes.headers.get("content-type"));
  const text = await chatRes.text();
  console.log("  响应长度:", text.length);
  console.log("  内容:", text.slice(0, 200));
  console.log("  判定:", text.length > 50 && !text.includes('"error"') ? "✓ 正常" : "✗ 异常");
}

main().catch(e => console.error("异常:", e.message));
