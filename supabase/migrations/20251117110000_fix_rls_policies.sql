-- Fix RLS policies for client-side access
-- The issue is that auth.uid() might not work in all contexts
-- We need to allow authenticated users to access their own data

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

DROP POLICY IF EXISTS "Users can view own activity" ON user_activity_log;

DROP POLICY IF EXISTS "Users can view own devices" ON trusted_devices;
DROP POLICY IF EXISTS "Users can manage own devices" ON trusted_devices;

DROP POLICY IF EXISTS "Users can view own security score" ON user_security_scores;

DROP POLICY IF EXISTS "Users can view own transaction stats" ON user_transaction_stats;

-- Recreate with better policies

-- User profiles policies
CREATE POLICY "Enable read access for authenticated users on own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable update for authenticated users on own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable insert for authenticated users on own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Activity log policies
CREATE POLICY "Enable read access for authenticated users on own activity"
  ON user_activity_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for authenticated users on own activity"
  ON user_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Trusted devices policies
CREATE POLICY "Enable read access for authenticated users on own devices"
  ON trusted_devices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable all for authenticated users on own devices"
  ON trusted_devices FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Security scores policies
CREATE POLICY "Enable read access for authenticated users on own security score"
  ON user_security_scores FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for authenticated users on own security score"
  ON user_security_scores FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for authenticated users on own security score"
  ON user_security_scores FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Transaction stats policies
CREATE POLICY "Enable read access for authenticated users on own transaction stats"
  ON user_transaction_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for authenticated users on own transaction stats"
  ON user_transaction_stats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for authenticated users on own transaction stats"
  ON user_transaction_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Also allow service_role to do everything (for backend operations)
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

CREATE POLICY "Enable all access for service role on trusted_devices"
  ON trusted_devices FOR ALL
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

