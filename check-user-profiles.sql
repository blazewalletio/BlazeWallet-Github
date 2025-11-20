-- Check if there's a trigger or constraint on user_profiles causing the issue
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' 
AND conrelid::regclass::text LIKE '%user_profiles%'
ORDER BY conname;

-- Check triggers on user_profiles
SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'public.user_profiles'::regclass
ORDER BY tgname;

