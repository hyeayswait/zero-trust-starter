#!/usr/bin/env bash
# 启动后的冒烟测试：健康检查 + 未登录访问受保护接口应 401
set -e
BASE="${BASE_URL:-http://localhost:3000}"
echo "==> 健康检查"
curl -fsS "$BASE/api/health" && echo " [health ok]"

echo "==> 未登录访问 /api/dashboard（期望 401）"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/dashboard")
if [ "$code" = "401" ]; then echo " [auth guard ok: 401]"; else echo " [WARN] 期望 401 实际 $code"; fi

echo "==> 未登录访问 /api/chat（期望 401）"
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/chat" -H 'Content-Type: application/json' -d '{"messages":[]}')
if [ "$code" = "401" ]; then echo " [auth guard ok: 401]"; else echo " [WARN] 期望 401 实际 $code"; fi

echo "==> 限流测试（快速 200 次 /api/health 应出现 429）"
for i in $(seq 1 200); do
  c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health")
  if [ "$c" = "429" ]; then echo " [rate limit ok: 429 at #$i]"; break; fi
done
echo "==> 验证完成"
