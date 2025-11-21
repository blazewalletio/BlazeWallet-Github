-- 🔥 TEST: Can we verify the password manually?
-- This checks if the password encryption works

SELECT 
  id,
  email,
  encrypted_password = crypt('Test1234', encrypted_password) as password_matches
FROM auth.users
WHERE id = '258e9982-34ca-4596-b24d-8c95d60f537c';

-- Also check if there are any hooks/triggers on sign-in
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users';

