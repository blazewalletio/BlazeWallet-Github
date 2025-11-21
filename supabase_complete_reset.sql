-- ============================================
-- 🔥 BLAZE WALLET - COMPLETE DATABASE RESET
-- ============================================
-- This script completely resets and rebuilds the Supabase database
-- to match the exact requirements of the BLAZE Wallet application.
--
-- ⚠️  WARNING: This will DROP all existing tables and data!
-- ⚠️  Only run this if you want to completely reset the database.
--
-- Created: 2025-11-21
-- Version: 1.0
-- ============================================

-- ====================================
-- STEP 1: DROP ALL EXISTING TABLES
-- ====================================

DO $$ 
BEGIN
  RAISE NOTICE '🔥 Starting BLAZE Wallet database reset...';
END $$;

-- Drop all tables (cascade to remove dependencies)
DROP TABLE IF EXISTS public.transaction_notes CASCADE;
DROP TABLE IF EXISTS public.failed_login_attempts CASCADE;
DROP TABLE IF EXISTS public.user_transaction_stats CASCADE;
DROP TABLE IF EXISTS public.user_security_scores CASCADE;
DROP TABLE IF EXISTS public.trusted_devices CASCADE;
DROP TABLE IF EXISTS public.user_activity_log CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.email_verification_tokens CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS public.mark_user_unverified(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_security_score(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.log_user_activity(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile_on_signup() CASCADE;

DO $$ 
BEGIN
  RAISE NOTICE '✅ Old tables and functions dropped';
END $$;

-- ====================================
-- STEP 2: CREATE STORAGE BUCKET
-- ====================================

-- Create storage bucket for user avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploads', 'user-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Create storage policies
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-uploads' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = 'avatars');

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-uploads' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

DO $$ 
BEGIN
  RAISE NOTICE '✅ Storage bucket configured';
END $$;

-- ====================================
-- STEP 3: CREATE ALL TABLES
-- ====================================

-- ============================================
-- TABLE: email_verification_tokens
-- Purpose: Store email verification tokens for new user signups
-- ============================================
CREATE TABLE public.email_verification_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_email_verification_tokens_token ON public.email_verification_tokens(token);
CREATE INDEX idx_email_verification_tokens_user_id ON public.email_verification_tokens(user_id);

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on email_verification_tokens"
  ON public.email_verification_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$ 
BEGIN
  RAISE NOTICE '✅ Table created: email_verification_tokens';
END $$;

-- ============================================
-- TABLE: user_profiles
-- Purpose: Store user profile information and preferences
-- ============================================
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT DEFAULT 'BLAZE User',
  avatar_url TEXT,
  phone_number TEXT,
  preferred_currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'UTC',
  theme TEXT DEFAULT 'auto', -- 'light', 'dark', 'auto' (not used yet, only light theme)
  balance_visible BOOLEAN DEFAULT true,
  notifications_enabled BOOLEAN DEFAULT true,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_method TEXT, -- 'email', 'authenticator'
  two_factor_secret TEXT, -- Encrypted TOTP secret
  auto_lock_timeout INTEGER DEFAULT 5, -- Auto-lock timeout in minutes (0 = never)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read own profile
CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update own profile
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow inserts from triggers AND authenticated users
CREATE POLICY "Allow inserts on user_profiles"
  ON public.user_profiles FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL  -- Allow triggers
    OR auth.uid() = user_id  -- Allow user creating own profile
  );

-- Service role has full access
CREATE POLICY "Service role full access on user_profiles"
  ON public.user_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$ 
BEGIN
  RAISE NOTICE '✅ Table created: user_profiles';
END $$;

-- ============================================
-- TABLE: user_activity_log
-- Purpose: Track user activities (login, logout, transactions, settings changes)
-- ============================================
CREATE TABLE public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'login', 'logout', 'transaction', 'settings_change', 'security_alert'
  description TEXT NOT NULL,
  ip_address TEXT,
  device_info TEXT, -- JSON string with device details
  location TEXT, -- City, Country
  metadata JSONB, -- Additional data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_user_id ON public.user_activity_log(user_id);
CREATE INDEX idx_activity_created_at ON public.user_activity_log(created_at DESC);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can read own activity
CREATE POLICY "Users can read own activity"
  ON public.user_activity_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow inserts from triggers AND authenticated users
CREATE POLICY "Allow inserts on user_activity_log"
  ON public.user_activity_log FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL  -- Allow triggers
    OR auth.uid() = user_id  -- Allow user creating own activity
  );

-- Service role has full access
CREATE POLICY "Service role full access on user_activity_log"
  ON public.user_activity_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$ 
BEGIN
  RAISE NOTICE '✅ Table created: user_activity_log';
END $$;

-- ============================================
-- TABLE: trusted_devices
-- Purpose: Store trusted devices for device verification feature
-- ============================================
CREATE TABLE public.trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL, -- Unique device identifier
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

CREATE INDEX idx_trusted_devices_user_id ON public.trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_fingerprint ON public.trusted_devices(device_fingerprint);

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

-- Users can manage own devices
CREATE POLICY "Users can manage own devices"
  ON public.trusted_devices FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role full access on trusted_devices"
  ON public.trusted_devices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$ 
BEGIN
  RAISE NOTICE '✅ Table created: trusted_devices';
END $$;

-- ============================================
-- TABLE: user_security_scores
-- Purpose: Track user security score and security features enabled
-- ============================================
CREATE TABLE public.user_security_scores (
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

-- Users can read own security score
CREATE POLICY "Users can read own security score"
  ON public.user_security_scores FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow inserts and updates from triggers AND authenticated users
CREATE POLICY "Allow inserts on user_security_scores"
  ON public.user_security_scores FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL  -- Allow triggers
    OR auth.uid() = user_id  -- Allow user
  );

CREATE POLICY "Allow updates on user_security_scores"
  ON public.user_security_scores FOR UPDATE
  USING (
    auth.uid() IS NULL  -- Allow triggers
    OR auth.uid() = user_id  -- Allow user
  )
  WITH CHECK (
    auth.uid() IS NULL 
    OR auth.uid() = user_id
  );

-- Service role has full access
CREATE POLICY "Service role full access on user_security_scores"
  ON public.user_security_scores FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$ 
BEGIN
  RAISE NOTICE '✅ Table created: user_security_scores';
END $$;

-- ============================================
-- TABLE: user_transaction_stats
-- Purpose: Store aggregated transaction statistics per user
-- ============================================
CREATE TABLE public.user_transaction_stats (
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

-- Users can read own transaction stats
CREATE POLICY "Users can read own transaction stats"
  ON public.user_transaction_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow inserts and updates from triggers AND authenticated users
CREATE POLICY "Allow inserts on user_transaction_stats"
  ON public.user_transaction_stats FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL  -- Allow triggers
    OR auth.uid() = user_id  -- Allow user
  );

CREATE POLICY "Allow updates on user_transaction_stats"
  ON public.user_transaction_stats FOR UPDATE
  USING (
    auth.uid() IS NULL  -- Allow triggers
    OR auth.uid() = user_id  -- Allow user
  )
  WITH CHECK (
    auth.uid() IS NULL 
    OR auth.uid() = user_id
  );

-- Service role has full access
CREATE POLICY "Service role full access on user_transaction_stats"
  ON public.user_transaction_stats FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$ 
BEGIN
  RAISE NOTICE '✅ Table created: user_transaction_stats';
END $$;

-- ============================================
-- TABLE: transaction_notes
-- Purpose: Store personal notes for transactions
-- ============================================
CREATE TABLE public.transaction_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain_key VARCHAR(50) NOT NULL,
  tx_hash VARCHAR(255) NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, chain_key, tx_hash)
);

