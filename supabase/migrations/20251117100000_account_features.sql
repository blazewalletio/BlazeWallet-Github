-- Account Features Migration
-- Adds tables for: user profiles, activity log, trusted devices, 2FA, security score

-- ====================================
-- USER PROFILES TABLE
-- ====================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  phone_number TEXT,
  preferred_currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'UTC',
  theme TEXT DEFAULT 'auto', -- 'light', 'dark', 'auto'
  balance_visible BOOLEAN DEFAULT true,
  notifications_enabled BOOLEAN DEFAULT true,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_method TEXT, -- 'email', 'authenticator'
  two_factor_secret TEXT, -- Encrypted TOTP secret
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ====================================
-- ACTIVITY LOG TABLE
-- ====================================
CREATE TABLE IF NOT EXISTS user_activity_log (
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

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON user_activity_log(created_at DESC);

-- ====================================
-- TRUSTED DEVICES TABLE
-- ====================================
CREATE TABLE IF NOT EXISTS trusted_devices (
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

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);

-- ====================================
-- SECURITY SCORE TABLE
-- ====================================
CREATE TABLE IF NOT EXISTS user_security_scores (
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

-- ====================================
-- TRANSACTION STATS TABLE (for analytics)
-- ====================================
CREATE TABLE IF NOT EXISTS user_transaction_stats (
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

-- ====================================
-- FUNCTIONS
-- ====================================

-- Function to calculate security score
CREATE OR REPLACE FUNCTION calculate_security_score(p_user_id UUID)
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
  FROM user_profiles
  WHERE user_id = p_user_id;

  -- Calculate score (each item worth ~20 points)
  IF v_email_verified THEN v_score := v_score + 20; END IF;
  IF v_2fa_enabled THEN v_score := v_score + 25; END IF;
  
  -- Check if user has trusted devices
  IF EXISTS (SELECT 1 FROM trusted_devices WHERE user_id = p_user_id AND verified_at IS NOT NULL LIMIT 1) THEN
    v_score := v_score + 20;
  END IF;

  -- Check if user has recent activity (active user bonus)
  IF EXISTS (SELECT 1 FROM user_activity_log WHERE user_id = p_user_id AND created_at > NOW() - INTERVAL '7 days' LIMIT 1) THEN
    v_score := v_score + 15;
  END IF;

  -- Base score for having an account
  v_score := v_score + 20;

  -- Update security score table
  INSERT INTO user_security_scores (
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

-- Function to log activity
CREATE OR REPLACE FUNCTION log_user_activity(
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
  INSERT INTO user_activity_log (
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

-- ====================================
-- ROW LEVEL SECURITY (RLS)
-- ====================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_security_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_transaction_stats ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile" 
  ON user_profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
  ON user_profiles FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
  ON user_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Activity log policies
CREATE POLICY "Users can view own activity" 
  ON user_activity_log FOR SELECT 
  USING (auth.uid() = user_id);

-- Trusted devices policies
CREATE POLICY "Users can view own devices" 
  ON trusted_devices FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own devices" 
  ON trusted_devices FOR ALL 
  USING (auth.uid() = user_id);

-- Security scores policies
CREATE POLICY "Users can view own security score" 
  ON user_security_scores FOR SELECT 
  USING (auth.uid() = user_id);

-- Transaction stats policies
CREATE POLICY "Users can view own transaction stats" 
  ON user_transaction_stats FOR SELECT 
  USING (auth.uid() = user_id);

-- ====================================
-- GRANTS
-- ====================================

GRANT EXECUTE ON FUNCTION calculate_security_score(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_security_score(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION log_user_activity(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION log_user_activity(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- ====================================
-- TRIGGERS
-- ====================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_security_scores_updated_at
  BEFORE UPDATE ON user_security_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION create_user_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'BLAZE User'));
  
  INSERT INTO user_security_scores (user_id, email_verified)
  VALUES (NEW.id, NEW.email_confirmed_at IS NOT NULL);
  
  INSERT INTO user_transaction_stats (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile_on_signup();

