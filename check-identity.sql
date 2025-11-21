-- QUERY 2: Check the identity
SELECT 
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
FROM auth.identities
WHERE user_id = '258e9982-34ca-4596-b24d-8c95d60f537c';

