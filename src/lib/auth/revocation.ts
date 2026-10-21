import Redis from "ioredis";

/**
 * 会话撤销表（token denylist）。
 *
 * 零信任要求「始终验证」，但纯 JWT 有一个致命弱点：签发后到期前无法撤销。
 * 员工离职、密码泄露、设备丢失时，攻击者仍可用旧 token 访问直到过期。
 * 因此 JWT 写入 jti，登出/踢出时把 jti 记入撤销表，校验时先查表。
 *
 * 存储策略：
 *  - 生产：Redis（多实例共享），SETEX 随 TTL 自动过期
 *  - 降级：Redis 不可用时用进程内 Map（单实例有效，多实例需 Redis）
 */

let _r: Redis | null = null;
let redisBroken = false;

function redis(): Redis | null {
  if (redisBroken) return null;
  if (_r) return _r;
  try {
    _r = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      connectTimeout: 1200,
      retryStrategy: () => null,
    });
    _r.on("error", () => {
      redisBroken = true;
    });
  } catch {
    redisBroken = true;
    return null;
  }
  return _r;
}

const memory = new Map<string, number>();

function sweep() {
  const now = Date.now();
  for (const [k, exp] of memory) {
    if (exp <= now) memory.delete(k);
  }
}

const watermark: Record<string, number> = {};

/** 撤销一个 token（按 jti），ttlSeconds 应等于 token 剩余有效期 */
export async function revoke(jti: string, ttlSeconds: number): Promise<void> {
  if (!jti || ttlSeconds <= 0) return;
  const r = redis();
  if (r) {
    try {
      await r.setex(`revoked:${jti}`, ttlSeconds, "1");
      return;
    } catch {
      redisBroken = true;
    }
  }
  memory.set(jti, Date.now() + ttlSeconds * 1000);
  if (memory.size > 10000) sweep();
}

/** 判断 token 是否已被撤销 */
export async function isRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  const r = redis();
  if (r) {
    try {
      const v = await r.exists(`revoked:${jti}`);
      return v === 1;
    } catch {
      redisBroken = true;
    }
  }
  const exp = memory.get(jti);
  if (exp === undefined) return false;
  if (exp <= Date.now()) {
    memory.delete(jti);
    return false;
  }
  return true;
}

/** 撤销某用户全部会话：记录撤销水位，早于该时间签发的 token 一律失效 */
export async function revokeAllForUser(sub: string, ttlSeconds: number): Promise<void> {
  const now = Date.now();
  const r = redis();
  if (r) {
    try {
      await r.setex(`revoked-all:${sub}`, ttlSeconds, String(now));
      return;
    } catch {
      redisBroken = true;
    }
  }
  watermark[sub] = now;
}

/** 用户级撤销水位：token 签发时间早于此值则失效 */
export async function revocationWatermark(sub: string): Promise<number | null> {
  const r = redis();
  if (r) {
    try {
      const v = await r.get(`revoked-all:${sub}`);
      return v ? Number(v) : null;
    } catch {
      redisBroken = true;
    }
  }
  return watermark[sub] ?? null;
}

/** 测试用：重置内存态 */
export function _resetMemory(): void {
  memory.clear();
  for (const k of Object.keys(watermark)) delete watermark[k];
}
