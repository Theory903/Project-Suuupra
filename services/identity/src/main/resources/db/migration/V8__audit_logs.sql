CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY,
  ts TIMESTAMP NOT NULL,
  action VARCHAR(100) NOT NULL,
  actor_user_id UUID,
  actor_email VARCHAR(255),
  target_user_id UUID,
  tenant_id VARCHAR(255),
  detail_json TEXT,
  ip VARCHAR(100),
  ua TEXT,
  prev_hash VARCHAR(128),
  hash VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(ts);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
