// scripts/capture-demo.mjs —— 用 Playwright 抓 demo 帧（在能跑 docker 的机器上执行）
// 前置：docker compose up -d && npm i -D playwright && npx playwright install chromium
// 用法：node scripts/capture-demo.mjs
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const KC = process.env.KEYCLOAK_URL || "http://localhost:8080";
const USER = process.env.DEMO_USER || "demo";
const PASS = process.env.DEMO_PASS || "demo1234";
const OUT = process.env.FRAME_DIR || "docs/frames";
mkdirSync(OUT, { recursive: true });

const shot = async (page, name) => {
  const p = join(OUT, name + ".png");
  await page.screenshot({ path: p, fullPage: true });
  console.log("  captured", p);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// 1) landing
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await shot(page, "01-landing");

// 2) OIDC 登录：点「使用 OIDC 登录」→ Keycloak 填 demo/demo1234
await page.click('a.btn[href="/api/auth/login"]');
await page.waitForURL(KC + "/realms/**", { timeout: 15000 });
await page.fill("#username", USER);
await page.fill("#password", PASS);
await shot(page, "02-keycloak-login");
await page.click('button[name="login"]');
await page.waitForURL(BASE + "/**", { timeout: 20000 });

// 3) dashboard + 本地 AI 助手流式输出
await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
await shot(page, "03-dashboard");
try {
  await page.fill("textarea.input", "零信任的核心思想是什么？");
  await page.click('button.btn:has-text("发送")');
  await page.waitForTimeout(1200);
  await shot(page, "04-chat-streaming");
  await page.waitForTimeout(2500);
  await shot(page, "05-chat-done");
} catch (e) {
  console.log("  chat 步骤跳过（Ollama 模型未就绪？）：", e.message);
}

// 4) admin 审计日志（demo 是 member，会 403；需先在 realm.json 给 demo 加 admin 角色）
await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
await shot(page, "06-admin-audit");

await browser.close();
console.log("完成：帧已输出到", OUT);
