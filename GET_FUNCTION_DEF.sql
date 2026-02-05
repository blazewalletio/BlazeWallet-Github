-- Query to get check_2fa_session function definition
SELECT 
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'check_2fa_session'
  AND n.nspname = 'public';

