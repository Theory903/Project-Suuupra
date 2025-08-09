-- Add policy mode to support draft/dry-run/enforce
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS mode VARCHAR(16) NOT NULL DEFAULT 'enforce';

-- Optional notes for auditability
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS notes TEXT;


