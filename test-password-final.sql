-- Test if the password hash is correct
SELECT 
  email,
  LEFT(encrypted_password, 10) as hash_prefix,
  LENGTH(encrypted_password) as hash_length
FROM auth.users
WHERE id = 'daa6fc19-e546-49f1-af03-b08256fe87a6';

-- Compare with a working user
SELECT 
  email,
  LEFT(encrypted_password, 10) as hash_prefix,
  LENGTH(encrypted_password) as hash_length
FROM auth.users
WHERE id = '5a39e19c-f663-4226-b5d5-26c032692865';

-- Check if the password verifies correctly
SELECT 
  email,
  encrypted_password = crypt('Ab49n805!', encrypted_password) as password_matches
FROM auth.users
WHERE id = 'daa6fc19-e546-49f1-af03-b08256fe87a6';
