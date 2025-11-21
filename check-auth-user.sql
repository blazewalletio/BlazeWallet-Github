-- QUERY 1: Check the user in auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  encrypted_password IS NOT NULL as has_password,
  length(encrypted_password) as password_length,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at
FROM auth.users
WHERE id = '258e9982-34ca-4596-b24d-8c95d60f537c';

