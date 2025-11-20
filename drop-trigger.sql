-- Drop the problematic auto_confirm trigger
-- This trigger is causing "Database error saving new user"

DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
DROP FUNCTION IF EXISTS auto_confirm_user();

-- Verify it's gone
SELECT COUNT(*) as remaining_triggers 
FROM pg_trigger 
WHERE tgrelid = 'auth.users'::regclass 
AND tgname = 'on_auth_user_created_auto_confirm';

