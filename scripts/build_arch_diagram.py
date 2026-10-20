# -*- coding: utf-8 -*-
"""scripts/build_arch_diagram.py —— 用 Pillow 画架构/请求链路图（docs/architecture.png）。

纯本机可跑（只需 Pillow），不依赖 Node/Docker。
图中组件、端口、阈值均取自 docker-compose.yml 与 src 源码，非虚构。
盒子高度按内容自动计算，避免文字被裁切。
"""
from __future__ import annotations

import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "architecture.png")

W, H = 1280, 780
BG = (247, 249, 251)
INK = (31, 41, 55)
MUTED = (100, 116, 139)
BLUE = (30, 90, 168)
GREEN = (27, 122, 75)
ORANGE = (194, 90, 18)
RED = (180, 35, 31)
CARD = (255, 255, 255)

PAD_T, PAD_B, TITLE_GAP, LINE_GAP = 12, 16, 8, 8


def font(size, bold=False):
    names = (["msyhbd.ttc", "msyh.ttc", "simhei.ttf"] if bold
             else ["msyh.ttc", "simhei.ttf", "msyhbd.ttc"])
    for name in names:
        path = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", name)
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


class Box:
    """按内容自动算高的卡片。"""

    def __init__(self, x0, y0, width, title, lines, color, tf, bf, sub=""):
        self.x0, self.y0, self.x1 = x0, y0, x0 + width
        self.title, self.lines, self.color, self.sub = title, lines, color, sub
        self.tf, self.bf = tf, bf
        self.h = (PAD_T + tf.size + TITLE_GAP
                  + len(lines) * (bf.size + LINE_GAP)
                  + (bf.size + LINE_GAP if sub else 0) + PAD_B)
        self.y1 = y0 + self.h

    def draw(self, d):
        d.rounded_rectangle((self.x0, self.y0, self.x1, self.y1), radius=12,
                            fill=CARD, outline=self.color, width=3)
        d.rectangle((self.x0, self.y0, self.x0 + 8, self.y1), fill=self.color)
        d.text((self.x0 + 20, self.y0 + PAD_T), self.title, font=self.tf, fill=self.color)
        yy = self.y0 + PAD_T + self.tf.size + TITLE_GAP
        for line in self.lines:
            d.text((self.x0 + 20, yy), line, font=self.bf, fill=INK)
            yy += self.bf.size + LINE_GAP
        if self.sub:
            d.text((self.x0 + 20, yy), self.sub, font=self.bf, fill=MUTED)

    @property
    def cy(self):
        return (self.y0 + self.y1) // 2


def arrow(d, p0, p1, color, label, lf, bg=BG):
    d.line((p0, p1), fill=color, width=3)
    ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    for off in (math.radians(155), math.radians(-155)):
        d.line((p1, (p1[0] + 14 * math.cos(ang + off), p1[1] + 14 * math.sin(ang + off))),
               fill=color, width=3)
    if not label:
        return
    mx, my = (p0[0] + p1[0]) // 2, (p0[1] + p1[1]) // 2
    lines = label.split("\n")
    lh = lf.size + 4
    total = lh * len(lines)
    widest = max(d.textlength(ln, font=lf) for ln in lines)
    d.rectangle((mx - widest / 2 - 7, my - total / 2 - 3,
                 mx + widest / 2 + 7, my + total / 2 - 3), fill=bg)
    ty = my - total / 2
    for ln in lines:
        d.text((mx - d.textlength(ln, font=lf) / 2, ty), ln, font=lf, fill=color)
        ty += lh


