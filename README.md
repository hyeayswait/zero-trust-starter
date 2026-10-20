# Zero-Trust Starter Kit

> 一个生产级、开箱即用的**零信任全栈脚手架**：OIDC 鉴权 + RBAC 权限 + 审计日志 + API 限流 + 内置本地优先 AI 助手。

[English](#english) | [中文](#chinese)

---

## Chinese

### 特性
- **零信任鉴权**：基于 OIDC 授权码流程（PKCE），外部 IdP 背书身份
- **短期令牌 + 设备绑定**：访问令牌 15 分钟 TTL，且绑定设备上下文，会话盗用即拒绝
- **默认最小权限 RBAC**：角色 → 权限映射，新用户默认 `member`
- **全链路审计**：每次 API 调用记录 actor / action / ip / 结果，持久化到 Postgres（DB 不可用时内存兜底）
- **API 限流**：基于 Redis 滑动窗口
- **内置 AI 助手**：本地优先 Ollama 流式问答，支持 RAG（数据不出内网）
- **安全头**：CSP / X-Frame-Options / Nosniff 等默认开启

### 快速开始
```bash
# 1. .env 已自带本地 Keycloak 的 OIDC 配置；只需生成 APP_SECRET：
#    PowerShell:
#    $b=New-Object byte[] 48; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
#    (($b|%{$_.ToString('x2')})-join '')   # 把输出粘到 .env 的 APP_SECRET
# 2. 启动（内置 Keycloak 自动导入 zerotrust realm，Ollama 自动拉取模型）
docker compose up --build
# 3. 打开 http://localhost:3000 → 用 OIDC 登录
#    测试账号: demo / demo1234
```
> 默认 OIDC 由内置 **Keycloak** 提供，无需注册任何外部账号。
> 若要换外部 IdP（Auth0/公司 IdP），改 `.env` 的 `OIDC_*` 三项即可。
> Keycloak 管理台: http://localhost:8080 （admin / admin）

### 目录结构
```
src/lib/auth      # OIDC 客户端、JWT 会话、RBAC 类型
src/lib/security  # 请求守卫、限流、零信任上下文校验
src/lib/ai        # Ollama 流式客户端、RAG 桩
src/lib/audit     # 审计日志
src/app/api       # login/callback/logout/me/dashboard/admin/chat/health
```

---

## English

### Features
- **Zero-Trust Auth**: OIDC authorization code flow with PKCE, identity backed by external IdP
- **Short-lived token + device binding**: 15-min access token TTL, bound to device context; stolen sessions are rejected
- **Least-privilege RBAC**: role → permission map, new users default to `member`
- **Full audit trail**: every API call logs actor / action / ip / result, persisted to Postgres (in-memory fallback)
- **API rate limiting**: Redis-backed sliding window
- **Built-in AI assistant**: local-first Ollama streaming chat with RAG (data stays on-prem)
- **Secure headers**: CSP / X-Frame-Options / Nosniff on by default

### Quick Start
```bash
cp .env.example .env
docker compose up --build
# open http://localhost:3000
```

### Why this gets stars
Most starters ship auth as an afterthought. This kit makes **zero-trust the default**:
secure headers, short-lived device-bound tokens, least-privilege RBAC and audit logging
are wired in from day one — and it bundles a local-first AI assistant so your data never
leaves the network.

---

## License
MIT
