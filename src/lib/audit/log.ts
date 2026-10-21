import { hasDatabase, pool } from "./db";
import type { AuditEntry } from "./types";

const buf: AuditEntry[] = []; // 兜底缓存，DB 不可用时仍不丢记录

let dbWarned = false;

export async function appendAudit(e: Omit<AuditEntry, "ts">): Promise<void> {
  const entry: AuditEntry = { ...e, ts: new Date().toISOString() };
  buf.push(entry);
  if (buf.length > 500) buf.shift(); // 防内存无限增长

  if (hasDatabase()) {
    try {
      await pool().query(
        `INSERT INTO audit_logs (actor, action, ip, ok, meta, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [e.actor, e.action, e.ip, e.ok, JSON.stringify(e.meta ?? {}), entry.ts]
      );
    } catch (err) {
      if (!dbWarned) {
        console.warn("[AUDIT][DB-FALLBACK] 数据库不可用，审计日志转为内存缓冲：", (err as Error).message);
        dbWarned = true;
      }
    }
  }
  console.log("[AUDIT]", JSON.stringify(entry));
}

export async function recentAudits(n = 50): Promise<AuditEntry[]> {
  if (!hasDatabase()) return buf.slice(-n).reverse();

  try {
    const r = await pool().query(
      `SELECT actor, action, ip, ok, meta, created_at AS ts
       FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
      [n]
    );
    return r.rows.map((row: Record<string, unknown>) => ({
      actor: row.actor as string,
      action: row.action as string,
      ip: row.ip as string,
      ok: row.ok as boolean,
      meta: row.meta as Record<string, unknown> | undefined,
      ts: row.ts as string,
    }));
  } catch {
    return buf.slice(-n).reverse();
  }
}
