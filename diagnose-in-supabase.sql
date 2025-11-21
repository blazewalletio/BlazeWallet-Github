-- Test query to run in Supabase SQL Editor
-- This will identify the EXACT problem

-- 1. Check if triggers exist
SELECT 
    trigger_name, 
    event_manipulation, 
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
  AND event_object_schema = 'auth'
ORDER BY action_timing, trigger_name;

-- 2. Check RLS policies on user_profiles
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- 3. Try to create a test user (THIS WILL REVEAL THE ERROR)
-- DO NOT RUN THIS YET - just for reference
-- SELECT auth.admin_create_user(
--     email := 'test@example.com',
--     password := 'TestPassword123!',
--     email_confirm := true
-- );

-- 4. Check if there are orphaned users (users without profiles)
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.email_confirmed_at,
    CASE WHEN p.id IS NULL THEN 'ORPHANED - NO PROFILE' ELSE 'OK' END as status
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.user_id = u.id
ORDER BY u.created_at DESC
LIMIT 20;

