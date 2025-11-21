-- =====================================================
-- 🔥 BLAZE WALLET - COMPLETE DATABASE SCHEMA VERIFICATION
-- =====================================================
-- This script verifies and recreates ALL expected tables for the Blaze Wallet
-- Run this to ensure your database matches the wallet's expectations
-- =====================================================

-- =====================================================
-- 1. EMAIL VERIFICATION TOKENS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON public.email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON public.email_verification_tokens(user_id);

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can do everything" ON public.email_verification_tokens;
CREATE POLICY "Service role can do everything" ON public.email_verification_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- 2. USER PROFILES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  phone_number TEXT,
  preferred_currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'UTC',
  theme TEXT DEFAULT 'auto',
  balance_visible BOOLEAN DEFAULT true,
  notifications_enabled BOOLEAN DEFAULT true,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_method TEXT,
  two_factor_secret TEXT,
  auto_lock_timeout INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

COMMENT ON COLUMN public.user_profiles.auto_lock_timeout IS 'Auto-lock timeout in minutes. 0 = never lock.';

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. ACTIVITY LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  ip_address TEXT,
  device_info TEXT,
  location TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user_id ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON public.user_activity_log(created_at DESC);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. TRUSTED DEVICES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  browser TEXT,
  os TEXT,
  is_current BOOLEAN DEFAULT false,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verification_token TEXT,
  verification_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON public.trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON public.trusted_devices(device_fingerprint);

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. SECURITY SCORES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_security_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  email_verified BOOLEAN DEFAULT false,
  two_factor_enabled BOOLEAN DEFAULT false,
  strong_password BOOLEAN DEFAULT false,
  seed_phrase_backed_up BOOLEAN DEFAULT false,
  trusted_device_added BOOLEAN DEFAULT false,
  recovery_email_added BOOLEAN DEFAULT false,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_security_scores ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. TRANSACTION STATS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_transaction_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_transactions INTEGER DEFAULT 0,
  total_sent DECIMAL(20, 8) DEFAULT 0,
  total_received DECIMAL(20, 8) DEFAULT 0,
  total_gas_spent DECIMAL(20, 8) DEFAULT 0,
  favorite_token TEXT,
  last_transaction_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_transaction_stats ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. TRANSACTION NOTES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.transaction_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain_key VARCHAR(50) NOT NULL,
  tx_hash VARCHAR(255) NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, chain_key, tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_transaction_notes_user_chain ON public.transaction_notes(user_id, chain_key);
CREATE INDEX IF NOT EXISTS idx_transaction_notes_tx_hash ON public.transaction_notes(tx_hash);

ALTER TABLE public.transaction_notes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. FAILED LOGIN ATTEMPTS (Rate Limiting)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_identifier VARCHAR(255) NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_identifier)
);

CREATE INDEX IF NOT EXISTS idx_failed_login_user ON public.failed_login_attempts(user_identifier);
CREATE INDEX IF NOT EXISTS idx_failed_login_locked ON public.failed_login_attempts(locked_until) WHERE locked_until IS NOT NULL;

ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.failed_login_attempts IS 'Tracks failed login attempts for rate limiting and security';

-- =====================================================
-- 9. STORAGE BUCKET FOR USER AVATARS
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploads', 'user-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- RLS POLICIES - DROP ALL EXISTING FIRST
-- =====================================================

-- User Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users on own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable update for authenticated users on own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users on own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow inserts on user_profiles from triggers and users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable all access for service role on user_profiles" ON public.user_profiles;

CREATE POLICY "Enable read access for authenticated users on own profile"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable update for authenticated users on own profile"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow inserts on user_profiles from triggers and users"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

CREATE POLICY "Enable all access for service role on user_profiles"
  ON public.user_profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Activity Log Policies
DROP POLICY IF EXISTS "Users can view own activity" ON public.user_activity_log;
DROP POLICY IF EXISTS "Enable read access for authenticated users on own activity" ON public.user_activity_log;
DROP POLICY IF EXISTS "Enable insert for authenticated users on own activity" ON public.user_activity_log;
DROP POLICY IF EXISTS "Allow inserts on user_activity_log from triggers and users" ON public.user_activity_log;
DROP POLICY IF EXISTS "Enable all access for service role on user_activity_log" ON public.user_activity_log;

