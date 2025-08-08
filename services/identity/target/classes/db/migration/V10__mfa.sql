ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;

-- Ensure one MFA secret per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_mfa_secrets_user ON mfa_secrets(user_id);

