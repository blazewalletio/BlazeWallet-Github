-- ============================================================================
-- ⚡ QUICK COPY: Ultimate Fix Script
-- ============================================================================
-- Kopieer ALLEEN DEZE FILE (niet de .md file!)
-- ============================================================================

-- STEP 1: Mark expired transactions
UPDATE scheduled_transactions
SET status = 'expired', updated_at = NOW()
WHERE user_id = 'ricks_@live.nl'
  AND status = 'pending'
  AND scheduled_for < NOW() - INTERVAL '5 minutes';

-- STEP 2: Cancel remaining pending
UPDATE scheduled_transactions
SET status = 'cancelled', updated_at = NOW()
WHERE user_id = 'ricks_@live.nl'
  AND status = 'pending';

-- STEP 3: Fix RLS for service_role
ALTER TABLE scheduled_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON scheduled_transactions;
CREATE POLICY "service_role_all_access"
ON scheduled_transactions FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- STEP 4: Fix RLS for users
DROP POLICY IF EXISTS "users_can_update_own" ON scheduled_transactions;
CREATE POLICY "users_can_update_own"
ON scheduled_transactions FOR UPDATE TO authenticated, anon
USING (
  user_id = auth.jwt() ->> 'email' 
  OR supabase_user_id::text = auth.uid()::text
)
WITH CHECK (
  user_id = auth.jwt() ->> 'email'
  OR supabase_user_id::text = auth.uid()::text
);

-- STEP 5: Fix notifications table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "service_role_notifications" ON notifications;
    CREATE POLICY "service_role_notifications"
    ON notifications FOR ALL TO service_role
    USING (true) WITH CHECK (true);
  END IF;
END $$;

-- VERIFY: Show results
SELECT 
  COUNT(*) FILTER (WHERE status = 'pending') as still_pending,
  COUNT(*) FILTER (WHERE status = 'expired') as expired,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
  '✅ Done!' as result
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl';

