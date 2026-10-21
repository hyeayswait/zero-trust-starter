// scripts/capture-demo.mjs —— 用 Playwright 抓 README 用的界面帧
//
// 前置（项目根执行）：
//   npm install
//   npm i -D playwright
//   npx playwright install chromium     （若下载慢，见 README 的镜像说明）
//   另开终端: node scripts/run-demo.mjs
//
// 用法：
//   node scripts/capture-demo.mjs
//
// 兼容两种 IdP：
//   - 本地 mock IdP（无登录表单，自动放行）
//   - Keycloak（有 #username / #password 表单）
// 运行时自动判断，无需手动切换。
//
// 浏览器查找顺序：CHROME_PATH 环境变量 -> Playwright 自带 chromium
//   -> 系统 Chrome/Edge。找不到时给出明确提示。
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const USER = process.env.DEMO_USER || "demo";
const PASS = process.env.DEMO_PASS || "demo1234";
const OUT = process.env.FRAME_DIR || "docs/frames";
mkdirSync(OUT, { recursive: true });

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe"),
].filter(Boolean);

const findExecutable = () => CANDIDATES.find((p) => existsSync(p));

const shot = async (page, name) => {
  const p = join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log("  saved", p);
};

const exe = findExecutable();
console.log("browser:", exe || "(playwright bundled)");

const launchOpts = { headless: true };
if (exe) launchOpts.executablePath = exe;

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
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

  const hasForm = await page
    .locator("#username")
    .isVisible({ timeout: 6000 })
    .catch(() => false);

  if (hasForm) {
    log("Keycloak form detected, filling credentials");
    await page.fill("#username", USER);
    await page.fill("#password", PASS);
    await shot(page, "02-idp-login");
    await page.click('button[type="submit"], button[name="login"], #kc-login');
  } else {
    log("mock IdP detected (auto-approve)");
    await shot(page, "02-idp-login");
  }

  await page.waitForURL((url) => url.href.startsWith(BASE), { timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  log("logged in: " + page.url().replace(BASE, "") || "/");

  // ---- 3. Dashboard ----
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  await shot(page, "03-dashboard");

  // ---- 4. AI 助手 ----
  log("ask AI assistant");
  const box = page.locator("textarea.input").first();
  await box.waitFor({ state: "visible", timeout: 15000 });
  await box.fill("零信任的核心思想是什么？");
  await page.click('button.btn:has-text("发送")');

  await page.waitForTimeout(1500);
  await shot(page, "04-chat-streaming");

  // 等输出稳定
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

  // ---- 5. Admin ----
  await page.goto(BASE + "/admin", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  await shot(page, "06-admin-audit");

  console.log("\nDone. Frames in:", OUT);
  console.log("Next: python scripts/build_gif.py");
} catch (err) {
  console.error("\nFAILED:", err.message.split("\n")[0]);
  await shot(page, "99-error").catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
