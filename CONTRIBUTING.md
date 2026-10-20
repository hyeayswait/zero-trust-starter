# 贡献指南

欢迎提 Issue 和 PR。改安全逻辑请格外谨慎——这个项目存在的意义就是「默认安全」。

## 环境要求

- Node.js 18+
- Docker（跑本地 Keycloak / Postgres / Redis / Ollama）
- 可选：Python 3（跑离线测试）

## 本地开发

```bash
# 1. 准备环境变量
cp .env.example .env
# 编辑 .env：填入 OIDC 凭据，并把 APP_SECRET 换成 >=32 位随机串
#   PowerShell 生成随机密钥：
#   $b=New-Object byte[] 48; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
#   (($b|%{$_.ToString('x2')})-join '')

# 2. 安装依赖
npm install

# 3. 一键拉起依赖服务（Keycloak 会自动导入 realm）
docker compose up -d

# 4. 启动应用
npm run dev        # http://localhost:3000
```

## 提交前必跑的检查

```bash
npm run typecheck   # TypeScript 类型检查（tsc --noEmit）
npm run lint        # ESLint
npm test            # jose JWT 单元测试（tests/jwt.test.mjs）
```

离线校验（不需要起服务）：

```bash
python tests/static_check.py    # 源码静态安全检查
python tests/logic_test.py      # 核心安全逻辑测试
```

服务起来后的冒烟测试：

```bash
bash scripts/verify.sh          # 健康检查 + 未登录访问受保护接口应返回 401
```

## 分支与提交

- 从 `main` 切分支：`git checkout -b feat/你的改动`
- 提交信息用简洁的动词开头，例如 `fix: 会话绑定缺少 user-agent 校验`
- PR 里说明：**改了什么、为什么、怎么验证**。涉及鉴权/权限/审计的改动，请附上验证命令的输出。

## 安全相关的约定

- 不要把任何真实密钥、client_secret 提交进仓库。`.env` 已在 `.gitignore` 中，只提交 `.env.example`。
- 修改 `src/lib/auth/`、`src/lib/security/` 下的代码时，请同步补充或更新测试。
- 发现安全漏洞请**不要**开公开 Issue，走仓库的私有漏洞报告渠道或联系维护者。

## License

提交即表示同意你的贡献以 MIT 许可证发布。
