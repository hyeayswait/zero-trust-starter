"use client";
import { useEffect, useState } from "react";
export default function Admin() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch("/api/admin").then(r => r.ok ? r.json() : { error: r.status }).then(setData);
  }, []);
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 40 }}>
      <h1>审计日志（管理员）</h1>
      <div className="card">{data ? <pre>{JSON.stringify(data, null, 2)}</pre> : "加载中…"}</div>
      <a href="/dashboard">返回控制台</a>
    </main>
  );
}
