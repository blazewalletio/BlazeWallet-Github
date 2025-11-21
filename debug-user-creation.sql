-- Debug script to check user creation issues

-- 1. Check if triggers exist and their order
SELECT 
    trigger_name, 
    event_manipulation, 
    action_timing, 
    action_order,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
AND event_object_schema = 'auth'
ORDER BY action_order;

-- 2. Check if the profile creation function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('create_user_profile_on_signup', 'auto_confirm_user');

-- 3. Check for any failed user creations (users without profiles)
SELECT 
    u.id,
    u.email,
    u.created_at,
    CASE WHEN p.user_id IS NULL THEN 'NO PROFILE' ELSE 'HAS PROFILE' END as profile_status
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.user_id
WHERE u.created_at > NOW() - INTERVAL '7 days'
ORDER BY u.created_at DESC
LIMIT 10;

-- 4. Check if user_profiles table exists and its constraints
SELECT 
    table_name, 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

