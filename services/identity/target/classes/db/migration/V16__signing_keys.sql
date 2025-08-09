-- Signing keys for JWT (supports dual-key rotation)
CREATE TABLE IF NOT EXISTS signing_keys (
  kid VARCHAR(64) PRIMARY KEY,
  alg VARCHAR(16) NOT NULL DEFAULT 'ES256',
  public_pem TEXT NOT NULL,
  private_pem_enc BYTEA NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


