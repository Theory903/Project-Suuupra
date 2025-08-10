-- Ensure no plaintext MFA secrets remain when encrypted value exists
UPDATE mfa_secrets SET secret = NULL WHERE secret IS NOT NULL AND secret_enc IS NOT NULL;

