-- ============================================================================
-- 🔥 MANUAL CANCEL + RLS FIX
-- ============================================================================

-- STEP 1: Cancel your 3 pending transactions MANUALLY
UPDATE scheduled_transactions
SET 
  status = 'cancelled',
  updated_at = NOW()
WHERE id IN (
  'beef7692-9fcd-4bbe-8381-264b5ae64474',
  '0d343e71-3e37-4ef3-8f6d-e76d9d007491',
  '5a6012b6-cefc-43b4-af6a-1da143abd776'
)
AND user_id = 'ricks_@live.nl'
AND status = 'pending'
RETURNING 
  id,
  amount,
  token_symbol,
  status,
  '✅ Cancelled!' as result;

-- STEP 2: Now fix RLS so API works for future cancels
ALTER TABLE scheduled_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_access" ON scheduled_transactions;
CREATE POLICY "service_role_all_access"
ON scheduled_transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- STEP 3: Verify RLS fix
SELECT 
  '✅ RLS Policy created' as status,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'scheduled_transactions'
  AND policyname = 'service_role_all_access';

-- STEP 4: Check remaining transactions
SELECT 
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
  '✅ All done!' as result
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl';

