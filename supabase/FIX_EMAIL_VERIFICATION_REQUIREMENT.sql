-- =====================================================
-- 🔥 FIX: DISABLE EMAIL VERIFICATION REQUIREMENT
-- =====================================================
-- Problem: Supabase blocks login if email_confirmed_at IS NULL
-- Solution: Remove mark_user_unverified call and allow unverified logins
-- =====================================================

-- =====================================================
-- OPTION 1: DISABLE AUTH EMAIL VERIFICATION (RECOMMENDED)
-- =====================================================

-- Update Supabase auth config to allow unverified email logins
-- NOTE: This might need to be done via Supabase Dashboard instead
-- Go to: Authentication → Settings → Email Auth
-- Set "Confirm email" to OFF

-- =====================================================
-- OPTION 2: AUTO-VERIFY ALL NEW USERS (ALTERNATIVE)
-- =====================================================

-- Drop the mark_user_unverified function (we don't need it anymore)
DROP FUNCTION IF EXISTS public.mark_user_unverified(UUID);

-- Create a new function that AUTO-VERIFIES instead
CREATE OR REPLACE FUNCTION public.auto_verify_user(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set email as confirmed immediately
  UPDATE auth.users
  SET 
    email_confirmed_at = NOW(),
    confirmation_sent_at = NOW(),
    updated_at = NOW()
  WHERE id = user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_verify_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_verify_user(UUID) TO service_role;

-- =====================================================
-- OPTION 3: MARK ALL EXISTING USERS AS VERIFIED
-- =====================================================

-- For all existing users that are stuck, mark them as verified
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, created_at),
  confirmation_sent_at = COALESCE(confirmation_sent_at, created_at)
WHERE email_confirmed_at IS NULL;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  unverified_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM auth.users;
  SELECT COUNT(*) INTO unverified_count FROM auth.users WHERE email_confirmed_at IS NULL;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '📊 EMAIL VERIFICATION STATUS:';
  RAISE NOTICE '';
  RAISE NOTICE '   Total users: %', total_count;
  RAISE NOTICE '   Verified users: %', total_count - unverified_count;
  RAISE NOTICE '   Unverified users: %', unverified_count;
  RAISE NOTICE '';
  
  IF unverified_count = 0 THEN
    RAISE NOTICE '✅ ALL USERS ARE VERIFIED!';
    RAISE NOTICE '✅ Users can now login without email verification!';
  ELSE
    RAISE NOTICE '⚠️  % users are still unverified', unverified_count;
    RAISE NOTICE '   Run OPTION 3 again to verify them';
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;

-- =====================================================
-- RECOMMENDED SETUP
-- =====================================================

COMMENT ON FUNCTION public.auto_verify_user IS 'Auto-verifies user email on signup - used instead of mark_user_unverified';

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎯 NEXT STEPS:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Update code: Replace mark_user_unverified with auto_verify_user';
  RAISE NOTICE '   File: app/api/send-welcome-email/route.ts';
  RAISE NOTICE '   Change: mark_user_unverified → auto_verify_user';
  RAISE NOTICE '';
  RAISE NOTICE '2. OR: Remove the call entirely if you dont need verification tracking';
  RAISE NOTICE '';
  RAISE NOTICE '3. Email verification will still work for "Verified" badge';
  RAISE NOTICE '   But users can login even without verifying';
  RAISE NOTICE '';
END $$;

