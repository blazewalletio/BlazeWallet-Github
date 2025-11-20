-- Check if trigger exists and is enabled
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled,
    tgtype as trigger_type,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created_auto_confirm';

-- Check if function exists
SELECT 
    proname as function_name,
    pronamespace::regnamespace as schema,
    prosrc as source_code
FROM pg_proc 
WHERE proname = 'auto_confirm_user';

