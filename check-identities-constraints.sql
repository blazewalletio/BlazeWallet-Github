-- Check constraints on auth.identities table
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
WHERE conrelid = 'auth.identities'::regclass
ORDER BY conname;

-- Check if there are any triggers on auth.users that might fail
SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgtype as trigger_type,
    proname as function_name,
    prosrc as function_code
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'auth.users'::regclass
ORDER BY tgname;

