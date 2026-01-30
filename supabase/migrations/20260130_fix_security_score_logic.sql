-- ============================================================================
-- 🔐 FIX SECURITY SCORE LOGIC
-- Make security score logical, consistent, and user-actionable
-- ============================================================================

-- Add recovery_phrase_backed_up column to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS recovery_phrase_backed_up BOOLEAN DEFAULT false;

-- Add to security scores table
ALTER TABLE user_security_scores
ADD COLUMN IF NOT EXISTS recovery_phrase_backed_up BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trusted_device_added BOOLEAN DEFAULT false;

-- ============================================================================
-- 🎯 NEW SECURITY SCORE CALCULATION (100 pts max)
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_security_score(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score INTEGER := 0;
  v_email_verified BOOLEAN := false;
  v_2fa_enabled BOOLEAN := false;
  v_recovery_backed_up BOOLEAN := false;
  v_trusted_device BOOLEAN := false;
BEGIN
  -- ✅ Email Verified (25 pts) - Basic identity verification
  SELECT COALESCE(is_verified, false)
  INTO v_email_verified
  FROM user_email_verification_status
  WHERE user_id = p_user_id;
  
  IF v_email_verified THEN 
    v_score := v_score + 25; 
  END IF;

  -- ✅ 2FA Enabled (30 pts) - Most important security feature
  SELECT COALESCE(two_factor_enabled, false)
  INTO v_2fa_enabled
  FROM user_profiles
  WHERE user_id = p_user_id;
  
  IF v_2fa_enabled THEN 
    v_score := v_score + 30; 
  END IF;

  -- ✅ Recovery Phrase Backed Up (25 pts) - Can recover wallet
  SELECT COALESCE(recovery_phrase_backed_up, false)
  INTO v_recovery_backed_up
  FROM user_profiles
  WHERE user_id = p_user_id;
  
  IF v_recovery_backed_up THEN 
    v_score := v_score + 25; 
  END IF;

  -- ✅ Trusted Device Added (20 pts) - Device management
  IF EXISTS (
    SELECT 1 FROM trusted_devices 
    WHERE user_id = p_user_id 
    AND verified_at IS NOT NULL 
    LIMIT 1
  ) THEN
    v_trusted_device := true;
    v_score := v_score + 20;
  END IF;

  -- Update security score table with all flags
  INSERT INTO user_security_scores (
    user_id, 
    score, 
    email_verified, 
    two_factor_enabled,
    recovery_phrase_backed_up,
    trusted_device_added,
    last_calculated_at
  )
  VALUES (
    p_user_id,
    v_score,
    v_email_verified,
    v_2fa_enabled,
    v_recovery_backed_up,
    v_trusted_device,
    NOW()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    score = EXCLUDED.score,
    email_verified = EXCLUDED.email_verified,
    two_factor_enabled = EXCLUDED.two_factor_enabled,
    recovery_phrase_backed_up = EXCLUDED.recovery_phrase_backed_up,
    trusted_device_added = EXCLUDED.trusted_device_added,
    last_calculated_at = EXCLUDED.last_calculated_at,
    updated_at = NOW();

  RETURN v_score;
END;
$$;

-- ============================================================================
-- 🔄 Recalculate all security scores with new logic
-- ============================================================================

DO $$
DECLARE
  user_record RECORD;
  new_score INTEGER;
BEGIN
  FOR user_record IN 
    SELECT id FROM auth.users
  LOOP
    new_score := calculate_security_score(user_record.id);
    RAISE NOTICE 'Updated security score for user %: % pts', user_record.id, new_score;
  END LOOP;
  
  RAISE NOTICE '✅ All security scores recalculated with new logic!';
END $$;

-- ============================================================================
-- 📝 Add helper function to mark recovery phrase as backed up
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_recovery_phrase_backed_up(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update user profile
  UPDATE user_profiles
  SET recovery_phrase_backed_up = true,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log activity
  PERFORM log_user_activity(
    p_user_id,
    'security_success',
    'Recovery phrase backed up',
    NULL,
    NULL,
    jsonb_build_object('feature', 'recovery_backup')
  );

  -- Recalculate security score
  PERFORM calculate_security_score(p_user_id);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_recovery_phrase_backed_up(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_recovery_phrase_backed_up(UUID) TO service_role;

-- ============================================================================
-- 📊 Comments
-- ============================================================================

COMMENT ON COLUMN user_profiles.recovery_phrase_backed_up IS 'Whether user has confirmed backing up their recovery phrase';
COMMENT ON FUNCTION calculate_security_score(UUID) IS 'Calculate security score based on user-actionable features (max 100 pts): Email Verified (25), 2FA (30), Recovery Backup (25), Trusted Device (20)';
COMMENT ON FUNCTION mark_recovery_phrase_backed_up(UUID) IS 'Mark recovery phrase as backed up and recalculate security score';

