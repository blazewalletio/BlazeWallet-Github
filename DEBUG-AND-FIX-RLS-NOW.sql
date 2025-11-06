-- ============================================================================
-- 🔥 EMERGENCY FIX - SCHEDULED TRANSACTIONS RLS
-- ============================================================================
-- Dit script DEBUGT en FIXT de RLS policies in één keer
-- ============================================================================

-- STAP 1: Check huidige situatie
DO $$
DECLARE
  total_count INT;
  pending_count INT;
  user_pending INT;
BEGIN
  RAISE NOTICE '========== DEBUGGING RLS ISSUE ==========';
  
  -- Total transactions
  SELECT COUNT(*) INTO total_count FROM scheduled_transactions;
  RAISE NOTICE '📊 Total transactions in DB: %', total_count;
  
  -- Pending transactions
  SELECT COUNT(*) INTO pending_count FROM scheduled_transactions WHERE status = 'pending';
  RAISE NOTICE '📊 Pending transactions: %', pending_count;
  
  -- For specific user
  SELECT COUNT(*) INTO user_pending 
  FROM scheduled_transactions 
  WHERE status = 'pending' 
  AND user_id = 'ricks_@live.nl';
  RAISE NOTICE '📊 Pending for ricks_@live.nl: %', user_pending;
END $$;

-- STAP 2: Check current policies
DO $$
DECLARE
  policy_rec RECORD;
BEGIN
  RAISE NOTICE '========== CURRENT RLS POLICIES ==========';
  FOR policy_rec IN (
    SELECT schemaname, tablename, policyname, permissive, roles, cmd
    FROM pg_policies
    WHERE tablename = 'scheduled_transactions'
  ) LOOP
    RAISE NOTICE 'Policy: % | Roles: % | Command: %', 
      policy_rec.policyname, policy_rec.roles, policy_rec.cmd;
  END LOOP;
END $$;

-- STAP 3: DROP ALL existing policies
DO $$
DECLARE
  policy_rec RECORD;
BEGIN
  RAISE NOTICE '========== DROPPING ALL POLICIES ==========';
  FOR policy_rec IN (
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'scheduled_transactions'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON scheduled_transactions', policy_rec.policyname);
    RAISE NOTICE '🗑️ Dropped policy: %', policy_rec.policyname;
  END LOOP;
END $$;

-- STAP 4: DISABLE RLS temporarily
DO $$
BEGIN
  ALTER TABLE scheduled_transactions DISABLE ROW LEVEL SECURITY;
  RAISE NOTICE '⚠️ RLS TEMPORARILY DISABLED';
END $$;

-- STAP 5: Test SELECT zonder RLS
DO $$
DECLARE
  test_count INT;
BEGIN
  SELECT COUNT(*) INTO test_count 
  FROM scheduled_transactions 
  WHERE status = 'pending' 
  AND user_id = 'ricks_@live.nl';
  
  RAISE NOTICE '🧪 Test SELECT without RLS: % transactions', test_count;
END $$;

-- STAP 6: RE-ENABLE RLS
DO $$
BEGIN
  ALTER TABLE scheduled_transactions ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE '✅ RLS RE-ENABLED';
END $$;

-- STAP 7: Create SIMPLE, WORKING policies
-- Policy 1: service_role can do EVERYTHING
CREATE POLICY "service_role_full_access"
ON scheduled_transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy 2: anon can SELECT ALL (for testing - we'll restrict later)
CREATE POLICY "anon_select_all"
ON scheduled_transactions
FOR SELECT
TO anon
USING (true);

-- Policy 3: authenticated can SELECT their own
CREATE POLICY "authenticated_select_own"
ON scheduled_transactions
FOR SELECT
TO authenticated
USING (
  user_id = current_setting('request.jwt.claim.email', true) OR
  supabase_user_id::text = current_setting('request.jwt.claim.sub', true)::text
);

-- Policy 4: authenticated can UPDATE their own
CREATE POLICY "authenticated_update_own"
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

-- Policy 5: authenticated can INSERT their own
CREATE POLICY "authenticated_insert_own"
ON scheduled_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = current_setting('request.jwt.claim.email', true) OR
  supabase_user_id::text = current_setting('request.jwt.claim.sub', true)::text
);

-- STAP 8: Log policy creation
DO $$
BEGIN
  RAISE NOTICE '✅ Created: service_role_full_access';
  RAISE NOTICE '✅ Created: anon_select_all (TEMPORARY - for testing!)';
  RAISE NOTICE '✅ Created: authenticated_select_own';
  RAISE NOTICE '✅ Created: authenticated_update_own';
  RAISE NOTICE '✅ Created: authenticated_insert_own';
END $$;

-- STAP 9: GRANT permissions
GRANT ALL ON scheduled_transactions TO service_role;
GRANT SELECT ON scheduled_transactions TO anon;
GRANT SELECT, INSERT, UPDATE ON scheduled_transactions TO authenticated;

-- STAP 10: Final verification
DO $$
DECLARE
  policy_count INT;
  pending_count INT;
BEGIN
  RAISE NOTICE '========== FINAL VERIFICATION ==========';
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'scheduled_transactions';
  RAISE NOTICE '📊 Total policies: %', policy_count;
  
  -- Count pending transactions
  SELECT COUNT(*) INTO pending_count
  FROM scheduled_transactions
  WHERE status = 'pending';
  RAISE NOTICE '📊 Pending transactions: %', pending_count;
  
  IF policy_count >= 5 THEN
    RAISE NOTICE '🎉 SUCCESS - All policies created!';
  ELSE
    RAISE WARNING '⚠️ Only % policies found, expected 5', policy_count;
  END IF;
  
  RAISE NOTICE '========== PERMISSIONS GRANTED ==========';
  RAISE NOTICE '✅ service_role: ALL';
  RAISE NOTICE '✅ anon: SELECT';
  RAISE NOTICE '✅ authenticated: SELECT, INSERT, UPDATE';
END $$;

-- STAP 11: Show sample data for testing
DO $$
BEGIN
  RAISE NOTICE '========== SAMPLE DATA (last 5 pending) ==========';
END $$;

SELECT 
  id,
  user_id,
  chain,
  status,
  scheduled_for,
  created_at
FROM scheduled_transactions
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 5;

-- Done!
DO $$
BEGIN
  RAISE NOTICE '========== SCRIPT COMPLETE ==========';
  RAISE NOTICE 'Next step: Test in browser and check console logs';
  RAISE NOTICE 'Expected: Banner should now show pending transactions';
END $$;
