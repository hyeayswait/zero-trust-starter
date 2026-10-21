// scripts/run-demo.mjs —— 一键拉起本地开发环境（轻量，零外部依赖）。
//
//   node scripts/run-demo.mjs
//   node scripts/run-demo.mjs --no-prewarm    # 跳过预热
//
// 依次启动 mock IdP :8080、mock Ollama :11434、Next.js dev :3000，
// 并在后台预热首页，避免第一次打开时干等编译。
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 3000);
const PREWARM = !process.argv.includes("--no-prewarm");

const env = { ...process.env };
try {
  const raw = readFileSync(join(ROOT, ".env.demo"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2].trim();
  }
} catch {
  console.error("缺少 .env.demo —— 先执行：copy .env.demo.example .env.demo");
  process.exit(1);
}

const children = [];
function start(name, args) {
  // 注意：受限环境下 stdio:"pipe" 会 EPERM，用 inherit 直接复用当前控制台
  const p = spawn(process.execPath, args, { cwd: ROOT, env, stdio: "inherit" });
  const tag = "[" + name + "] ";
  p.on("exit", (code) => {
    if (code !== 0 && code !== null) process.stdout.write(tag + "exited(" + code + ")\n");
  });
  children.push(p);
  return p;
}

/** 轮询等待 Next.js 端口就绪，然后预热首页（触发编译） */
async function prewarm() {
  const url = `http://127.0.0.1:${PORT}/`;
  const deadline = Date.now() + 90_000;
  process.stdout.write("\n等待 Next.js 就绪");
  while (Date.now() < deadline) {
    try {
      await fetch(url, { method: "GET", signal: AbortSignal.timeout(60_000) });
      // 编译完成，再预热一次确保缓存命中
      await fetch(url, { signal: AbortSignal.timeout(10_000) });
      process.stdout.write("\n首页已编译完成，浏览器打开后无需等待。\n\n");
      return;
    } catch {
      process.stdout.write(".");
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  process.stdout.write("\n（预热超时，可手动打开页面）\n\n");
}

console.log("启动本地开发环境...");
start("idp", ["scripts/mock-idp.mjs", "--port", "8080", "--user", "demo", "--roles", "admin,member"]);
start("ollama", ["scripts/mock-ollama.mjs", "--port", "11434"]);

await new Promise((r) => setTimeout(r, 1200));

console.log("启动 Next.js ...");
start("next", ["node_modules/next/dist/bin/next", "dev", "-p", String(PORT)]);

if (PREWARM) {
  prewarm();
} else {
  console.log("");
  console.log("就绪后打开：http://127.0.0.1:" + PORT);
}

console.log("================================================");
console.log("  地址:     http://127.0.0.1:" + PORT);
console.log("  演示账号: demo  (角色 admin,member)");
console.log("  停止:     Ctrl+C");
console.log("================================================");
console.log("");

const shutdown = () => {
  for (const c of children) {
    try { c.kill("SIGTERM"); } catch { /* ignore */ }
  }
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
