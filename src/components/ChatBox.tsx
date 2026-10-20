"use client";
import { useState } from "react";
export default function ChatBox() {
  const [input, setInput] = useState("");
  const [out, setOut] = useState("");
  async function send() {
    setOut("");
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: input }] }),
    });
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setOut((o) => o + dec.decode(value));
    }
  }
  return (
    <div className="card">
      <h3>本地 AI 助手</h3>
      <textarea className="input" rows={3} value={input} onChange={e => setInput(e.target.value)} placeholder="问点什么…" />
      <button className="btn" onClick={send} style={{ marginTop: 8 }}>发送</button>
      <pre style={{ whiteSpace: "pre-wrap" }}>{out}</pre>
    </div>
  );
}
