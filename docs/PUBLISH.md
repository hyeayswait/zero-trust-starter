# 发布清单 (PUBLISH.md)

按步骤操作，确保「能跑、能看、能冲 star」。

## 0. 本地验证（必做）
```powershell
cd D:\deepseek work\zero-trust-starter
cp .env.example .env            # 填 OIDC 凭据 + APP_SECRET(>=32位)
# 用环境变量方式避免全局 git config 权限问题（本机已 commit）
docker compose up --build       # 等 app 起来
bash scripts/verify.sh          # 冒烟：health/401/429
```

## 1.录 30 秒 demo GIF（star 转化关键）
按 `docs/DEMO.md`：landing → OIDC 登录 → dashboard+AI → admin 审计。
保存为 `docs/demo.gif` 并嵌入 README 顶部。

## 2. 补仓库链接
- 把 README 顶部和 ARTICLE.md 末尾的 `<你的仓库地址>` 换成真实 URL
- 建议加 shields 徽章（build / license / stars）

## 3. 推到 GitHub
```bash
git remote add origin git@github.com:<you>/zero-trust-starter.git
git branch -M main
git push -u origin main
```
> 注：本机 git 用了环境变量注入身份，push 时若报身份问题，临时设：
> `git -c user.name=you -c user.email=you@x.com push ...`

## 4. 同步到 Gitee（国内流量）
```bash
git remote add gitee git@gitee.com:<you>/zero-trust-starter.git
git push -u gitee main
```
Gitee 仓库描述用中文，标签：#零信任 #全栈 #安全 #AI #脚手架

## 5. 发文章引流
- 中文：掘金 / 知乎 / V2EX（贴 `docs/ARTICLE.md` 全文，文末放双链接）
- 英文：dev.to / Hacker News（Show HN）
- 标题参考见 `docs/ARTICLE.md` 末尾

## 6. 维护节奏（持续增长 star）
- 收到 Issue 24h 内响应
- 每周一个小改进（如 pgvector 替换 RAG 桩）并写 changelog
- README 保持 demo GIF 新鲜

## 7. 简历同步
把 `docs/RESUME.md` 的 bullet 翻译成英文，写进 LinkedIn / 牛客项目经历。
