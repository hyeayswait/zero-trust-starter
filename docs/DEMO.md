# Demo 录制指南（30 秒 GIF / 短视频）

目标：让访客 30 秒内看懂「零信任默认开启 + 内置 AI 助手」。

## 录制脚本
1. (0-5s) 打开 http://localhost:3000 —— 展示 landing 页卖点列表
2. (5-12s) 点击「使用 OIDC 登录」→ 跳转到 IdP 登录 → 回跳 /dashboard
3. (12-20s) 展示 /dashboard 的控制台指标 + 右下角「本地 AI 助手」输入框，提问并看到流式输出
4. (20-28s) 打开 /admin —— 展示审计日志（actor / action / ip / ok 一列）
5. (28-30s) 结尾字幕：「secure-by-default · 数据不出内网」

## 工具
- 录屏：macOS `cmd+shift+5` / Windows Xbox Game Bar / OBS
- GIF 压缩：ffmpeg 转 gif 或用 https://ezgif.com
- 建议尺寸 1280x720，文件 < 3MB 方便 README 内嵌

## 截图清单（README 用）
- landing.png
- login-oidc.png
- dashboard-chat.png
- admin-audit.png
