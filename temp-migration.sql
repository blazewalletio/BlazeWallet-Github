-- ============================================================================
-- 🔐 SCHEDULED TRANSACTIONS - ENCRYPTED AUTH UPGRADE
-- ============================================================================

-- Add encrypted_auth column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scheduled_transactions' 
    AND column_name = 'encrypted_auth'
  ) THEN
    ALTER TABLE scheduled_transactions ADD COLUMN encrypted_auth JSONB;
  END IF;
END $$;

-- ============================================================================
-- AUDIT LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- RLS for audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_no_user_access" ON audit_logs;
CREATE POLICY "audit_logs_no_user_access" ON audit_logs
  FOR SELECT USING (false);

DROP POLICY IF EXISTS "audit_logs_system_insert" ON audit_logs;
CREATE POLICY "audit_logs_system_insert" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- CLEANUP FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_auth()
RETURNS void AS $$
BEGIN
  UPDATE scheduled_transactions
  SET encrypted_auth = NULL
  WHERE encrypted_auth IS NOT NULL
    AND status IN ('completed', 'failed', 'cancelled', 'expired');
  
  UPDATE scheduled_transactions
  SET encrypted_auth = NULL
  WHERE encrypted_auth IS NOT NULL
    AND (encrypted_auth->>'expires_at')::timestamp < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration successful: encrypted auth upgrade complete';
END $$;
