import Redis from "ioredis";

// 进程内滑动窗口：DEMO_MODE=1 或 Redis 不可用时兜底，
// 保证鉴权/权限链路不因为缓存故障整体不可用（限流降级，不降级鉴权）。
const MEM: Map<string, number[]> = new Map();

function memoryLimit(key: string, max: number, windowSec: number) {
  const now = Date.now();
  const floor = now - windowSec * 1000;
  const arr = (MEM.get(key) ?? []).filter((t) => t > floor);
  arr.push(now);
  MEM.set(key, arr);
  if (MEM.size > 5000) MEM.clear(); // 防内存无限增长
  return { allowed: arr.length <= max, remaining: Math.max(0, max - arr.length) };
}

let _r: Redis | null = null;
function redis() {
  if (!_r) {
    _r = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
      lazyConnect: false,
      retryStrategy: () => null, // 不无限重连
    });
    // 避免未处理的 error 事件把进程打挂
    _r.on("error", (e: Error) => console.warn("[RATE-LIMIT] redis unavailable:", e.message));
  }
  return _r;
}

// 滑动窗口限流：每 key 每窗口最多 max 次
export async function rateLimit(
  key: string,
  max = 60,
  windowSec = 60
): Promise<{ allowed: boolean; remaining: number }> {
  if (process.env.DEMO_MODE === "1" || process.env.RATE_LIMIT_BACKEND === "memory") {
    return memoryLimit(key, max, windowSec);
  }

  const r = redis();
  const now = Date.now();
  const cleanKey = `rl:${key}`;
  try {
    const pipeline = r.multi();
    pipeline.zremrangebyscore(cleanKey, 0, now - windowSec * 1000);
    pipeline.zadd(cleanKey, now, `${now}-${Math.random()}`);
    pipeline.zcard(cleanKey);
    pipeline.pexpire(cleanKey, windowSec * 1000);
    const res = await pipeline.exec();
    const count = (res?.[2]?.[1] as number) ?? 0;
    return { allowed: count <= max, remaining: Math.max(0, max - count) };
  } catch (err) {
    // Redis 故障时不阻断业务：降级为进程内窗口，并显式告警
    console.warn("[RATE-LIMIT] fallback to memory:", (err as Error).message);
    return memoryLimit(key, max, windowSec);
  }
}
