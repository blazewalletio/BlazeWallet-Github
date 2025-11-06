-- ============================================================================
-- 🔐 SCHEDULED TRANSACTIONS - ENCRYPTED AUTH UPGRADE
-- ============================================================================
-- Adds encrypted authorization storage for time-limited transaction signing
-- ============================================================================

-- Add encrypted_auth column to scheduled_transactions
ALTER TABLE scheduled_transactions 
ADD COLUMN IF NOT EXISTS encrypted_auth JSONB;

-- Add comment
COMMENT ON COLUMN scheduled_transactions.encrypted_auth IS 'Time-limited encrypted mnemonic for automatic execution. Auto-deleted after execution or expiry.';

-- ============================================================================
-- AUDIT LOGS TABLE
-- ============================================================================
-- Tracks all sensitive operations for security monitoring

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Action details
  action TEXT NOT NULL,  -- e.g., 'decrypt_scheduled_auth', 'execute_transaction'
  resource_type TEXT,    -- e.g., 'scheduled_transaction'
  resource_id TEXT,      -- Transaction ID or other resource
  
  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Auto-delete old audit logs after 90 days
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CLEANUP FUNCTIONS
-- ============================================================================

-- Cleanup expired encrypted_auth data
CREATE OR REPLACE FUNCTION cleanup_expired_auth()
RETURNS void AS $$
BEGIN
  -- Clear auth for completed/failed/cancelled transactions
  UPDATE scheduled_transactions
  SET encrypted_auth = NULL
  WHERE encrypted_auth IS NOT NULL
    AND status IN ('completed', 'failed', 'cancelled', 'expired');
  
  -- Clear auth that has expired (time-based)
  UPDATE scheduled_transactions
  SET encrypted_auth = NULL
  WHERE encrypted_auth IS NOT NULL
    AND (encrypted_auth->>'expires_at')::timestamp < NOW();
    
  RAISE NOTICE 'Cleaned up expired auth data';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEDULED JOBS (via pg_cron)
-- ============================================================================

-- Cleanup expired auth every hour
SELECT cron.schedule(
  'cleanup-expired-auth',
  '0 * * * *',  -- Every hour
  $$SELECT cleanup_expired_auth();$$
);

-- Cleanup old audit logs daily
SELECT cron.schedule(
  'cleanup-old-audit-logs',
  '0 2 * * *',  -- Every day at 2 AM UTC
  $$SELECT cleanup_old_audit_logs();$$
);

-- ============================================================================
-- RLS POLICIES FOR AUDIT LOGS
-- ============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users cannot read audit logs (admin only)
CREATE POLICY "audit_logs_no_user_access" ON audit_logs
  FOR SELECT
  USING (false);  -- No user access

-- System can insert
CREATE POLICY "audit_logs_system_insert" ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- VERIFY MIGRATION
-- ============================================================================

DO $$
BEGIN
  -- Check if encrypted_auth column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scheduled_transactions' 
    AND column_name = 'encrypted_auth'
  ) THEN
    RAISE EXCEPTION 'Migration failed: encrypted_auth column not found';
  END IF;
  
  -- Check if audit_logs table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'audit_logs'
  ) THEN
    RAISE EXCEPTION 'Migration failed: audit_logs table not found';
  END IF;
  
  RAISE NOTICE '✅ Migration successful: encrypted auth upgrade complete';
END $$;

