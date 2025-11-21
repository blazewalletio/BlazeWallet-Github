-- ============================================
-- 🔧 SAFE FIX - Add Missing Table & Trigger
-- ============================================
-- This script ONLY adds what's missing, doesn't touch existing data
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================

DO $$ 
BEGIN
  RAISE NOTICE '🔧 Starting safe fix for missing items...';
END $$;

-- ====================================
-- FIX 1: Add failed_login_attempts table (if missing)
-- ====================================

CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_identifier VARCHAR(255) NOT NULL, -- Email or wallet address
  attempt_count INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  ip_address VARCHAR(45), -- IPv4 or IPv6
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_identifier)
);

-- Create indexes (IF NOT EXISTS doesn't work for indexes, so use DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_failed_login_user') THEN
    CREATE INDEX idx_failed_login_user ON public.failed_login_attempts(user_identifier);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_failed_login_locked') THEN
    CREATE INDEX idx_failed_login_locked ON public.failed_login_attempts(locked_until) WHERE locked_until IS NOT NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- Add RLS policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own failed attempts" ON public.failed_login_attempts;
DROP POLICY IF EXISTS "Service role full access on failed_login_attempts" ON public.failed_login_attempts;

CREATE POLICY "Users can view their own failed attempts"
  ON public.failed_login_attempts FOR SELECT
  TO authenticated
  USING (
    user_identifier IN (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Service role full access on failed_login_attempts"
  ON public.failed_login_attempts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$ 
BEGIN
  RAISE NOTICE '✅ Table: failed_login_attempts checked/created';
END $$;

-- ====================================
-- FIX 2: Add update_transaction_notes_updated_at trigger (if missing)
-- ====================================

-- First, ensure the function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (to recreate with correct name)
DROP TRIGGER IF EXISTS update_transaction_notes_updated_at ON public.transaction_notes;
DROP TRIGGER IF EXISTS update_transaction_note_timestamp ON public.transaction_notes;

-- Create trigger with correct name
CREATE TRIGGER update_transaction_notes_updated_at
  BEFORE UPDATE ON public.transaction_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DO $$ 
BEGIN
  RAISE NOTICE '✅ Trigger: update_transaction_notes_updated_at created';
END $$;

-- ====================================
-- VERIFICATION
-- ====================================

DO $$
DECLARE
  v_table_count INTEGER;
  v_trigger_count INTEGER;
BEGIN
  -- Count expected tables
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND information_schema.tables.table_name IN (
    'email_verification_tokens',
    'user_profiles',
    'user_activity_log',
    'trusted_devices',
    'user_security_scores',
    'user_transaction_stats',
    'transaction_notes',
    'failed_login_attempts'
  );
  
  -- Count expected triggers
  SELECT COUNT(*) INTO v_trigger_count
  FROM information_schema.triggers
  WHERE information_schema.triggers.trigger_name IN (
    'update_user_profiles_updated_at',
    'update_security_scores_updated_at',
    'update_transaction_notes_updated_at',
    'on_auth_user_created'
  );
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '🔥 SAFE FIX COMPLETE';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📋 Tables present: %/8', v_table_count;
  RAISE NOTICE '🔄 Triggers present: %/4', v_trigger_count;
  RAISE NOTICE '';
  
  IF v_table_count = 8 AND v_trigger_count = 4 THEN
    RAISE NOTICE '✅ All issues fixed! Database is now complete.';
  ELSE
    RAISE NOTICE '⚠️  Some issues remain. Run verification again.';
  END IF;
  
  RAISE NOTICE '============================================';
END $$;

