-- Verification migration: ensure no plaintext MFA secrets remain
-- This will fail the migration if any plaintext secrets exist alongside encrypted ones

DO $$
DECLARE
    plaintext_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO plaintext_count 
    FROM mfa_secrets 
    WHERE secret IS NOT NULL AND secret_enc IS NOT NULL;
    
    IF plaintext_count > 0 THEN
        RAISE EXCEPTION 'Found % MFA secrets with both plaintext and encrypted values. Run cleanup migration first.', plaintext_count;
    END IF;
    
    RAISE NOTICE 'MFA cleanup verification passed: no plaintext secrets found with encrypted counterparts';
END $$;
