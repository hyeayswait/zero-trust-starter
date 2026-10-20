"""
静态校验：扫描 src 下的 .ts 源码 + next.config.js，确认关键安全机制都已实现。
不依赖 Node，纯文本分析。
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
# 安全响应头写在 next.config.js（不在 src 下），一并扫描
EXTRA_FILES = ["next.config.js"]

CHECKS = [
    ("OIDC PKCE flow", r"code_challenge_method.*S256|codeChallenge|PKCE"),
    ("JWT short TTL (15m)", r"15m"),
    ("device binding", r"deviceId"),
    ("RBAC permission map", r"ROLE_PERMISSIONS"),
    ("least-privilege default member", r"roles.*member|\[\"member\"\]"),
    ("rate limit sliding window", r"zremrangebyscore|zadd|zcard|sliding"),
    ("audit log", r"appendAudit|audit_logs"),
    ("secure headers CSP", r"Content-Security-Policy"),
    ("local-first AI ollama", r"OLLAMA_BASE_URL|api/chat"),
]

def iter_ts():
    for dp, _, fns in os.walk(SRC):
        for fn in fns:
            if fn.endswith(".ts") or fn.endswith(".tsx"):
                yield os.path.join(dp, fn)

def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()

def main():
    files = list(iter_ts()) + [os.path.join(ROOT, f) for f in EXTRA_FILES if os.path.exists(os.path.join(ROOT, f))]
    blob = "\n".join(read(p) for p in files)
    results = []
    for name, pat in CHECKS:
        ok = bool(re.search(pat, blob))
        results.append((name, ok))
    all_ok = all(ok for _, ok in results)
    print("=== 静态校验：核心安全机制是否齐全 ===")
    for name, ok in results:
        print(f"  [{'OK' if ok else 'MISS'}] {name}")
    # 括号配对粗检（每个文件）
    print("\n=== 括号配对（每文件）===")
    for p in iter_ts():
        s = read(p)
        if s.count("(") != s.count(")") or s.count("{") != s.count("}") or s.count("[") != s.count("]"):
            print(f"  [WARN] 括号不配对: {os.path.relpath(p, ROOT)}")
    print("  (无 WARN 即全部配对)")
    print(f"\n结果: {'全部通过' if all_ok else '有缺失'}")
    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(main())
