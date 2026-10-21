"use client";
import { useState } from "react";

export default function ChatBox() {
  const [input, setInput] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    if (!input.trim() || busy) return;
    setOut("");
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: input }] }),
      });

      // 关键：先判断状态码。401/403/503 返回的是 JSON 错误，
      // 若直接当流读，界面只会空白，用户以为「点了没反应」。
      if (!res.ok) {
        let msg = `请求失败（HTTP ${res.status}）`;
        try {
          const data = await res.json();
          msg = data.detail || data.error || msg;
        } catch {
          /* 响应不是 JSON，保留默认信息 */
        }
        setError(msg);
        return;
      }
      if (!res.body) {
        setError("响应为空");
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setOut((o) => o + dec.decode(value, { stream: true }));
      }
    } catch (err) {
      setError(`连接失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3>本地 AI 助手</h3>
      <textarea
        className="input"
        rows={3}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="问点什么…（Ctrl+Enter 发送）"
        disabled={busy}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send();
          }
        }}
      />
      <button className="btn" onClick={send} disabled={busy || !input.trim()} style={{ marginTop: 8 }}>
        {busy ? "生成中…" : "发送"}
      </button>
      {error ? (
        <p style={{ color: "#b42318", marginTop: 8, fontSize: 14 }}>{error}</p>
      ) : null}
      <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{out}</pre>
    </div>
  );
}
