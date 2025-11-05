-- ============================================================================
-- 🔧 FIX RLS POLICY FOR SCHEDULED TRANSACTIONS
-- ============================================================================
-- This fixes the policy to work with BOTH email AND seed phrase wallets
-- ============================================================================

-- Drop the old policy
DROP POLICY IF EXISTS scheduled_transactions_user_policy ON scheduled_transactions;

-- Create new policy that works for both auth types
CREATE POLICY scheduled_transactions_user_policy ON scheduled_transactions
  FOR ALL
  USING (
    -- Allow if supabase_user_id matches (email login)
    supabase_user_id = auth.uid()
    OR
    -- Allow if user_id matches and no supabase_user_id is set (seed phrase login)
    (user_id = current_setting('request.jwt.claims', true)::json->>'user_id' 
     AND supabase_user_id IS NULL)
    OR
    -- TEMPORARY FIX: Allow if service role (for testing)
    auth.jwt()->>'role' = 'service_role'
  )
  WITH CHECK (
    -- Same logic for inserts/updates
    supabase_user_id = auth.uid()
    OR
    (user_id = current_setting('request.jwt.claims', true)::json->>'user_id' 
     AND supabase_user_id IS NULL)
    OR
    auth.jwt()->>'role' = 'service_role'
  );

-- Verify the new policy
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'scheduled_transactions';

