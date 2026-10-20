-- 审计日志表：零信任可观测性的持久化核心
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  actor       TEXT NOT NULL,         -- 用户 sub 或 "anonymous"
  action      TEXT NOT NULL,         -- 访问的路径 / 操作名
  ip          TEXT NOT NULL,
  ok          BOOLEAN NOT NULL,
  meta        JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_logs (actor);
