// scripts/capture-demo.mjs —— 用 Playwright 抓 README 用的界面帧
//
// 前置（在项目根执行）：
//   npm install
//   npm i -D playwright
//   npx playwright install chromium
//   （另开终端）node scripts/run-demo.mjs
//
// 用法：
//   node scripts/capture-demo.mjs
//
// 同时兼容两种 IdP：
//   - 本地 mock IdP（无登录表单，自动 302 放行）
//   - Keycloak（有 #username / #password 表单）
// 通过页面结构自动判断，不需要手动切换。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const USER = process.env.DEMO_USER || "demo";
const PASS = process.env.DEMO_PASS || "demo1234";
const OUT = process.env.FRAME_DIR || "docs/frames";
mkdirSync(OUT, { recursive: true });

const shot = async (page, name) => {
  const p = join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log("  saved", p);
};

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2, // 更清晰，README 里显示效果更好
});

let step = 0;
const log = (msg) => console.log(`  [${++step}] ${msg}`);

try {
  // ---- 1. Landing ----
  log(`open ${BASE}`);
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await shot(page, "01-landing");

  // ---- 2. 登录 ----
  log("click OIDC login");
  await page.click('a.btn[href="/api/auth/login"], a[href="/api/auth/login"]');

  // 判断落到哪个 IdP：有 #username 就是 Keycloak 表单，否则是 mock 自动放行
  const hasForm = await page
    .locator('#username')
    .isVisible({ timeout: 6000 })
    .catch(() => false);

  if (hasForm) {
    log("Keycloak login form detected");
    await page.fill("#username", USER);
    await page.fill("#password", PASS);
    await shot(page, "02-idp-login");
    await page.click('button[type="submit"], button[name="login"], #kc-login');
  } else {
    log("mock IdP detected (auto-approve), skipping form");
    await shot(page, "02-idp-login");
  }

  // 等回到应用
  await page.waitForURL((url) => url.href.startsWith(BASE), { timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  log("logged in -> " + page.url().replace(BASE, "") || "/");

  // ---- 3. Dashboard ----
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  await shot(page, "03-dashboard");

  // ---- 4. AI 助手流式输出 ----
  log("ask the AI assistant");
  const box = page.locator("textarea.input").first();
  await box.waitFor({ state: "visible", timeout: 15000 });
  await box.fill("零信任的核心思想是什么？");
  await page.click('button.btn:has-text("发送")');

  // 先抓「生成中」
  await page.waitForTimeout(1500);
  await shot(page, "04-chat-streaming");

  // 等输出稳定（最多 30 秒）
  const out = page.locator(".card pre").last();
  let last = "";
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(500);
    const cur = (await out.textContent()) || "";
    if (cur === last && cur.trim().length > 20) break;
    last = cur;
  }
  await shot(page, "05-chat-done");
  log(`chat output: ${last.trim().length} chars`);

  // ---- 5. Admin 审计日志 ----
  await page.goto(BASE + "/admin", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  await shot(page, "06-admin-audit");

  console.log("\nDone. Frames in:", OUT);
  console.log("Next: python scripts/build_gif.py");
} catch (err) {
  console.error("\nFAILED:", err.message);
  await shot(page, "99-error").catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