CREATE INDEX idx_transaction_notes_user_chain ON public.transaction_notes(user_id, chain_key);
CREATE INDEX idx_transaction_notes_tx_hash ON public.transaction_notes(tx_hash);

ALTER TABLE public.transaction_notes ENABLE ROW LEVEL SECURITY;

-- Users can manage own transaction notes
CREATE POLICY "Users can manage own transaction notes"
  ON public.transaction_notes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role full access on transaction_notes"
  ON public.transaction_notes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$ 
BEGIN
  RAISE NOTICE '✅ Table created: transaction_notes';
END $$;

-- ============================================
-- TABLE: failed_login_attempts
-- Purpose: Track failed login attempts for rate limiting
-- ============================================
CREATE TABLE public.failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_identifier VARCHAR(255) NOT NULL, -- Email or wallet address
  attempt_count INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  ip_address VARCHAR(45), -- IPv4 or IPv6
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_identifier)
);

CREATE INDEX idx_failed_login_user ON public.failed_login_attempts(user_identifier);
CREATE INDEX idx_failed_login_locked ON public.failed_login_attempts(locked_until) WHERE locked_until IS NOT NULL;

ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own failed attempts
CREATE POLICY "Users can view their own failed attempts"
  ON public.failed_login_attempts FOR SELECT
  TO authenticated
  USING (
    user_identifier IN (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Service role has full access
CREATE POLICY "Service role full access on failed_login_attempts"
  ON public.failed_login_attempts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$ 
BEGIN
  RAISE NOTICE '✅ Table created: failed_login_attempts';
END $$;

-- ====================================
-- STEP 4: CREATE FUNCTIONS
-- ====================================

-- ============================================
-- FUNCTION: mark_user_unverified
-- Purpose: Mark a newly signed up user as unverified
-- ============================================
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

DO $$ 
BEGIN
  RAISE NOTICE '✅ Function created: mark_user_unverified';
END $$;

-- ============================================
-- FUNCTION: calculate_security_score
-- Purpose: Calculate user security score based on enabled features
-- ============================================
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
  -- Get user verification status
  SELECT email_confirmed_at IS NOT NULL
  INTO v_email_verified
  FROM auth.users
  WHERE id = p_user_id;

  -- Get 2FA status
  SELECT two_factor_enabled
  INTO v_2fa_enabled
  FROM public.user_profiles
  WHERE user_id = p_user_id;

  -- Calculate score (each item worth ~20 points)
  IF v_email_verified THEN v_score := v_score + 20; END IF;
  IF v_2fa_enabled THEN v_score := v_score + 25; END IF;
  
  -- Check if user has trusted devices
  IF EXISTS (SELECT 1 FROM public.trusted_devices WHERE user_id = p_user_id AND verified_at IS NOT NULL LIMIT 1) THEN
    v_score := v_score + 20;
  END IF;

  -- Check if user has recent activity (active user bonus)
  IF EXISTS (SELECT 1 FROM public.user_activity_log WHERE user_id = p_user_id AND created_at > NOW() - INTERVAL '7 days' LIMIT 1) THEN
    v_score := v_score + 15;
  END IF;

  -- Base score for having an account
  v_score := v_score + 20;

  -- Update security score table
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

DO $$ 
BEGIN
  RAISE NOTICE '✅ Function created: calculate_security_score';
END $$;

-- ============================================
-- FUNCTION: log_user_activity
-- Purpose: Log user activity to activity log
-- ============================================
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

DO $$ 
BEGIN
  RAISE NOTICE '✅ Function created: log_user_activity';
END $$;

-- ============================================
-- FUNCTION: update_updated_at_column
-- Purpose: Trigger function to auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
  RAISE NOTICE '✅ Function created: update_updated_at_column';
END $$;

-- ============================================
-- FUNCTION: create_user_profile_on_signup
-- Purpose: Automatically create profile, security score, and transaction stats on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.create_user_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'BLAZE User'));
  
  -- Create security score
  INSERT INTO public.user_security_scores (user_id, email_verified)
  VALUES (NEW.id, NEW.email_confirmed_at IS NOT NULL);
  
  -- Create transaction stats
  INSERT INTO public.user_transaction_stats (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ 
BEGIN
  RAISE NOTICE '✅ Function created: create_user_profile_on_signup';
END $$;

-- ====================================
-- STEP 5: CREATE TRIGGERS
-- ====================================

-- Auto-update updated_at on user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update updated_at on user_security_scores
DROP TRIGGER IF EXISTS update_security_scores_updated_at ON public.user_security_scores;
CREATE TRIGGER update_security_scores_updated_at
  BEFORE UPDATE ON public.user_security_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update updated_at on transaction_notes
DROP TRIGGER IF EXISTS update_transaction_notes_updated_at ON public.transaction_notes;
CREATE TRIGGER update_transaction_notes_updated_at
  BEFORE UPDATE ON public.transaction_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_profile_on_signup();

DO $$ 
BEGIN
  RAISE NOTICE '✅ Triggers created';
END $$;

-- ====================================
-- STEP 6: CLEANUP ORPHANED USERS
-- ====================================

-- Delete auth.users that don't have a profile (failed signups)
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
  
  RAISE NOTICE '✅ Cleaned up % orphaned users (users without profiles)', orphaned_count;
END $$;

-- ====================================
-- STEP 7: VERIFY SETUP
-- ====================================

DO $$
DECLARE
  table_count INTEGER;
  function_count INTEGER;
  trigger_count INTEGER;
BEGIN
  -- Count tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'email_verification_tokens',
    'user_profiles',
    'user_activity_log',
    'trusted_devices',
    'user_security_scores',
    'user_transaction_stats',
    'transaction_notes',
    'failed_login_attempts'
  );
  
  -- Count functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname IN (
    'mark_user_unverified',
    'calculate_security_score',
    'log_user_activity',
    'update_updated_at_column',
    'create_user_profile_on_signup'
  );
  
  -- Count triggers
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
  OR trigger_name = 'on_auth_user_created';
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '🔥 BLAZE Wallet Database Setup Complete!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Tables created: %', table_count;
  RAISE NOTICE '✅ Functions created: %', function_count;
  RAISE NOTICE '✅ Triggers created: %', trigger_count;
  RAISE NOTICE '';
  RAISE NOTICE '📋 Tables:';
  RAISE NOTICE '  • email_verification_tokens';
  RAISE NOTICE '  • user_profiles';
  RAISE NOTICE '  • user_activity_log';
  RAISE NOTICE '  • trusted_devices';
  RAISE NOTICE '  • user_security_scores';
  RAISE NOTICE '  • user_transaction_stats';
  RAISE NOTICE '  • transaction_notes';
  RAISE NOTICE '  • failed_login_attempts';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 RLS Policies: ENABLED on all tables';
  RAISE NOTICE '📦 Storage Bucket: user-uploads configured';
  RAISE NOTICE '🔄 Triggers: Auto-create profiles on signup';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ Ready to use!';
  RAISE NOTICE '============================================';
END $$;

