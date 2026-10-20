export interface AuditEntry {
  actor: string;
  action: string;
  ip: string;
  ok: boolean;
  ts: string;
  meta?: Record<string, unknown>;
}
