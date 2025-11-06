-- ============================================================================
-- 🔥 COMPLETE FIX FOR SCHEDULED TRANSACTIONS
-- ============================================================================
-- Dit script repareert ALLE problemen in één keer:
-- 1. Verwijdert verouderde/verlopen transacties
-- 2. Repareert RLS (Row Level Security) policies
-- 3. Geeft service_role volledige toegang
-- 4. Geeft users toegang tot hun eigen transacties
-- ============================================================================

-- ============================================================================
-- STAP 1: Cleanup verlopen transacties
-- ============================================================================
BEGIN;

-- 1a. Mark expired transactions (scheduled_for is passed AND max_wait_hours exceeded)
UPDATE scheduled_transactions
SET 
  status = 'expired',
  updated_at = now(),
  error_message = 'Transaction expired - execution window closed'
WHERE status = 'pending'
  AND scheduled_for < (now() - (max_wait_hours || ' hours')::interval);

-- 1b. Count results
DO $$
DECLARE
  expired_count INT;
  pending_count INT;
BEGIN
  SELECT COUNT(*) INTO expired_count FROM scheduled_transactions WHERE status = 'expired';
  SELECT COUNT(*) INTO pending_count FROM scheduled_transactions WHERE status = 'pending';
  
  RAISE NOTICE '✅ Marked % transactions as expired', expired_count;
  RAISE NOTICE '📊 Remaining pending transactions: %', pending_count;
END $$;

COMMIT;

-- ============================================================================
-- STAP 2: Fix RLS Policies (Row Level Security)
-- ============================================================================
BEGIN;

-- 2a. Drop all existing policies (clean slate)
DROP POLICY IF EXISTS "service_role_all_access" ON scheduled_transactions;
DROP POLICY IF EXISTS "users_select_own" ON scheduled_transactions;
DROP POLICY IF EXISTS "users_update_own" ON scheduled_transactions;
DROP POLICY IF EXISTS "users_insert_own" ON scheduled_transactions;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON scheduled_transactions;
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON scheduled_transactions;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON scheduled_transactions;

-- 2b. Grant full table access to service_role
GRANT ALL ON scheduled_transactions TO service_role;

-- 2c. Enable RLS
ALTER TABLE scheduled_transactions ENABLE ROW LEVEL SECURITY;

-- 2d. Create new, simple, working policies
-- Policy 1: service_role can do EVERYTHING (critical for cron jobs!)
CREATE POLICY "service_role_all_access"
ON scheduled_transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy 2: Authenticated users can SELECT their own transactions
CREATE POLICY "users_select_own"
ON scheduled_transactions
FOR SELECT
TO authenticated
USING (
  user_id = current_setting('request.jwt.claim.email', true) OR
  supabase_user_id::text = current_setting('request.jwt.claim.sub', true)::text
);

-- Policy 3: Authenticated users can UPDATE their own transactions
CREATE POLICY "users_update_own"
ON scheduled_transactions
FOR UPDATE
TO authenticated
USING (
  user_id = current_setting('request.jwt.claim.email', true) OR
  supabase_user_id::text = current_setting('request.jwt.claim.sub', true)::text
)
WITH CHECK (
  user_id = current_setting('request.jwt.claim.email', true) OR
  supabase_user_id::text = current_setting('request.jwt.claim.sub', true)::text
);

-- Policy 4: Authenticated users can INSERT their own transactions
CREATE POLICY "users_insert_own"
ON scheduled_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = current_setting('request.jwt.claim.email', true) OR
  supabase_user_id::text = current_setting('request.jwt.claim.sub', true)::text
);

COMMIT;

-- ============================================================================
-- STAP 3: Verify policies are working
-- ============================================================================
DO $$
DECLARE
  policy_count INT;
  pending_tx_count INT;
BEGIN
  -- Count policies
  SELECT COUNT(*) INTO policy_count 
  FROM pg_policies 
  WHERE tablename = 'scheduled_transactions';
  
  -- Count pending transactions
  SELECT COUNT(*) INTO pending_tx_count 
  FROM scheduled_transactions 
  WHERE status = 'pending';
  
  RAISE NOTICE '✅ RLS Policies created: %', policy_count;
  RAISE NOTICE '📊 Current pending transactions: %', pending_tx_count;
  
  IF policy_count >= 4 THEN
    RAISE NOTICE '🎉 SUCCESS - All policies are in place!';
  ELSE
    RAISE WARNING '⚠️ WARNING - Expected 4 policies, found %', policy_count;
  END IF;
END $$;

-- ============================================================================
-- STAP 4: Test query (optional - uncomment to test)
-- ============================================================================
-- SELECT 
--   id, 
--   user_id, 
--   chain, 
--   status, 
--   scheduled_for,
--   created_at
-- FROM scheduled_transactions
-- WHERE status = 'pending'
-- ORDER BY scheduled_for ASC
-- LIMIT 10;

-- ============================================================================
-- 🎉 DONE! 
-- ============================================================================
-- Als je geen errors ziet, is alles succesvol!
-- De banner zou nu pending transacties moeten tonen.
-- ============================================================================

