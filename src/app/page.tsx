export default function Home() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 40 }}>
      <h1>Zero-Trust Starter Kit</h1>
      <p>基于 OIDC 的零信任鉴权 · RBAC 权限 · 审计日志 · 限流 · 内置本地 AI 助手</p>
      <div className="card">
        <a className="btn" href="/api/auth/login">使用 OIDC 登录</a>
        <span style={{ marginLeft: 12 }}>
          <a href="/dashboard">进入控制台（需登录）</a>
        </span>
      </div>
      <ul>
        <li>15 分钟短期令牌 + 设备绑定（零信任上下文校验）</li>
        <li>默认最小权限（新用户 member，管理员提权）</li>
        <li>所有 API 强制限流 + 审计日志</li>
        <li>AI 助手本地优先（Ollama），数据不出内网</li>
      </ul>
    </main>
  );
}
