import { Pool } from "pg";

let _pool: Pool | null = null;

// 无 DATABASE_URL（演示模式）时不建连接池，避免每次请求都尝试连接并抛错。
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function pool(): Pool {
  if (!hasDatabase()) {
    throw new Error("DATABASE_URL 未配置");
  }
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // 避免未处理的 error 事件把进程打挂
    _pool.on("error", (err: Error) => console.warn("[DB]", err.message));
  }
  return _pool;
}
