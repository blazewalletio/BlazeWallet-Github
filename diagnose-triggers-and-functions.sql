-- ============================================================================
-- 🔍 COMPLETE DIAGNOSTIC CHECK - User Creation Flow
-- ============================================================================
-- This script checks ALL triggers, functions, and policies that could affect
-- user creation. Run this in Supabase SQL Editor to find the exact problem.

-- 1️⃣ CHECK ALL TRIGGERS ON auth.users
SELECT 
  trigger_name,
  event_manipulation as trigger_event,
  event_object_table,
  action_timing as timing,
  action_statement as function_called
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND event_object_schema = 'auth'
ORDER BY action_order;

-- 2️⃣ CHECK THE TRIGGER FUNCTIONS (to see what they do)
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_user_profile_on_signup',
    'on_auth_user_created_auto_confirm'
  );

-- 3️⃣ CHECK FOR ANY CONSTRAINTS ON RELATED TABLES
SELECT
  tc.table_name, 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('user_profiles', 'user_security_scores', 'user_transaction_stats', 'user_activity_log')
ORDER BY tc.table_name, tc.constraint_type;

-- 4️⃣ CHECK IF TRIGGERS ARE ENABLED
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  CASE tgenabled
    WHEN 'O' THEN '✅ ENABLED'
    WHEN 'D' THEN '❌ DISABLED'
    WHEN 'R' THEN '⚠️  REPLICA ONLY'
    WHEN 'A' THEN '⚠️  ALWAYS'
    ELSE 'UNKNOWN'
  END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'users'
  AND n.nspname = 'auth'
  AND NOT t.tgisinternal;

-- 5️⃣ TEST IF WE CAN DIRECTLY INSERT INTO user_profiles (as service_role)
-- This simulates what the trigger does
DO $$
BEGIN
  -- Try to insert a test profile (will rollback)
  BEGIN
    INSERT INTO user_profiles (user_id, display_name)
    VALUES ('00000000-0000-0000-0000-000000000000', 'TEST USER');
    
    RAISE NOTICE '✅ INSERT TEST PASSED - Triggers should work';
    
    -- Rollback the test insert
    RAISE EXCEPTION 'ROLLBACK TEST';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM != 'ROLLBACK TEST' THEN
        RAISE NOTICE '❌ INSERT TEST FAILED: %', SQLERRM;
      ELSE
        RAISE NOTICE '✅ Test completed (rolled back)';
      END IF;
  END;
END $$;

-- 6️⃣ CHECK THE ACTUAL TRIGGER FUNCTION FOR create_user_profile_on_signup
SELECT 
  'create_user_profile_on_signup' as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'create_user_profile_on_signup';

-- 7️⃣ CHECK IF THERE ARE ANY OTHER BEFORE INSERT TRIGGERS THAT MIGHT INTERFERE
SELECT 
  t.tgname as trigger_name,
  t.tgtype as trigger_type,
  p.proname as function_name,
  CASE t.tgtype::integer & 2
    WHEN 2 THEN 'BEFORE'
    ELSE 'AFTER'
  END as timing,
  CASE t.tgtype::integer & 4
    WHEN 4 THEN 'INSERT'
    ELSE 'OTHER'
  END as event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'users'
  AND n.nspname = 'auth'
  AND NOT t.tgisinternal
ORDER BY t.tgtype;

-- 8️⃣ CHECK FOR ANY COLUMNS WITH NOT NULL CONSTRAINTS
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('user_profiles', 'user_security_scores', 'user_transaction_stats')
  AND is_nullable = 'NO'
  AND column_default IS NULL
ORDER BY table_name, ordinal_position;

