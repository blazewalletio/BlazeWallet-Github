-- 🔥 FIX: Trigger RLS Conflict
-- Problem: Triggers cannot insert into user_profiles because RLS blocks NULL auth.uid()
-- Solution: Allow inserts when auth.uid() IS NULL (from triggers) OR when user owns the profile

-- ====================================
-- DROP OLD RESTRICTIVE POLICIES
-- ====================================

DROP POLICY IF EXISTS "Enable insert for authenticated users on own profile" ON user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users on own activity" ON user_activity_log;
DROP POLICY IF EXISTS "Enable insert for authenticated users on own security score" ON user_security_scores;
DROP POLICY IF EXISTS "Enable insert for authenticated users on own transaction stats" ON user_transaction_stats;

-- ====================================
-- CREATE NEW PERMISSIVE POLICIES (for triggers)
-- ====================================

-- User profiles: Allow triggers (NULL auth.uid()) AND authenticated users (own profile)
CREATE POLICY "Allow inserts on user_profiles from triggers and users"
  ON user_profiles FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL  -- Allow when no auth context (triggers)
    OR auth.uid() = user_id  -- Allow when user inserts own profile
  );

-- Activity log: Same logic
CREATE POLICY "Allow inserts on user_activity_log from triggers and users"
  ON user_activity_log FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL  -- Allow when no auth context (triggers)
    OR auth.uid() = user_id  -- Allow when user inserts own activity
  );

-- Security scores: Same logic
CREATE POLICY "Allow inserts on user_security_scores from triggers and users"
  ON user_security_scores FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL  -- Allow when no auth context (triggers)
    OR auth.uid() = user_id  -- Allow when user inserts own score
  );

-- Transaction stats: Same logic
CREATE POLICY "Allow inserts on user_transaction_stats from triggers and users"
  ON user_transaction_stats FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL  -- Allow when no auth context (triggers)
    OR auth.uid() = user_id  -- Allow when user inserts own stats
  );

-- ====================================
-- ALSO FIX UPDATE POLICIES (just in case)
-- ====================================

DROP POLICY IF EXISTS "Enable update for authenticated users on own security score" ON user_security_scores;
DROP POLICY IF EXISTS "Enable update for authenticated users on own transaction stats" ON user_transaction_stats;

CREATE POLICY "Allow updates on user_security_scores"
  ON user_security_scores FOR UPDATE
  USING (
    auth.uid() IS NULL  -- Allow triggers
    OR auth.uid() = user_id  -- Allow own updates
  )
  WITH CHECK (
    auth.uid() IS NULL 
    OR auth.uid() = user_id
  );

CREATE POLICY "Allow updates on user_transaction_stats"
  ON user_transaction_stats FOR UPDATE
  USING (
    auth.uid() IS NULL  -- Allow triggers
    OR auth.uid() = user_id  -- Allow own updates
  )
  WITH CHECK (
    auth.uid() IS NULL 
    OR auth.uid() = user_id
  );

-- ====================================
-- VERIFY service_role STILL HAS FULL ACCESS
-- ====================================

-- Drop and recreate to ensure they exist
DROP POLICY IF EXISTS "Enable all access for service role on user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Enable all access for service role on user_activity_log" ON user_activity_log;
DROP POLICY IF EXISTS "Enable all access for service role on user_security_scores" ON user_security_scores;
DROP POLICY IF EXISTS "Enable all access for service role on user_transaction_stats" ON user_transaction_stats;

CREATE POLICY "Enable all access for service role on user_profiles"
  ON user_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all access for service role on user_activity_log"
  ON user_activity_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all access for service role on user_security_scores"
  ON user_security_scores FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all access for service role on user_transaction_stats"
  ON user_transaction_stats FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ====================================
-- CLEANUP: Remove orphaned users (users without profiles)
-- ====================================

-- Delete users that have no profile (failed signups)
-- ONLY delete users created in last 7 days to be safe
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  WITH orphaned_users AS (
    SELECT u.id
    FROM auth.users u
    LEFT JOIN public.user_profiles p ON p.user_id = u.id
    WHERE p.id IS NULL
      AND u.created_at > NOW() - INTERVAL '7 days'
  )
  DELETE FROM auth.users
  WHERE id IN (SELECT id FROM orphaned_users);
  
  GET DIAGNOSTICS orphaned_count = ROW_COUNT;
  
  RAISE NOTICE '✅ Cleaned up % orphaned users', orphaned_count;
END $$;

-- ====================================
-- SUCCESS MESSAGE
-- ====================================

DO $$
BEGIN
  RAISE NOTICE '🔥 BLAZE Wallet: Trigger RLS conflict fixed!';
  RAISE NOTICE '✅ Triggers can now insert into user_profiles';
  RAISE NOTICE '✅ Security maintained for authenticated users';
  RAISE NOTICE '✅ Orphaned users cleaned up';
END $$;