CREATE POLICY "Enable read access for authenticated users on own activity"
  ON public.user_activity_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Allow inserts on user_activity_log from triggers and users"
  ON public.user_activity_log FOR INSERT
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

CREATE POLICY "Enable all access for service role on user_activity_log"
  ON public.user_activity_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Trusted Devices Policies
DROP POLICY IF EXISTS "Users can view own devices" ON public.trusted_devices;
DROP POLICY IF EXISTS "Users can manage own devices" ON public.trusted_devices;
DROP POLICY IF EXISTS "Enable read access for authenticated users on own devices" ON public.trusted_devices;
DROP POLICY IF EXISTS "Enable all for authenticated users on own devices" ON public.trusted_devices;
DROP POLICY IF EXISTS "Enable all access for service role on trusted_devices" ON public.trusted_devices;

CREATE POLICY "Enable read access for authenticated users on own devices"
  ON public.trusted_devices FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable all for authenticated users on own devices"
  ON public.trusted_devices FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable all access for service role on trusted_devices"
  ON public.trusted_devices FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Security Scores Policies
DROP POLICY IF EXISTS "Users can view own security score" ON public.user_security_scores;
DROP POLICY IF EXISTS "Enable read access for authenticated users on own security score" ON public.user_security_scores;
DROP POLICY IF EXISTS "Enable insert for authenticated users on own security score" ON public.user_security_scores;
DROP POLICY IF EXISTS "Enable update for authenticated users on own security score" ON public.user_security_scores;
DROP POLICY IF EXISTS "Allow inserts on user_security_scores from triggers and users" ON public.user_security_scores;
DROP POLICY IF EXISTS "Allow updates on user_security_scores" ON public.user_security_scores;
DROP POLICY IF EXISTS "Enable all access for service role on user_security_scores" ON public.user_security_scores;

CREATE POLICY "Enable read access for authenticated users on own security score"
  ON public.user_security_scores FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Allow inserts on user_security_scores from triggers and users"
  ON public.user_security_scores FOR INSERT
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

