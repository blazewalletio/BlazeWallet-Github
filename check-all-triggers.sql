-- Check all triggers on auth.users table
SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    CASE tgenabled
        WHEN 'O' THEN 'Enabled (Origin)'
        WHEN 'D' THEN 'Disabled'  
        WHEN 'R' THEN 'Enabled (Replica)'
        WHEN 'A' THEN 'Enabled (Always)'
    END as status,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'auth.users'::regclass
ORDER BY tgname;

