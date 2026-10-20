# Demo 录制指南（30 秒 GIF / 短视频）

目标：让访客 30 秒内看懂「零信任默认开启 + 内置 AI 助手」。

## 自动化流程（推荐）

分两步：在**能跑 Docker 的机器**抓真帧，再在任何有 Python 的机器拼 GIF。

```bash
# ---- A. 抓帧机器（需要 Docker + Node 18+）----
docker compose up -d                 # 等 app/db/redis/keycloak/ollama 全部 healthy
npm i -D playwright
npx playwright install chromium
node scripts/capture-demo.mjs        # 帧输出到 docs/frames/

# ---- B. 拼 GIF（只需 Python + Pillow，本机即可）----
pip install Pillow
python scripts/build_gif.py          # 生成 docs/demo.gif，自动压到 <3MB
```

把 `docs/frames/` 拷回拼帧机器即可（`.gitignore` 已忽略该目录，不会误提交）。

## 录制脚本（capture-demo.mjs 对应的 5 个画面）
1. landing：`/` 的卖点列表
2. OIDC 登录：点「使用 OIDC 登录」→ Keycloak 填 `demo / demo1234`
3. dashboard：`/dashboard` 控制台指标
4. AI 助手：右下角输入框提问，看流式输出
5. admin：`/admin` 审计日志（actor / action / ip / ok）

## ⚠ 已知坑：/admin 会 403

`keycloak/realm.json` 里演示用户 `demo` 只有 `member` 角色，
而 `/admin` 需要 `admin:read`（见 `src/lib/auth/types.ts` 的 `ROLE_PERMISSIONS`）。
要录审计日志画面，先给 demo 加 admin 角色，二选一：

```bash
# 方式 1：改 realm.json 里 demo 的 realmRoles 为 ["member","admin"]，然后重启 keycloak
docker compose up -d keycloak

# 方式 2：Keycloak 控制台 http://localhost:8080 （admin/admin）手动给 demo 加 admin 角色
```

## 手动录屏备选
- 录屏：macOS `cmd+shift-5` / Windows Xbox Game Bar / OBS
- GIF 压缩：ffmpeg 转 gif 或 https://ezgif.com
- 建议尺寸 1280x720，文件 < 3MB 方便 README 内嵌

## 截图清单（README 用，capture-demo.mjs 会自动产出）
- 01-landing.png
- 02-keycloak-login.png
- 03-dashboard.png
- 04-chat-streaming.png
- 06-admin-audit.png

> 注意：README 里的 demo.gif 必须是**真实运行**抓出来的画面。
> 不要用合成图冒充产品效果——访客一眼能看穿，反而掉信任。
