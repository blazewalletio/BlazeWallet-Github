-- ============================================================================
-- 🔥 RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================
-- Function to create user with proper identity (including provider_id)
-- This fixes the "provider_id" null constraint violation

CREATE OR REPLACE FUNCTION create_user_with_identity(
  user_email TEXT,
  user_password TEXT
)
RETURNS TABLE(user_id UUID, user_email_out TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
  new_identity_id UUID;
BEGIN
  -- Generate UUIDs
  new_user_id := gen_random_uuid();
  new_identity_id := gen_random_uuid();
  
  -- Create user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    user_email,
    crypt(user_password, gen_salt('bf')),
    NOW(), -- Auto-confirmed
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    NOW(),
    NOW(),
    '',
    ''
  );
  
  -- Create identity with provider_id (THIS IS THE FIX!)
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,  -- ✅ THIS WAS MISSING!
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    new_identity_id,
    new_user_id,
    new_user_id::text,  -- provider_id = user_id as string
    jsonb_build_object('sub', new_user_id::text, 'email', user_email),
    'email',
    NOW(),
    NOW(),
    NOW()
  );
  
  -- Return the created user
  RETURN QUERY SELECT new_user_id, user_email;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_user_with_identity(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_user_with_identity(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_identity(TEXT, TEXT) TO anon;

