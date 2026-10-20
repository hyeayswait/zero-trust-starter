#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""scripts/build_gif.py —— 把 docs/frames/*.png 拼成 README 用的 GIF。

本机只要有 Python + Pillow 就能跑（不需要 Node/Docker）。

    python scripts/build_gif.py                 # 默认 1280 宽、每帧 1.2s
    python scripts/build_gif.py --width 960 --duration 1000 --max-mb 2.5

输出 docs/demo.gif。若超过 --max-mb，自动降宽 + 减色重压。
"""
from __future__ import annotations

import argparse
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("需要 Pillow：pip install Pillow")


def load_frames(frame_dir: str):
    names = sorted(
        f for f in os.listdir(frame_dir)
        if f.lower().endswith(".png") and not f.startswith("README")
    )
    imgs = []
    for name in names:
        try:
            with Image.open(os.path.join(frame_dir, name)) as im:
                imgs.append((name, im.convert("RGB")))
        except Exception as exc:
            print("跳过 %s: %s" % (name, exc))
    return imgs


def render(imgs, width: int, duration: int, out_path: str) -> int:
    frames = []
    for _name, im in imgs:
        ratio = width / float(im.width)
        h = max(1, int(im.height * ratio))
        frames.append(im.resize((width, h), Image.LANCZOS).convert("P", palette=Image.ADAPTIVE, colors=128))
    frames[0].save(out_path, save_all=True, append_images=frames[1:],
                   duration=duration, loop=0, optimize=True, disposal=2)
    return os.path.getsize(out_path)


def main() -> int:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser(description="把帧图拼成 demo.gif")
    ap.add_argument("--frames", default=os.path.join(root, "docs", "frames"))
    ap.add_argument("--out", default=os.path.join(root, "docs", "demo.gif"))
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--duration", type=int, default=1200, help="每帧毫秒")
    ap.add_argument("--max-mb", type=float, default=3.0)
    args = ap.parse_args()

    if not os.path.isdir(args.frames):
        sys.exit("帧目录不存在：%s（先在能跑 docker 的机器执行 capture-demo.mjs）" % args.frames)
    imgs = load_frames(args.frames)
    if len(imgs) < 2:
        sys.exit("帧太少（%d），至少 2 张" % len(imgs))
    print("帧：%s" % ", ".join(n for n, _ in imgs))

    width = args.width
    size = render(imgs, width, args.duration, args.out)
    # 超预算就逐级降宽
    while size / 1048576.0 > args.max_mb and width > 480:
        width -= 160
        size = render(imgs, width, args.duration, args.out)
        print("  超预算，降到 %d 宽 -> %.2f MB" % (width, size / 1048576.0))

    print("已生成 %s（%d 宽，%.2f MB，%d 帧）" % (args.out, width, size / 1048576.0, len(imgs)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
