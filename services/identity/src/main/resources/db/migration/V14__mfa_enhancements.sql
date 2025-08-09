-- MFA enhancements: encrypt secrets, backup codes, user flags

ALTER TABLE mfa_secrets
  ADD COLUMN IF NOT EXISTS secret_enc BYTEA,
  ADD COLUMN IF NOT EXISTS alg VARCHAR(16) DEFAULT 'SHA1',
  ADD COLUMN IF NOT EXISTS digits INTEGER DEFAULT 6,
  ADD COLUMN IF NOT EXISTS period INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS drift_window INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS device_binding_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS kek_version INTEGER DEFAULT 1;

-- Optional: for legacy plaintext secret migration
ALTER TABLE mfa_secrets
  ADD COLUMN IF NOT EXISTS migrated BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recovery_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recovery_user ON recovery_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_unused ON recovery_codes(user_id) WHERE used_at IS NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_enforced BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMP NULL;


