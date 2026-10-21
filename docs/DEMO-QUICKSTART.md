# 本地快速启动（不装任何外部服务）

不想启动整套 `docker compose` 时，用内置的轻量服务直接跑起界面。

## 原理

开发时用两个内置服务替代外部依赖，**登录、鉴权、RBAC、审计、流式输出全部是真实逻辑**：

| 生产依赖 | 本地替代 | 说明 |
|---|---|---|
| Keycloak :8080 | `scripts/mock-idp.mjs` | 完整 OIDC 协议（发现文档 / 授权码 / 令牌 / JWKS），**RS256 真签名** |
| Ollama :11434 | `scripts/mock-ollama.mjs` | 真实 NDJSON 流式响应，便于验证前端打字机效果 |
| Postgres | 内存缓冲 | 审计日志落进程内存 |
| Redis | 进程内滑动窗口 | 限流算法与生产一致 |

## 用法

```bash
npm install
cp .env.demo.example .env.demo
node scripts/run-demo.mjs
```

打开 http://127.0.0.1:3000

账号默认 `demo`，角色 `admin,member`（可进 /admin）。

## 用于截图与录屏

这套方式适合抓 README 用的界面截图：

```bash
npm i -D playwright && npx playwright install chromium
node scripts/capture-demo.mjs
python scripts/build_gif.py
```

## 说明

- `scripts/mock-ollama.mjs` 返回固定解释文本，不是模型推理结果；
  如需真实回答请启动 Ollama。
- `DEMO_MODE=1` 会跳过 Postgres 写入，仅用于本地开发，不用于生产。
- 若 `node scripts/run-demo.mjs` 报 `spawn EPERM`，说明当前环境禁止
  Node 创建子进程（部分受限沙箱会这样），在普通开发机上不会出现。