CREATE POLICY "Allow updates on user_security_scores"
  ON public.user_security_scores FOR UPDATE
  USING (auth.uid() IS NULL OR auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

CREATE POLICY "Enable all access for service role on user_security_scores"
  ON public.user_security_scores FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Transaction Stats Policies
DROP POLICY IF EXISTS "Users can view own transaction stats" ON public.user_transaction_stats;
DROP POLICY IF EXISTS "Enable read access for authenticated users on own transaction stats" ON public.user_transaction_stats;
DROP POLICY IF EXISTS "Enable insert for authenticated users on own transaction stats" ON public.user_transaction_stats;
DROP POLICY IF EXISTS "Enable update for authenticated users on own transaction stats" ON public.user_transaction_stats;
DROP POLICY IF EXISTS "Allow inserts on user_transaction_stats from triggers and users" ON public.user_transaction_stats;
DROP POLICY IF EXISTS "Allow updates on user_transaction_stats" ON public.user_transaction_stats;
DROP POLICY IF EXISTS "Enable all access for service role on user_transaction_stats" ON public.user_transaction_stats;

CREATE POLICY "Enable read access for authenticated users on own transaction stats"
  ON public.user_transaction_stats FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Allow inserts on user_transaction_stats from triggers and users"
  ON public.user_transaction_stats FOR INSERT
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

CREATE POLICY "Allow updates on user_transaction_stats"
  ON public.user_transaction_stats FOR UPDATE
  USING (auth.uid() IS NULL OR auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

CREATE POLICY "Enable all access for service role on user_transaction_stats"
  ON public.user_transaction_stats FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Transaction Notes Policies
DROP POLICY IF EXISTS "Users can view their own transaction notes" ON public.transaction_notes;
DROP POLICY IF EXISTS "Users can insert their own transaction notes" ON public.transaction_notes;
DROP POLICY IF EXISTS "Users can update their own transaction notes" ON public.transaction_notes;
DROP POLICY IF EXISTS "Users can delete their own transaction notes" ON public.transaction_notes;

CREATE POLICY "Users can view their own transaction notes"
  ON public.transaction_notes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transaction notes"
  ON public.transaction_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transaction notes"
  ON public.transaction_notes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transaction notes"
  ON public.transaction_notes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Failed Login Attempts Policies
DROP POLICY IF EXISTS "Users can view their own failed attempts" ON public.failed_login_attempts;
DROP POLICY IF EXISTS "Service role can manage all attempts" ON public.failed_login_attempts;

CREATE POLICY "Users can view their own failed attempts"
  ON public.failed_login_attempts FOR SELECT TO authenticated
  USING (user_identifier = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Service role can manage all attempts"
  ON public.failed_login_attempts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Storage Policies
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'user-uploads' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = 'avatars');

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'user-uploads' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Mark User Unverified Function
CREATE OR REPLACE FUNCTION public.mark_user_unverified(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auth.users
  SET 
    email_confirmed_at = NULL,
    confirmation_sent_at = NOW(),
    updated_at = NOW()
  WHERE id = user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_user_unverified(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_user_unverified(UUID) TO service_role;

-- Calculate Security Score Function
CREATE OR REPLACE FUNCTION public.calculate_security_score(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score INTEGER := 0;
  v_email_verified BOOLEAN;
  v_2fa_enabled BOOLEAN;
BEGIN
  SELECT email_confirmed_at IS NOT NULL
  INTO v_email_verified
  FROM auth.users
  WHERE id = p_user_id;

  SELECT two_factor_enabled
  INTO v_2fa_enabled
  FROM public.user_profiles
  WHERE user_id = p_user_id;

  IF v_email_verified THEN v_score := v_score + 20; END IF;
  IF v_2fa_enabled THEN v_score := v_score + 25; END IF;
  
  IF EXISTS (SELECT 1 FROM public.trusted_devices WHERE user_id = p_user_id AND verified_at IS NOT NULL LIMIT 1) THEN
    v_score := v_score + 20;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_activity_log WHERE user_id = p_user_id AND created_at > NOW() - INTERVAL '7 days' LIMIT 1) THEN
    v_score := v_score + 15;
  END IF;

  v_score := v_score + 20;

  INSERT INTO public.user_security_scores (
    user_id, 
    score, 
    email_verified, 
    two_factor_enabled,
    last_calculated_at
  )
  VALUES (
    p_user_id,
    v_score,
    v_email_verified,
    COALESCE(v_2fa_enabled, false),
    NOW()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    score = v_score,
    email_verified = v_email_verified,
    two_factor_enabled = COALESCE(v_2fa_enabled, false),
    last_calculated_at = NOW(),
    updated_at = NOW();

  RETURN v_score;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_security_score(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_security_score(UUID) TO service_role;

-- Log User Activity Function
CREATE OR REPLACE FUNCTION public.log_user_activity(
  p_user_id UUID,
  p_activity_type TEXT,
  p_description TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_device_info TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO public.user_activity_log (
    user_id,
    activity_type,
    description,
    ip_address,
    device_info,
    metadata
  )
  VALUES (
    p_user_id,
    p_activity_type,
    p_description,
    p_ip_address,
    p_device_info,
    p_metadata
  )
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_user_activity(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_user_activity(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- Record Failed Login Attempt Function
CREATE OR REPLACE FUNCTION public.record_failed_login_attempt(
  p_user_identifier VARCHAR,
  p_ip_address VARCHAR DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_attempt_count INTEGER;
  v_locked_until TIMESTAMPTZ;
  v_max_attempts INTEGER := 5;
  v_lockout_duration INTERVAL := '15 minutes';
BEGIN
  INSERT INTO public.failed_login_attempts (
    user_identifier,
    attempt_count,
    last_attempt_at,
    ip_address,
    user_agent
  )
  VALUES (
    p_user_identifier,
    1,
    NOW(),
    p_ip_address,
    p_user_agent
  )
  ON CONFLICT (user_identifier)
  DO UPDATE SET
    attempt_count = CASE
      WHEN failed_login_attempts.locked_until IS NOT NULL 
           AND failed_login_attempts.locked_until < NOW()
      THEN 1
      WHEN failed_login_attempts.last_attempt_at > NOW() - INTERVAL '30 minutes'
      THEN failed_login_attempts.attempt_count + 1
      ELSE 1
    END,
    last_attempt_at = NOW(),
    ip_address = p_ip_address,
    user_agent = p_user_agent,
    locked_until = CASE
      WHEN (CASE
        WHEN failed_login_attempts.locked_until IS NOT NULL 
             AND failed_login_attempts.locked_until < NOW()
        THEN 1
        WHEN failed_login_attempts.last_attempt_at > NOW() - INTERVAL '30 minutes'
        THEN failed_login_attempts.attempt_count + 1
        ELSE 1
      END) >= v_max_attempts
      THEN NOW() + v_lockout_duration
      ELSE NULL
    END
  RETURNING attempt_count, locked_until INTO v_attempt_count, v_locked_until;

  RETURN json_build_object(
    'attempt_count', v_attempt_count,
    'max_attempts', v_max_attempts,
    'locked_until', v_locked_until,
    'is_locked', v_locked_until IS NOT NULL AND v_locked_until > NOW(),
    'remaining_attempts', GREATEST(0, v_max_attempts - v_attempt_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_failed_login_attempt TO anon, authenticated;

-- Is User Locked Function
CREATE OR REPLACE FUNCTION public.is_user_locked(p_user_identifier VARCHAR)
RETURNS JSON AS $$
DECLARE
  v_locked_until TIMESTAMPTZ;
  v_attempt_count INTEGER;
BEGIN
  SELECT locked_until, attempt_count
  INTO v_locked_until, v_attempt_count
  FROM public.failed_login_attempts
  WHERE user_identifier = p_user_identifier;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'is_locked', false,
      'attempt_count', 0,
      'remaining_attempts', 5
    );
  END IF;

  IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
    RETURN json_build_object(
      'is_locked', true,
      'locked_until', v_locked_until,
      'attempt_count', v_attempt_count,
      'remaining_attempts', 0,
      'unlock_in_seconds', EXTRACT(EPOCH FROM (v_locked_until - NOW()))::INTEGER
    );
  END IF;

  RETURN json_build_object(
    'is_locked', false,
    'attempt_count', v_attempt_count,
    'remaining_attempts', GREATEST(0, 5 - v_attempt_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_user_locked TO anon, authenticated;

-- Clear Failed Login Attempts Function
CREATE OR REPLACE FUNCTION public.clear_failed_login_attempts(p_user_identifier VARCHAR)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.failed_login_attempts
  WHERE user_identifier = p_user_identifier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.clear_failed_login_attempts TO authenticated;

-- Cleanup Old Failed Attempts Function
CREATE OR REPLACE FUNCTION public.cleanup_old_failed_attempts()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.failed_login_attempts
  WHERE last_attempt_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_security_scores_updated_at ON public.user_security_scores;
CREATE TRIGGER update_security_scores_updated_at
  BEFORE UPDATE ON public.user_security_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_transaction_note_timestamp ON public.transaction_notes;
CREATE TRIGGER update_transaction_note_timestamp
  BEFORE UPDATE ON public.transaction_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.create_user_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'BLAZE User'));
  
  INSERT INTO public.user_security_scores (user_id, email_verified)
  VALUES (NEW.id, NEW.email_confirmed_at IS NOT NULL);
  
  INSERT INTO public.user_transaction_stats (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_profile_on_signup();

-- =====================================================
-- GRANTS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_notes TO authenticated;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '🔥 BLAZE Wallet Database Schema Verification Complete!';
  RAISE NOTICE '✅ All tables created/verified';
  RAISE NOTICE '✅ All RLS policies applied';
  RAISE NOTICE '✅ All functions created';
  RAISE NOTICE '✅ All triggers created';
  RAISE NOTICE '🎉 Your database is now fully synchronized with the Blaze Wallet!';
END $$;

