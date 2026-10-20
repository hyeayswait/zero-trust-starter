"""
逻辑单测：用 Python 等价复现项目的核心安全算法并断言。
证明设计逻辑正确（与语言无关）。
运行: python tests/logic_test.py
"""
import time, re, sys, io

# Windows 控制台默认 gbk，强制 utf-8 输出，避免特殊符号编码崩溃
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
else:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# ---------- 1. RBAC 最小权限 ----------
ROLE_PERMISSIONS = {
    "admin":  ["dashboard:read","admin:read","admin:write","audit:read","chat:use"],
    "member": ["dashboard:read","chat:use"],
    "auditor":["dashboard:read","audit:read"],
}
def has_permission(roles, perm):
    return any(perm in ROLE_PERMISSIONS[r] for r in roles)

# ---------- 2. 滑动窗口限流 ----------
class SlidingWindow:
    def __init__(self): self.hits = []
    def allow(self, now, max_n, window):
        self.hits = [t for t in self.hits if t > now - window]
        if len(self.hits) < max_n:
            self.hits.append(now); return True
        return False

# ---------- 3. RAG 朴素关键词检索 ----------
class Rag:
    def __init__(self): self.chunks = []
    def ingest(self, text):
        self.chunks = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    def retrieve(self, query, top_k=3):
        q = query.lower()
        scored = []
        for c in self.chunks:
            score = sum(1 for w in c.lower().split() if w in q)
            scored.append((score, c))
        scored.sort(key=lambda x: -x[0])
        return [c for s, c in scored[:top_k] if s > 0]

# ---------- 4. 零信任会话校验（设备绑定 + 短 TTL）----------
def verify_session(session, req_device, now):
    if session["exp"] < now:           # 短 TTL 过期
        return "EXPIRED"
    if session["deviceId"] != req_device:  # 设备不一致 = 盗用
        return "DEVICE_MISMATCH"
    return "OK"

# ---------- 断言 ----------
def assert_eq(name, got, exp):
    status = "OK" if got == exp else "FAIL"
    print(f"  [{status}] {name}: got={got} exp={exp}")
    return got == exp

def main():
    ok = True
    print("=== 1. RBAC 最小权限 ===")
    ok &= assert_eq("admin 可 admin:write", has_permission(["admin"], "admin:write"), True)
    ok &= assert_eq("member 不可 admin:write", has_permission(["member"], "admin:write"), False)
    ok &= assert_eq("auditor 可 audit:read", has_permission(["auditor"], "audit:read"), True)
    ok &= assert_eq("auditor 不可 chat:use", has_permission(["auditor"], "chat:use"), False)
    ok &= assert_eq("新用户默认 member 无管理员权限", has_permission(["member"], "admin:read"), False)

    print("=== 2. 滑动窗口限流 ===")
    sw = SlidingWindow()
    now = 1000
    allowed = sum(1 for _ in range(5) if sw.allow(now, max_n=3, window=60))
    ok &= assert_eq("3 次内全放行", allowed, 3)
    ok &= assert_eq("第 4 次被限流", sw.allow(now, max_n=3, window=60), False)
    ok &= assert_eq("窗口滑过后恢复", sw.allow(now+61, max_n=3, window=60), True)

    print("=== 3. RAG 检索 ===")
    rag = Rag()
    rag.ingest("密码不应明文存储。\n\nOIDC 使用 PKCE 防截获。\n\n限流用滑动窗口。")
    res = rag.retrieve("OIDC PKCE")
    ok &= assert_eq("检索命中 PKCE 段落", "PKCE" in (res[0] if res else ""), True)
    ok &= assert_eq("无关查询返回空", rag.retrieve("区块链"), [])

    print("=== 4. 零信任会话校验 ===")
    sess = {"exp": 2000, "deviceId": "dev-A"}
    ok &= assert_eq("正常设备+未过期", verify_session(sess, "dev-A", now=1500), "OK")
    ok &= assert_eq("令牌过期被拒", verify_session(sess, "dev-A", now=2500), "EXPIRED")
    ok &= assert_eq("设备不一致被拒(盗用)", verify_session(sess, "dev-B", now=1500), "DEVICE_MISMATCH")

    print(f"\n结果: {'ALL PASS' if ok else 'HAS FAILURE'}")
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
