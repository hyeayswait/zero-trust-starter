# 无 Docker 演示模式（DEMO.md 补充）

没有 Docker / 不想装 WSL2 时，用这套方式在本机跑起界面。

## 原理

用三个本地服务替代 `docker compose` 里的容器：

| 生产依赖 | Demo 替代 | 说明 |
|---|---|---|
| Keycloak :8080 | `scripts/mock-idp.mjs` | 真 OIDC 协议（发现文档/授权码/令牌/JWKS），**RS256 真签名** |
| Ollama :11434 | `scripts/mock-ollama.mjs` | 真 NDJSON 流式响应，返回固定文本（非模型推理） |
| Postgres | 内存缓冲（`DEMO_MODE=1`） | 审计日志存进程内存 |
| Redis | 进程内滑动窗口 | 限流逻辑一致 |

**登录、鉴权、RBAC、审计、流式输出全都是真的**，只有 IdP 和 LLM 是本地替身。

## 用法

```bash
# 1. 依赖
npm install

# 2. 环境变量
cp .env.demo.example .env.demo

# 3. 一键启动（mock IdP + mock Ollama + Next dev）
node scripts/run-demo.mjs
```

然后打开 http://127.0.0.1:3000

演示账号由 `--user` / `--roles` 控制，默认 `demo`，角色 `admin,member`（所以能进 /admin）。

## 已知限制

- **不能在本机跑的原因**：某些受限沙箱禁止 Node 用管道 fork 子进程，
  `next dev` / `next build` 会报 `spawn EPERM`。普通开发机不会有这个问题。
- mock Ollama 返回固定文本，不是真实推理结果。录 demo 时若在意这点，
  请改用真实 Ollama。
- `DEMO_MODE=1` 会跳过 Postgres 写入；不要把该模式用于生产。

## 截图

启动后用 `node scripts/capture-demo.mjs` 抓帧（需先 `npm i -D playwright`）。
