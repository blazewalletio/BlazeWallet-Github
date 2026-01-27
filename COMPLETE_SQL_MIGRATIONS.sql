-- ============================================================================
-- 🚀 BLAZE WALLET - COMPLETE RLS MIGRATION BUNDLE
-- ============================================================================
-- Run dit volledige script in Supabase SQL Editor
-- Date: 2026-01-27
-- Purpose: Fix all RLS policies for Hybrid (Optie C) implementation
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: Fix address_book RLS (CRITICAL - Data Leak Fix!)
-- ============================================================================
-- Removes overly permissive "OR true" policy

DROP POLICY IF EXISTS "Users can view their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.address_book;

-- ✅ Proper secure policies
CREATE POLICY "Users can view their own contacts"
  ON public.address_book FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own contacts"
  ON public.address_book FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own contacts"
  ON public.address_book FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON public.address_book FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

ALTER TABLE public.address_book ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.address_book IS 'User contact address book. RLS ensures users can only access their own contacts. NO anon access, NO OR true bypass.';

-- ============================================================================
-- MIGRATION 2: Verify/Fix onramp_transactions RLS
-- ============================================================================

DROP POLICY IF EXISTS "Users can read their own transactions" ON public.onramp_transactions;
DROP POLICY IF EXISTS "Service role can manage transactions" ON public.onramp_transactions;

CREATE POLICY "Users can read their own transactions"
  ON public.onramp_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage transactions"
  ON public.onramp_transactions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.onramp_transactions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.onramp_transactions IS 'Onramp purchase transactions. Users can only read their own. Webhooks use service role to insert/update.';

-- ============================================================================
-- MIGRATION 3: Fix wallets RLS
-- ============================================================================
-- Ensures wallets table has proper RLS policies (needed for client queries in emergency)

DROP POLICY IF EXISTS "Users can read their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Service role can manage wallets" ON public.wallets;

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- ✅ Users can read their own wallet
CREATE POLICY "Users can read their own wallet"
  ON public.wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ✅ Users can update their own wallet
CREATE POLICY "Users can update their own wallet"  
  ON public.wallets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ✅ Users can insert their own wallet (for new accounts)
CREATE POLICY "Users can insert their own wallet"
  ON public.wallets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ✅ Service role can manage all wallets (for API endpoints)
CREATE POLICY "Service role can manage wallets"
  ON public.wallets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.wallets IS 'Stores encrypted wallet mnemonics. RLS ensures users can only access their own wallet. Server endpoints use service role.';

-- ============================================================================
-- MIGRATION 4: 2FA Backup Codes Column
-- ============================================================================
-- Adds backup codes column for 2FA recovery

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB DEFAULT '[]';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_2fa_enabled 
ON user_profiles(two_factor_enabled) 
WHERE two_factor_enabled = true;

-- Comment
COMMENT ON COLUMN user_profiles.two_factor_backup_codes IS 
'SHA-256 hashed backup codes for 2FA recovery. One-time use, removed after verification. 8 codes for crypto wallet.';

-- Initialize existing rows
UPDATE user_profiles 
SET two_factor_backup_codes = '[]'::jsonb 
WHERE two_factor_backup_codes IS NULL;

-- ============================================================================
-- VERIFICATION: Check that everything is correct
-- ============================================================================

-- Check address_book policies
SELECT 
  'address_book' as table_name,
  policyname, 
  cmd as operation, 
  roles,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING clause exists' 
    ELSE 'No USING clause' 
  END as using_status
FROM pg_policies 
WHERE tablename = 'address_book'
ORDER BY policyname;

-- Check onramp_transactions policies
SELECT 
  'onramp_transactions' as table_name,
  policyname, 
  cmd as operation, 
  roles
FROM pg_policies 
WHERE tablename = 'onramp_transactions'
ORDER BY policyname;

-- Check wallets policies
SELECT 
  'wallets' as table_name,
  policyname, 
  cmd as operation, 
  roles
FROM pg_policies 
WHERE tablename = 'wallets'
ORDER BY policyname;

-- Check RLS is enabled on all tables
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('address_book', 'onramp_transactions', 'wallets', 'user_profiles', 'trusted_devices', 'scheduled_transactions')
ORDER BY tablename;

-- Check 2FA backup codes column exists
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles' 
  AND column_name = 'two_factor_backup_codes';

-- ============================================================================
-- ✅ MIGRATION COMPLETE!
-- ============================================================================
-- Expected results from verification queries:
-- 
-- address_book: 4 policies (SELECT, INSERT, UPDATE, DELETE) - all for 'authenticated' only
-- onramp_transactions: 2 policies (SELECT for authenticated, ALL for service_role)
-- wallets: 4 policies (SELECT, INSERT, UPDATE for authenticated, ALL for service_role)
-- All tables: rls_enabled = true
-- user_profiles: two_factor_backup_codes column exists (jsonb type)
-- 
-- If all looks good, you're ready to test!
-- ============================================================================

