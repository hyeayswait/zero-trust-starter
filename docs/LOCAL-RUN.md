# 本地运行与测试指南（LOCAL-RUN）

> 本指南区分两类环境：
> A) **DSH 沙箱机**（当前分配给我执行命令的机器）—— 受限，跑不了端到端
> B) **你自己的开发机** —— 有 Node + Docker，按本指南跑全套

---

## 一、DSH 沙箱机的限制（已实测，为什么端到端跑不了）

| 项 | 状态 |
|----|------|
| 管理员权限 | 否（普通用户，装 Docker 需管理员 → 不可行） |
| 外网 HTTPS（nodejs.org / docker.com / npm / github） | 不通 |
| Python 全局装包 | 否（WinError 5 拒绝访问） |
| Node / Docker 命令 | 均未安装 |

结论：该机器无法安装或运行 Node/Docker，端到端测试只能在你的开发机执行。

---

## 二、在「你的开发机」跑全套（前提：已装 Node 18+ 与 Docker Desktop）

### 步骤 1：准备 .env
```powershell
cd zero-trust-starter
cp .env.example .env
# 编辑 .env：把 APP_SECRET 换成 >=32 位的随机串
#   PowerShell 生成:
#   $b=New-Object byte[] 48; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
#   (($b|%{$_.ToString('x2')})-join '')
# 注：仓库已内置本地 Keycloak，OIDC_* 三项已填好，无需注册外部账号
```

### 步骤 2：真实类型检查（用项目里的 TypeScript）
```powershell
npm install
npm run typecheck      # = tsc --noEmit，验证全部 .ts/.tsx 类型正确
```

### 步骤 3：真实 JWT 单测（用 jose，与 session.ts 同一套算法）
```powershell
node tests/jwt.test.mjs
# 验证：15m 短 TTL 过期拒绝、设备绑定不一致拒绝、正常签发/校验通过
```

### 步骤 4：端到端起来（Docker 全套）
```powershell
docker compose up --build
# 等待 app 健康；首次会自动导入 Keycloak realm + 拉取 qwen2.5:7b
```

### 步骤 5：端到端冒烟
```powershell
bash scripts/verify.sh
# 或 PowerShell 版见 scripts/run-e2e.ps1
# 检查：/api/health=200，未登录 /api/dashboard=401，连发后触发 429
```

### 步骤 6：走一遍登录流程（人工）
- 打开 http://localhost:3000 → 点「使用 OIDC 登录」
- Keycloak 登录页用测试账号：demo / demo1234
- 回跳 /dashboard，可见控制台指标 + 本地 AI 助手
- 打开 /admin 看审计日志

---

## 三、离线测试（不依赖任何外部服务，exit 0）

在任意有 Python 3.9+ 的机器（含沙箱机）即可：
```powershell
python tests/static_check.py   # 扫描源码，确认 9 项安全机制齐全 + 括号配对
python tests/logic_test.py     # 复现 RBAC/限流/RAG/设备绑定 逻辑，全部断言通过
```
这两项是「逻辑层 + 源码完整性」验证，不验证真实起服务。

---

## 四、常见问题
- **Keycloak 起不来**：确认 8080 端口空闲；管理台 http://localhost:8080 (admin/admin)
- **Ollama 拉模型慢**：可先手动 `ollama pull qwen2.5:7b`
- **APP_SECRET 太短**：<32 位会在运行时抛错，按步骤 1 重新生成

---

## 五、测试资产清单
| 文件 | 运行环境 | 验证内容 |
|------|---------|---------|
| tests/static_check.py | Python（任意） | 源码安全机制完整性 |
| tests/logic_test.py | Python（任意） | 核心算法逻辑 |
| tests/jwt.test.mjs | Node + jose | 真实 JWT 签发/校验/设备绑定 |
| npm run typecheck | Node + tsc | 全部 TS 类型 |
| scripts/verify.sh / run-e2e.ps1 | Docker 环境 | 端到端冒烟 |
