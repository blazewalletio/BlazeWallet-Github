-- 🔥 QUERY 3: Test handmatig user creation
-- Dit simuleert EXACT wat admin.createUser doet

BEGIN;

-- Probeer een test user aan te maken
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated', 
  'test-manual-' || floor(random() * 10000) || '@example.com',
  crypt('test123', gen_salt('bf')),
  NOW(), -- email confirmed
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW(),
  '',
  ''
);

-- Als dit werkt, rollback de test
ROLLBACK;

-- Als je een error krijgt, stuur me de VOLLEDIGE error message!

