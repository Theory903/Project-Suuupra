-- Remove NOT NULL constraint on plaintext secret and backfill encrypted-only storage
ALTER TABLE mfa_secrets ALTER COLUMN secret DROP NOT NULL;
-- Optionally, null out plaintext where encrypted value exists
UPDATE mfa_secrets SET secret = NULL WHERE secret_enc IS NOT NULL;

