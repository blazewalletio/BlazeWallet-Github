-- DROP ALL CUSTOM FUNCTIONS AND TRIGGERS WE CREATED

-- Drop the create_user_with_identity function
DROP FUNCTION IF EXISTS create_user_with_identity(TEXT, TEXT) CASCADE;

-- Drop any triggers on auth.users that we might have created
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users CASCADE;

-- Drop the auto_confirm_user function if it exists
DROP FUNCTION IF EXISTS auto_confirm_user() CASCADE;

-- List remaining triggers (should be only Supabase's default ones)
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
ORDER BY trigger_name;

-- List remaining functions in auth schema (should be only Supabase's default ones)
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'auth'
  AND routine_name LIKE '%confirm%'
ORDER BY routine_name;
