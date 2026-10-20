# 推送指南（PUSH）

> 当前分支为 `master`，工作区干净，46 个文件已提交，`.env` 未被跟踪（安全）。
> 以下步骤在你**本地有外网+git 凭据**的机器执行。

## 0. 前置确认
```powershell
cd zero-trust-starter
git status            # 应为空
git log --oneline     # 应有 6 个 commit
```
如需改默认分支为 main：
```powershell
git branch -M main
```

## 1. 推到 GitHub
1. 在 github.com 新建空仓库（不要勾选 README/.gitignore，避免冲突），得到 `git@github.com:<你>/zero-trust-starter.git`
2. 关联并推送：
```powershell
git remote add origin git@github.com:<你>/zero-trust-starter.git
git push -u origin main      # 若仍是 master 则用 master
```
> 若报身份问题（之前沙箱用环境变量注入过身份，本地正常不会）：
> `git -c user.name=你 -c user.email=你@x.com push -u origin main`

## 2. 同步到 Gitee（国内流量）
1. 在 gitee.com 新建空仓库，得到 `git@gitee.com:<你>/zero-trust-starter.git`
2. 关联并推送：
```powershell
git remote add gitee git@gitee.com:<你>/zero-trust-starter.git
git push -u gitee main
```

## 3. 双远程一键同步（可选）
以后推送两边：
```powershell
git push origin main
git push gitee main
```
或加 alias：
```powershell
git remote add both git@github.com:<你>/zero-trust-starter.git   # 仅作记忆，下方用脚本
# 更稳：写个脚本 push-all.ps1
```

## 4. 推送后必做
- 在 GitHub/Gitee 仓库设置里填简介、标签：#零信任 #全栈 #安全 #AI #脚手架
- 把 README 顶部的 `<你的仓库地址>` 占位换成真实 URL
- 加上 shields 徽章（build / license / stars）
- 按 docs/DEMO.md 录 30 秒 GIF 嵌进 README（star 转化关键）
- 按 docs/ARTICLE.md 发引流文（掘金/知乎/V2EX + dev.to/HN）

## 5. 验证仓库不含密钥
```powershell
git ls-files | Select-String "\.env$"
# 应无输出（只有 .env.example 是安全的）
```

## 6. 常见问题
- **SSH 未配置**：用 HTTPS 地址（`https://github.com/...`）首次输入 token（不是密码）
- **push 被拒(non-fast-forward)**：空仓库不会；若远端有初始 commit，先 `git pull --rebase origin main`
- **大文件/构建产物**：`.gitignore` 已忽略 node_modules/.next/.env，不会误传