def main() -> int:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    f_title = font(30, bold=True)
    f_head = font(19, bold=True)
    f_body = font(15)
    f_small = font(13)
    f_arrow = font(14, bold=True)

    d.text((40, 22), "Zero-Trust Starter Kit · 架构与请求链路", font=f_title, fill=INK)
    d.text((40, 62), "组件 / 端口 / 阈值取自 docker-compose.yml 与 src 源码　·　默认拒绝，短期令牌，数据不出内网",
           font=f_small, fill=MUTED)

    # 左：浏览器
    browser = Box(30, 150, 240, "浏览器（用户）",
                  ["Next.js 客户端页面", "/  ·  /dashboard", "/admin 需 admin 角色"],
                  BLUE, f_head, f_body)

    # 中：app 容器（内含三道关卡，垂直堆叠）
    inner_x, inner_w = 355, 370
    g1 = Box(inner_x, 0, inner_w, "① 限流",
             ["Redis 滑动窗口", "120 次 / 60 秒，超限 429"], ORANGE, f_head, f_body)
    g2 = Box(inner_x, 0, inner_w, "② 鉴权 + 设备绑定",
             ["OIDC 授权码 + PKCE", "会话 JWT 15 分钟 TTL", "UA / IP 上下文不符即拒"], GREEN, f_head, f_body)
    g3 = Box(inner_x, 0, inner_w, "③ RBAC + 审计",
             ["member / auditor / admin", "记 actor·action·ip·ok", "DB 不可用走内存兜底"], RED, f_head, f_body)

    top = 150
    gap = 16
    g1.y0 = g1.y1 = 0
    cursor = top
    for g in (g1, g2, g3):
        g.y0 = cursor
        g.y1 = cursor + g.h
        cursor = g.y1 + gap
    app_bottom = cursor - gap + 20

    # 右：外部依赖
    rx, rw = 900, 340
    keycloak = Box(rx, 110, rw, "Keycloak :8080",
                   ["IdP，realm 启动时自动导入", "演示账号 demo / demo1234"], BLUE, f_head, f_body)
    redis = Box(rx, keycloak.y1 + 22, rw, "Redis :6379", ["限流计数"], ORANGE, f_head, f_body)
    pg = Box(rx, redis.y1 + 22, rw, "Postgres :5432", ["审计日志持久化"], RED, f_head, f_body)
    ollama = Box(rx, pg.y1 + 22, rw, "Ollama :11434",
                 ["本地 LLM 流式问答", "qwen2.5:7b　数据不出内网"], GREEN, f_head, f_body)

    # app 外框
    d.rounded_rectangle((330, 110, 750, app_bottom), radius=14, outline=BLUE, width=3)
    d.text((350, 122), "app · Next.js :3000", font=f_head, fill=BLUE)
    d.text((350, 122 + f_head.size + 6), "每个 API 都过 protect()（src/lib/security/require.ts）",
           font=f_small, fill=MUTED)

    for b in (browser, g1, g2, g3, keycloak, redis, pg, ollama):
        b.draw(d)

    # 箭头：浏览器 → app
    arrow(d, (browser.x1, browser.cy), (330, browser.cy), BLUE, "登录", f_arrow)
    # app 内三道关卡之间的串联
    arrow(d, (inner_x + inner_w // 2, g1.y1), (inner_x + inner_w // 2, g2.y0), MUTED, "", f_arrow)
    arrow(d, (inner_x + inner_w // 2, g2.y1), (inner_x + inner_w // 2, g3.y0), MUTED, "", f_arrow)
    # app → 外部依赖
    arrow(d, (750, g2.cy), (rx, keycloak.cy), BLUE, "token 交换", f_arrow)
    arrow(d, (750, g1.cy), (rx, redis.cy), ORANGE, "INCR", f_arrow)
    arrow(d, (750, g3.cy), (rx, pg.cy), RED, "audit append", f_arrow)
    arrow(d, (750, app_bottom - 12), (rx, ollama.cy), GREEN, "/api/chat 流式", f_arrow)

    # 底部：请求链路 + 安全默认值
    y = max(app_bottom, ollama.y1) + 34
    d.line((40, y - 14, 1240, y - 14), fill=(226, 232, 240), width=2)
    d.text((40, y), "请求链路　浏览器 → ① 限流 → ② 短期令牌 + 设备绑定 → ③ RBAC 判定 → 业务处理 → 审计落库",
           font=f_body, fill=INK)
    d.text((40, y + 30), "默认拒绝　未登录访问 /api/dashboard → 401　　member 访问 /admin → 403　　高频调用 → 429",
           font=f_body, fill=(71, 85, 105))
    d.text((40, y + 60), "一键启动　docker compose up -d　拉起 app + db + redis + keycloak + ollama 五服务",
           font=f_body, fill=(71, 85, 105))

    img.save(OUT)
    print("saved:", OUT, os.path.getsize(OUT), "bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
