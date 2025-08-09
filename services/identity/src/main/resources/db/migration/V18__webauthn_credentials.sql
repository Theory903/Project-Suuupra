CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_handle BYTEA NOT NULL,
  credential_id VARCHAR(512) UNIQUE NOT NULL,
  public_key_cose VARCHAR(2048) NOT NULL,
  sign_count BIGINT DEFAULT 0,
  attestation_type VARCHAR(100),
  transports VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_webauthn_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user ON webauthn_credentials(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_webauthn_user_handle ON webauthn_credentials(user_handle);


