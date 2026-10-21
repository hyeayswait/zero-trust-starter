// scripts/run-demo.mjs —— 一键拉起本地开发环境（轻量，零外部依赖）。
//
//   node scripts/run-demo.mjs
//
// 依次启动 mock IdP :8080、mock Ollama :11434、Next.js dev :3000
// 然后浏览器打开 http://127.0.0.1:3000
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const env = { ...process.env };
try {
  const raw = readFileSync(join(ROOT, ".env.demo"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2].trim();
  }
} catch {
  console.error("缺少 .env.demo");
  process.exit(1);
}

const children = [];
function start(name, args) {
  // 注意：受限环境下 stdio:"pipe" 会 EPERM，用 inherit 直接复用当前控制台
  const p = spawn(process.execPath, args, { cwd: ROOT, env, stdio: "inherit" });
  const tag = "[" + name + "] ";
  p.on("exit", (code) => process.stdout.write(tag + "exited(" + code + ")\n"));
  children.push(p);
  return p;
}

console.log("启动本地开发环境...");
start("idp", ["scripts/mock-idp.mjs", "--port", "8080", "--user", "demo", "--roles", "admin,member"]);
start("ollama", ["scripts/mock-ollama.mjs", "--port", "11434"]);

await new Promise((r) => setTimeout(r, 1200));

console.log("启动 Next.js（首次编译约 10-20 秒）...");
start("next", ["node_modules/next/dist/bin/next", "dev", "-p", "3000"]);

console.log("");
console.log("就绪后打开：http://127.0.0.1:3000");
console.log("按 Ctrl+C 停止全部服务");
console.log("");

const shutdown = () => {
  for (const c of children) {
    try { c.kill("SIGTERM"); } catch { /* ignore */ }
  }
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
