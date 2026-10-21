# 发布与维护清单

## 0. 本地验证（每次发布前必做）

```bash
npm ci
npm run typecheck
npm test                       # 54 项：JWT / 策略 / 配置安全
```

端到端冒烟（另开终端先跑 `node scripts/run-demo.mjs`）：

```bash
node tests/api.integration.test.mjs
```

## 1. demo GIF 更新

界面有改动时重新抓帧：

```bash
# 终端 1
node scripts/run-demo.mjs
# 终端 2（等服务 Ready 后）
npm i -D playwright
node scripts/capture-demo.mjs
python scripts/build_gif.py
```

产物 `docs/demo.gif` 入库；`docs/frames/` 是中间产物，已在 `.gitignore` 中。

## 2. 推送

```bash
git remote add origin git@github.com:<你>/zero-trust-starter.git
git remote add gitee  git@gitee.com:<你>/zero-trust-starter.git
git push origin main
git push gitee  main
```

若 git 身份未配置：

```bash
git -c user.name=<你> -c user.email=<你的邮箱> push origin main
```

## 3. 仓库元信息

- **GitHub topics**：`zero-trust` `oidc` `rbac` `audit-log` `nextjs` `typescript` `security` `ai`
- **Gitee 标签**：`#零信任` `#全栈` `#安全` `#AI` `#脚手架`
- **描述**：中文一句话说明「零信任全栈脚手架，OIDC + RBAC + 审计 + 限流 + 本地 AI」

## 4. 发文章引流

- 中文：掘金 / 知乎 / V2EX，贴 `docs/ARTICLE.md`，文末放双仓库链接
- 英文：dev.to / Hacker News (Show HN)
- 标题参考见 `docs/ARTICLE.md`

## 5. 维护节奏

- Issue 24 小时内响应
- 每周一个小改进并更新 CHANGELOG（如：RAG 桩替换为 pgvector）
- README 的 demo GIF 保持与当前界面一致

## 6. 发布前安全检查

仓库里绝不能出现：

- 真实密钥、token、私钥
- 真实姓名 / 邮箱 / 手机号 / 身份证 / 学号
- 本机绝对路径（`C:\Users\...`、个人目录名）
- 生产数据库连接串

检查方式：

```bash
git grep -nE "ghp_[A-Za-z0-9]{30,}|-----BEGIN .*PRIVATE KEY-----|[A-Za-z]:\\\\Users"
```

`tests/verify-config.test.mjs` 会校验无 UTF-8 BOM；敏感串需人工过一遍上面这条命令。

## 7. 简历同步

`docs/RESUME.md` 的要点可翻译后写入 LinkedIn / 简历项目经历。
