-- =====================================================
-- 🔧 FIX: Security Score Email Verification Check
-- =====================================================
-- 
-- PROBLEM:
-- - Security score shows "Email Verified" immediately after signup
-- - Even if user hasn't clicked verification link
-- 
-- ROOT CAUSE:
-- - calculate_security_score() checks auth.users.email_confirmed_at
-- - But we now ALWAYS set email_confirmed_at = NOW() on signup (for login)
-- - So the check is ALWAYS true!
-- 
-- SOLUTION:
-- - Update calculate_security_score() to check our custom table:
--   user_email_verification_status.is_verified
-- - This accurately reflects if user clicked the verification link
-- 
-- =====================================================

-- Drop and recreate the function with correct verification check
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
  -- ✅ Get REAL verification status from our custom table (not auth.users)
  SELECT COALESCE(is_verified, false)
  INTO v_email_verified
  FROM user_email_verification_status
  WHERE user_id = p_user_id;

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
    score = EXCLUDED.score,
    email_verified = EXCLUDED.email_verified,
    two_factor_enabled = EXCLUDED.two_factor_enabled,
    last_calculated_at = EXCLUDED.last_calculated_at,
    updated_at = NOW();

  RETURN v_score;
END;
$$;

-- =====================================================
-- 🔄 Recalculate ALL security scores with correct status
-- =====================================================

DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT id FROM auth.users
  LOOP
    PERFORM calculate_security_score(user_record.id);
  END LOOP;
  
  RAISE NOTICE '✅ Security scores recalculated for all users with correct verification status';
END $$;

-- =====================================================
-- ✅ Verification
-- =====================================================

SELECT 
  u.email,
  v.is_verified as custom_verified,
  s.email_verified as security_score_verified,
  s.score,
  CASE 
    WHEN v.is_verified = s.email_verified THEN '✅ CORRECT'
    ELSE '❌ MISMATCH'
  END as status
FROM auth.users u
LEFT JOIN user_email_verification_status v ON v.user_id = u.id
LEFT JOIN user_security_scores s ON s.user_id = u.id
ORDER BY u.created_at DESC;

