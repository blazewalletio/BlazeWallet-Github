-- ============================================================================
-- 🔥 FIX: Add SELECT policy for scheduled_transactions
-- ============================================================================
-- Het probleem: Banner kan transactions niet LEZEN omdat SELECT policy ontbreekt!
-- ============================================================================

-- STEP 1: Add SELECT policy for service_role (API calls)
DROP POLICY IF EXISTS "service_role_can_select" ON scheduled_transactions;
CREATE POLICY "service_role_can_select"
ON scheduled_transactions
FOR SELECT
TO service_role
USING (true);

-- STEP 2: Add SELECT policy for users (to see their own transactions)
DROP POLICY IF EXISTS "users_can_select_own" ON scheduled_transactions;
CREATE POLICY "users_can_select_own"
ON scheduled_transactions
FOR SELECT
TO authenticated, anon
USING (
  user_id = auth.jwt() ->> 'email' 
  OR user_id = (SELECT current_setting('request.jwt.claims', true)::json ->> 'email')
  OR supabase_user_id::text = auth.uid()::text
);

-- STEP 3: Verify SELECT policies exist
SELECT 
  '✅ SELECT Policies Created' as status,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'scheduled_transactions'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- STEP 4: Test if you can now see your transactions
SELECT 
  COUNT(*) as your_pending_transactions,
  '✅ If > 0, banner should work now!' as result
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl'
  AND status = 'pending';

