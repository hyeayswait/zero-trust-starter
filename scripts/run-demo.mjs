// scripts/run-demo.mjs —— 一键拉起本地开发环境（轻量，零外部依赖）。
//
//   node scripts/run-demo.mjs
//   node scripts/run-demo.mjs --no-prewarm    # 跳过预热
//
// 依次启动 mock IdP :8080、mock Ollama :11434、Next.js dev :3000，
// 并在后台预热首页，避免第一次打开时干等编译。
import { spawn } from "node:child_process";
import { readFileSync, statSync, existsSync, rmSync, readdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 3000);
const PREWARM = !process.argv.includes("--no-prewarm");

/** 递归取目录内最新 mtime */
function newestMtime(path) {
  let newest = 0;
  const visit = (p) => {
    let st;
    try {
      st = statSync(p);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      let entries = [];
      try {
        entries = readdirSync(p);
      } catch {
        return;
      }
      for (const name of entries) {
        if (name === "node_modules" || name === ".next" || name === ".git") continue;
        visit(join(p, name));
      }
    } else {
      newest = Math.max(newest, st.mtimeMs);
    }
  };
  visit(path);
  return newest;
}

// 源码比 .next 缓存新时删掉缓存，避免「改完代码重启仍在跑旧产物」。
function checkStaleCache() {
  const cache = join(ROOT, ".next");
  if (!existsSync(cache)) return;
  let cacheTime = 0;
  try {
    cacheTime = statSync(cache).mtimeMs;
  } catch {
    return;
  }
  const srcTime = Math.max(
    newestMtime(join(ROOT, "src")),
    ...["next.config.js", "package.json", "tsconfig.json"]
      .map((f) => {
        try {
          return statSync(join(ROOT, f)).mtimeMs;
        } catch {
          return 0;
        }
      })
  );
  if (srcTime > cacheTime) {
    console.log("[cache] sources changed, clearing .next ...");
    try {
      rmSync(cache, { recursive: true, force: true });
    } catch {
      console.log("[cache] auto-clear failed, delete .next manually");
    }
  }
}

checkStaleCache();


const env = { ...process.env };
try {
  const raw = readFileSync(join(ROOT, ".env.demo"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim();
    // 强制以 .env.demo 为准：项目根的 .env 是 docker compose 那套
    // （OLLAMA_BASE_URL=http://ollama:11434 在宿主机解析不了），
    // 若沿用 .env 的值，AI 助手和 OIDC 都会连到不存在的容器主机名。
    env[key] = value;
  }
} catch {
  console.error("Missing .env.demo - run: copy .env.demo.example .env.demo");
  process.exit(1);
}

// Next.js 会自动加载项目根的 .env，其中的 docker 主机名会覆盖上面的值。
// 启动期间把它临时改名，退出时还原，保证 demo 配置生效。
const dotenvPath = join(ROOT, ".env");
const dotenvBackup = join(ROOT, ".env.docker-disabled");
let dotenvMoved = false;
if (existsSync(dotenvPath)) {
  try {
    renameSync(dotenvPath, dotenvBackup);
    dotenvMoved = true;
    console.log("[env] temporarily disabled .env (docker compose config)");
  } catch {
    console.log("[env] WARN could not disable .env, AI/IdP may point to docker hostnames");
  }
}

function restoreDotenv() {
  if (!dotenvMoved) return;
  try {
    renameSync(dotenvBackup, dotenvPath);
    dotenvMoved = false;
  } catch {
    /* ignore */
  }
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

/** 检查端口是否已被监听 */
async function isPortInUse(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(1200),
    });
    return true;
  } catch (err) {
    // 连接被拒绝说明端口空闲；超时或其他错误视为占用
    const msg = String(err?.cause?.code || err?.code || err?.name || "");
    return !(msg.includes("ECONNREFUSED") || msg.includes("ConnectionRefused"));
  }
}

/** 已在运行则复用，避免 EADDRINUSE 直接把脚本打挂 */
async function ensureService(name, port, args, healthPath) {
  if (await isPortInUse(port)) {
    console.log(`[${name}] port ${port} already in use, reusing existing service`);
    return false;
  }
  start(name, args);
  // 等它起来
  for (let i = 0; i < 20; i += 1) {
    await new Promise((r) => setTimeout(r, 300));
    try {
      const r = await fetch(`http://127.0.0.1:${port}${healthPath}`, {
        signal: AbortSignal.timeout(800),
      });
      if (r.ok) return true;
    } catch {
      /* keep waiting */
    }
  }
  console.log(`[${name}] WARN not healthy on port ${port} yet`);
  return true;
}

/** 轮询等待 Next.js 端口就绪，然后预热首页（触发编译） */
async function prewarm() {
  const url = `http://127.0.0.1:${PORT}/`;
  const deadline = Date.now() + 90_000;
  process.stdout.write("\nWaiting for Next.js");
  while (Date.now() < deadline) {
    try {
      await fetch(url, { method: "GET", signal: AbortSignal.timeout(60_000) });
      // 编译完成，再预热一次确保缓存命中
      await fetch(url, { signal: AbortSignal.timeout(10_000) });
      process.stdout.write("\nLanding page compiled. Browser will open instantly.\n\n");
      return;
    } catch {
      process.stdout.write(".");
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  process.stdout.write("\n(prewarm timeout, open the page manually)\n\n");
}

console.log("Starting local dev environment...");
await ensureService(
  "idp", 8080,
  ["scripts/mock-idp.mjs", "--port", "8080", "--user", "demo", "--roles", "admin,member"],
  "/.well-known/openid-configuration"
);
await ensureService("ollama", 11434, ["scripts/mock-ollama.mjs", "--port", "11434"], "/api/tags");

console.log("Starting Next.js ...");
if (await isPortInUse(PORT)) {
  console.log(`[next] port ${PORT} already in use.`);
  console.log(`[next] If this is a stale process, free it with:`);
  console.log(`       netstat -ano | findstr :${PORT}   then   taskkill /F /PID <pid>`);
  console.log(`[next] Or run with a different port:  set PORT=3001 && node scripts/run-demo.mjs`);
  restoreDotenv();
  process.exit(1);
}
start("next", ["node_modules/next/dist/bin/next", "dev", "-p", String(PORT)]);

if (PREWARM) {
  prewarm();
} else {
  console.log("");
  console.log("Open: http://127.0.0.1:" + PORT);
}

console.log("================================================");
console.log("  URL:     http://127.0.0.1:" + PORT);
console.log("  Account: demo  (roles admin,member)");
console.log("  Stop:    Ctrl+C");
console.log("================================================");
console.log("");

const shutdown = () => {
  for (const c of children) {
    try { c.kill("SIGTERM"); } catch { /* ignore */ }
  }
  restoreDotenv();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
// 异常退出也要还原，避免 .env 丢失
process.on("exit", restoreDotenv);
process.on("uncaughtException", (err) => {
  console.error(err);
  restoreDotenv();
  process.exit(1);
});
