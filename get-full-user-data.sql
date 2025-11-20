-- Get the FULL user record (not just identity)
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
  instance_id,
  created_at
FROM auth.users
WHERE id = 'daa6fc19-e546-49f1-af03-b08256fe87a6';

-- Also compare with a WORKING user (if any exist)
SELECT 
  id,
  email,
  encrypted_password IS NOT NULL as has_password,
  email_confirmed_at IS NOT NULL as is_confirmed,
  confirmation_token,
  raw_app_meta_data,
  aud,
  role,
  instance_id
FROM auth.users
WHERE id != 'daa6fc19-e546-49f1-af03-b08256fe87a6'
LIMIT 1;
