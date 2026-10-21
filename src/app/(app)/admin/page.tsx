"use client";
import { useEffect, useState } from "react";

interface AuditEntry {
  actor: string;
  action: string;
  ip: string;
  ok: boolean;
  ts: string;
}

export default function Admin() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))
      )
      .then((d) => setEntries(Array.isArray(d.audits) ? d.audits : []))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 40 }}>
      <h1>审计日志（管理员）</h1>
      <p style={{ color: "#8b949e", fontSize: 14 }}>
        每次 API 调用都会记录 actor / action / ip / 结果。DB 不可用时落内存缓冲。
      </p>

      {error ? (
        <div className="card" style={{ color: "#f85149" }}>
          加载失败：{error}
        </div>
      ) : entries === null ? (
        <div className="card">加载中…</div>
      ) : entries.length === 0 ? (
        <div className="card">暂无审计记录（发起几次 API 调用后会出现）。</div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#8b949e" }}>
                <th style={{ padding: "10px 14px" }}>时间</th>
                <th style={{ padding: "10px 14px" }}>actor</th>
                <th style={{ padding: "10px 14px" }}>action</th>
                <th style={{ padding: "10px 14px" }}>ip</th>
                <th style={{ padding: "10px 14px" }}>ok</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} style={{ borderTop: "1px solid #1f2937" }}>
                  <td style={{ padding: "9px 14px", color: "#8b949e" }}>
                    {new Date(e.ts).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: "9px 14px" }}>{e.actor}</td>
                  <td style={{ padding: "9px 14px", fontFamily: "monospace" }}>{e.action}</td>
                  <td style={{ padding: "9px 14px", color: "#8b949e" }}>{e.ip}</td>
                  <td style={{ padding: "9px 14px", color: e.ok ? "#3fb950" : "#f85149" }}>
                    {e.ok ? "true" : "false"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 16 }}>
        <a href="/dashboard">返回控制台</a>
      </p>
    </main>
  );
}
