# 引流文章骨架：《为什么你的脚手架该默认零信任》

> 用途：发到 掘金 / 知乎 / V2EX / dev.to / Hacker News，引流到 GitHub/Gitee 仓库。
> 文末放仓库链接 + demo GIF。

## 中文大纲
1. **痛点**：大多数 starter 把 auth 当补丁——自己存密码、令牌长期有效、没有审计
2. **三个真实事故**（简写）：令牌泄露、越权访问、无审计追溯
3. **零信任怎么做**（本仓库实践）：
   - OIDC + PKCE：身份交给专业 IdP，不碰密码
   - 15 分钟短令牌 + 设备绑定：被盗也窗口极小
   - 最小权限 RBAC：新用户默认 member
   - 全链路审计：每次调用可溯源
   - 默认安全头：CSP / X-Frame-Options
4. **AI 助手的合规卖点**：本地优先 Ollama，数据不出内网
5. **上手**：docker compose up，30 秒跑起来
6. **CTA**：GitHub/Gitee 链接 + 求 star

## English Outline (for dev.to / HN)
1. Most starters treat auth as an afterthought
2. Three failure modes: token leakage, privilege escalation, no traceability
3. Zero-trust by default (OIDC+PKCE, 15m device-bound JWT, least-privilege RBAC, full audit, secure headers)
4. Local-first AI assistant (Ollama) — data never leaves your network
5. `docker compose up` and you are secure-by-default
6. CTA: repo link + star

## 标题备选
- 中文：「别再自己存密码了：一个默认零信任的全栈脚手架」
- EN: "Stop rolling your own auth: a zero-trust starter that is secure by default"
