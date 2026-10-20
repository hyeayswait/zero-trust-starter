import Redis from "ioredis";

let _r: Redis | null = null;
function redis() {
  if (!_r) _r = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  return _r;
}

// 滑动窗口限流：每 key 每窗口最多 max 次
export async function rateLimit(
  key: string,
  max = 60,
  windowSec = 60
): Promise<{ allowed: boolean; remaining: number }> {
  const r = redis();
  const now = Date.now();
  const cleanKey = `rl:${key}`;
  const pipeline = r.multi();
  pipeline.zremrangebyscore(cleanKey, 0, now - windowSec * 1000);
  pipeline.zadd(cleanKey, now, `${now}-${Math.random()}`);
  pipeline.zcard(cleanKey);
  pipeline.pexpire(cleanKey, windowSec * 1000);
  const res = await pipeline.exec();
  const count = (res?.[2]?.[1] as number) ?? 0;
  return { allowed: count <= max, remaining: Math.max(0, max - count) };
}
