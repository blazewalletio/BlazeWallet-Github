-- Check the exact structure of a working user
SELECT 
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at
FROM auth.users
LIMIT 1;

-- Check if there are any working users
SELECT COUNT(*) as total_users FROM auth.users;

-- Check the newly created user
SELECT 
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  raw_app_meta_data,
  aud,
  role
FROM auth.users
WHERE id = 'daa6fc19-e546-49f1-af03-b08256fe87a6';

-- Check the identity for this user
SELECT * FROM auth.identities WHERE user_id = 'daa6fc19-e546-49f1-af03-b08256fe87a6';
