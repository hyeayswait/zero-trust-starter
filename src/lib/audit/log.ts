import { pool } from "./db";
import type { AuditEntry } from "./types";

const buf: AuditEntry[] = []; // 兜底缓存，DB 不可用时仍不丢记录

export async function appendAudit(e: Omit<AuditEntry, "ts">): Promise<void> {
  const entry: AuditEntry = { ...e, ts: new Date().toISOString() };
  buf.push(entry);
  try {
    await pool().query(
      `INSERT INTO audit_logs (actor, action, ip, ok, meta, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [e.actor, e.action, e.ip, e.ok, JSON.stringify(e.meta ?? {}), entry.ts]
    );
  } catch (err) {
    console.error("[AUDIT][DB-FALLBACK]", (err as Error).message);
  }
  console.log("[AUDIT]", JSON.stringify(entry));
}

export async function recentAudits(n = 50): Promise<AuditEntry[]> {
  try {
    const r = await pool().query(
      `SELECT actor, action, ip, ok, meta, created_at AS ts
       FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
      [n]
    );
    return r.rows.map((row) => ({
      actor: row.actor, action: row.action, ip: row.ip,
      ok: row.ok, meta: row.meta, ts: row.ts,
    }));
  } catch {
    return buf.slice(-n);
  }
}
