"use client";
import { useEffect, useState } from "react";
import ChatBox from "@/components/ChatBox";
export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch("/api/dashboard").then(r => r.ok ? r.json() : { error: r.status }).then(setData);
  }, []);
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 40 }}>
      <h1>控制台</h1>
      <div className="card">{data ? <pre>{JSON.stringify(data, null, 2)}</pre> : "加载中…"}</div>
      <ChatBox />
      <p><a href="/admin">管理员视图</a> · <a href="/api/auth/logout">退出</a></p>
    </main>
  );
}
