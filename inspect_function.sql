-- Get the exact source code of check_2fa_session function
SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition,
  p.prosrc AS function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'check_2fa_session'
  AND n.nspname = 'public';

