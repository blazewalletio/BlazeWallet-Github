-- 🔥 CHECK THE NEWLY CREATED USER
-- Run this to see what's wrong with the user structure

-- Check the user in auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  encrypted_password,
  created_at
FROM auth.users
WHERE email = 'info@warmeleads.eu'
ORDER BY created_at DESC
LIMIT 1;

-- Check the identity
SELECT 
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  created_at
FROM auth.identities
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'info@warmeleads.eu' ORDER BY created_at DESC LIMIT 1
);

-- Check the user profile
SELECT 
  id,
  user_id,
  display_name,
  created_at
FROM user_profiles
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'info@warmeleads.eu' ORDER BY created_at DESC LIMIT 1
);

