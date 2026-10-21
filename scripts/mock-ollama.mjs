// scripts/mock-ollama.mjs —— 本地 Ollama 兼容服务，用于本地开发与界面演示。
//
// 实现 /api/chat 的 NDJSON 流式响应，让 UI 的打字机效果是真实流式输出。
// 注意：返回固定解释文本，不是模型推理结果，仅用于界面演示。
// 生产请用真实 Ollama。
//
// 用法：node scripts/mock-ollama.mjs --port 11434
import { createServer } from "node:http";

const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const PORT = Number(arg("port", "11434"));

const REPLY = [
  "零信任的核心是「永不信任，始终验证」。",
  "它不假设内网是安全的，所以每次请求都要重新确认三件事：",
  "一、你是谁（由外部 IdP 背书的身份）；",
  "二、你能否做这件事（最小权限 RBAC）；",
  "三、这次会话是否被劫持（短期令牌 + 设备上下文绑定）。",
  "本系统把这三步放在每个 API 的 protect() 里强制执行，任何一步失败就返回 401 / 403。",
];

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:" + PORT);

  if (url.pathname === "/api/tags") {
    return send(res, 200, { models: [{ name: "qwen2.5:7b", modified_at: new Date().toISOString() }] });
  }

  if (url.pathname === "/api/chat" && req.method === "POST") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let model = "qwen2.5:7b";
    try {
      model = JSON.parse(Buffer.concat(chunks).toString("utf8")).model ?? model;
    } catch { /* ignore */ }

    res.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    });
    for (const line of REPLY) {
      for (let i = 0; i < line.length; i += 6) {
        res.write(JSON.stringify({
          model,
          message: { role: "assistant", content: line.slice(i, i + 6) },
          done: false,
        }) + "\n");
        await new Promise((r) => setTimeout(r, 45));
      }
    }
    res.write(JSON.stringify({ model, message: { role: "assistant", content: "" }, done: true }) + "\n");
    return res.end();
  }

  send(res, 404, { error: "not_found", path: url.pathname });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("[mock-ollama] listening on http://127.0.0.1:" + PORT);
});
