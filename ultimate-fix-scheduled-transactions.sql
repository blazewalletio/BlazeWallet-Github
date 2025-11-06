-- ============================================================================
-- 🔥 ULTIMATE FIX: Cancel + Cleanup + RLS
-- ============================================================================
-- This script does EVERYTHING in one go:
-- 1. Marks expired transactions as 'expired'
-- 2. Cancels all your pending transactions
-- 3. Fixes RLS permissions for future API calls
-- ============================================================================

-- ✅ STEP 1: Mark EXPIRED transactions (scheduled time passed, not executed)
UPDATE scheduled_transactions
SET 
  status = 'expired',
  updated_at = NOW()
WHERE user_id = 'ricks_@live.nl'
  AND status = 'pending'
  AND scheduled_for < NOW()  -- Scheduled time has passed
  AND scheduled_for < NOW() - INTERVAL '5 minutes'  -- Give 5 min grace period
RETURNING 
  id,
  amount,
  token_symbol,
  scheduled_for AT TIME ZONE 'Europe/Amsterdam' as was_scheduled_for,
  '🔥 MARKED AS EXPIRED' as result;

-- ✅ STEP 2: Cancel ALL remaining pending transactions
UPDATE scheduled_transactions
SET 
  status = 'cancelled',
  updated_at = NOW()
WHERE user_id = 'ricks_@live.nl'
  AND status = 'pending'
RETURNING 
  id,
  amount,
  token_symbol,
  scheduled_for AT TIME ZONE 'Europe/Amsterdam' as was_scheduled_for,
  '✅ CANCELLED' as result;

-- ✅ STEP 3: Fix RLS so API cancel works in future
ALTER TABLE scheduled_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_access" ON scheduled_transactions;
CREATE POLICY "service_role_all_access"
ON scheduled_transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

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

-- ✅ STEP 4: Fix notifications table RLS (if exists)
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
  END IF;
END $$;

-- ✅ STEP 5: Verify everything is clean
SELECT 
  '🎉 CLEANUP COMPLETE!' as status,
  COUNT(*) FILTER (WHERE status = 'pending') as still_pending,
  COUNT(*) FILTER (WHERE status = 'expired') as marked_expired,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) as total_transactions
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl';

-- ✅ STEP 6: Verify RLS policies
SELECT 
  '✅ RLS Policies Fixed' as status,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ') as policies
FROM pg_policies
WHERE tablename = 'scheduled_transactions'
  AND policyname IN ('service_role_all_access', 'users_can_update_own');

-- ✅ STEP 7: Show remaining active transactions (should be 0)
SELECT 
  id,
  chain,
  amount,
  token_symbol,
  status,
  scheduled_for AT TIME ZONE 'Europe/Amsterdam' as scheduled_for_local,
  CASE 
    WHEN status = 'pending' THEN '⚠️ Still pending (should not happen)'
    WHEN status = 'expired' THEN '🔥 Expired (time passed, not executed)'
    WHEN status = 'cancelled' THEN '✅ Cancelled'
    ELSE status
  END as explanation
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl'
  AND status IN ('pending', 'expired', 'cancelled')
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 🎯 EXPECTED RESULT:
-- - All expired transactions: status = 'expired'
-- - All other pending: status = 'cancelled'
-- - RLS policies: ✅ Fixed
-- - Banner in UI: ✅ Should be empty now
-- ============================================================================

