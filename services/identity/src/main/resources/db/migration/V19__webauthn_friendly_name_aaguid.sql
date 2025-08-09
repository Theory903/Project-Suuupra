ALTER TABLE webauthn_credentials
  ADD COLUMN IF NOT EXISTS friendly_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS aaguid UUID;


