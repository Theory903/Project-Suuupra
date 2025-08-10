-- Convert mfa_secrets.secret_enc from BYTEA to OID (Large Object) to match Hibernate @Lob mapping
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mfa_secrets' AND column_name = 'secret_enc'
  ) THEN
    BEGIN
      ALTER TABLE mfa_secrets
        ALTER COLUMN secret_enc TYPE OID USING pg_catalog.lo_from_bytea(0, secret_enc);
    EXCEPTION WHEN undefined_function THEN
      -- Fallback: keep as BYTEA if conversion function not available
      RAISE NOTICE 'lo_from_bytea() not available; leaving secret_enc as BYTEA';
    END;
  END IF;
END $$;


