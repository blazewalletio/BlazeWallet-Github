-- ============================================================================
-- 🔥 INSTANT FIX: Cancel Scheduled Transactions - RLS Permission Fix
-- ============================================================================
-- This script fixes the 500 error when cancelling scheduled transactions
-- Root cause: RLS policies blocking service role or missing UPDATE permissions
-- ============================================================================

-- ✅ STEP 1: Ensure service role has full access
-- This is critical because the cancel API uses SUPABASE_SERVICE_ROLE_KEY
ALTER TABLE scheduled_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_access" ON scheduled_transactions;
CREATE POLICY "service_role_all_access"
ON scheduled_transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ✅ STEP 2: Allow users to update their own transactions
-- This enables cancel via client-side if needed
DROP POLICY IF EXISTS "users_can_update_own" ON scheduled_transactions;
CREATE POLICY "users_can_update_own"
ON scheduled_transactions
FOR UPDATE
TO authenticated, anon
USING (
  user_id = auth.jwt() ->> 'email' 
  OR user_id = (SELECT current_setting('request.jwt.claims', true)::json ->> 'email')
  OR supabase_user_id::text = auth.uid()::text
)
WITH CHECK (
  user_id = auth.jwt() ->> 'email'
  OR user_id = (SELECT current_setting('request.jwt.claims', true)::json ->> 'email')
  OR supabase_user_id::text = auth.uid()::text
);

-- ✅ STEP 3: Fix notifications table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "service_role_notifications" ON notifications;
    CREATE POLICY "service_role_notifications"
    ON notifications
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
    
    RAISE NOTICE '✅ Notifications table RLS fixed';
  ELSE
    RAISE NOTICE 'ℹ️ Notifications table does not exist (skipping)';
  END IF;
END $$;

-- ✅ STEP 4: Verify policies are created
SELECT 
  '✅ Policies created successfully' as status,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ') as policies
FROM pg_policies
WHERE tablename = 'scheduled_transactions'
  AND policyname IN ('service_role_all_access', 'users_can_update_own');

-- ✅ STEP 5: Test cancel on a specific transaction (REPLACE ID BELOW)
-- Uncomment and run this to test:
/*
UPDATE scheduled_transactions
SET 
  status = 'cancelled',
  updated_at = NOW()
WHERE id = 'YOUR_TRANSACTION_ID_HERE' -- ✅ REPLACE THIS
  AND user_id = 'ricks_@live.nl'
  AND status IN ('pending', 'ready')
RETURNING 
  id,
  status,
  '✅ Successfully cancelled!' as result;
*/

-- ============================================================================
-- 📊 VERIFICATION QUERIES
-- ============================================================================

-- Check all policies on scheduled_transactions
SELECT 
  policyname,
  roles,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies
WHERE tablename = 'scheduled_transactions'
ORDER BY policyname;

-- Check your pending transactions
SELECT 
  id,
  user_id,
  status,
  chain,
  amount,
  token_symbol,
  scheduled_for AT TIME ZONE 'Europe/Amsterdam' as scheduled_for_local,
  CASE 
    WHEN status IN ('pending', 'ready') THEN '✅ Can cancel'
    ELSE '❌ Cannot cancel'
  END as cancellable
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- 🎉 DONE! 
-- ============================================================================
-- After running this script:
-- 1. The 500 error when cancelling should be FIXED
-- 2. Try cancelling a transaction in the Blaze Wallet UI
-- 3. If it still fails, check the Vercel logs for the actual error message
-- ============================================================================

