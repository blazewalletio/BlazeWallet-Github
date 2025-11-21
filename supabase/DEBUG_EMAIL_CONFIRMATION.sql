-- =====================================================
-- 🔍 DEBUG: CHECK EMAIL CONFIRMATION SETTINGS
-- =====================================================
-- This script checks ALL email confirmation settings in Supabase
-- =====================================================

-- =====================================================
-- 1. CHECK AUTH CONFIG
-- =====================================================
SELECT 
  'AUTH CONFIG' as check_type,
  *
FROM auth.config;

-- =====================================================
-- 2. CHECK AUTH SCHEMA VERSION
-- =====================================================
SELECT 
  'AUTH SCHEMA VERSION' as check_type,
  *
FROM auth.schema_migrations
ORDER BY version DESC
LIMIT 5;

-- =====================================================
-- 3. CHECK IF USERS HAVE EMAIL_CONFIRMED_AT SET
-- =====================================================
SELECT 
  'USER EMAIL STATUS' as check_type,
  email,
  email_confirmed_at IS NOT NULL as is_confirmed,
  email_confirmed_at,
  confirmation_sent_at,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- =====================================================
-- 4. CHECK FOR AUTO-CONFIRM TRIGGERS
-- =====================================================
SELECT 
  'TRIGGERS ON auth.users' as check_type,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND event_object_schema = 'auth';

-- =====================================================
-- 5. CHECK FOR FUNCTIONS THAT MIGHT AUTO-CONFIRM
-- =====================================================
SELECT 
  'FUNCTIONS' as check_type,
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%confirm%'
    OR routine_name LIKE '%verify%'
    OR routine_definition LIKE '%email_confirmed_at%'
  );

-- =====================================================
-- 6. TEST: TRY TO LOGIN WITH UNVERIFIED EMAIL
-- =====================================================
-- This will show if there's any policy blocking logins

DO $$
DECLARE
  test_user_id UUID;
  test_user RECORD;
BEGIN
  -- Find a user without email confirmation
  SELECT id, email, email_confirmed_at 
  INTO test_user
  FROM auth.users 
  WHERE email_confirmed_at IS NULL
  LIMIT 1;
  
  IF test_user.id IS NOT NULL THEN
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '🔍 FOUND UNVERIFIED USER FOR TESTING:';
    RAISE NOTICE '   Email: %', test_user.email;
    RAISE NOTICE '   User ID: %', test_user.id;
    RAISE NOTICE '   email_confirmed_at: %', test_user.email_confirmed_at;
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  If this user CANNOT login, then Supabase is blocking unverified emails!';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
  ELSE
    RAISE NOTICE '✅ No unverified users found - all users are verified!';
  END IF;
END $$;

-- =====================================================
-- 7. CHECK RLS POLICIES ON AUTH.USERS (if any)
-- =====================================================
SELECT 
  'RLS POLICIES' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'auth'
  AND tablename = 'users';

