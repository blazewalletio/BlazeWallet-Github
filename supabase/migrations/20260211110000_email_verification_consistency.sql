-- ============================================================================
-- Email Verification Consistency
-- Ensures verification tracking table + RPC functions are canonical and
-- compatible with app routes:
-- - /api/send-welcome-email (track_new_user_email)
-- - /api/auth/verify-email (mark_email_verified)
-- ============================================================================

-- 1) Canonical verification tracking table
CREATE TABLE IF NOT EXISTS public.user_email_verification_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_email_verification_status ENABLE ROW LEVEL SECURITY;

-- 2) Policies (idempotent recreate)
DROP POLICY IF EXISTS "Users can view their own verification status" ON public.user_email_verification_status;
CREATE POLICY "Users can view their own verification status"
  ON public.user_email_verification_status FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own verification status" ON public.user_email_verification_status;
CREATE POLICY "Users can update their own verification status"
  ON public.user_email_verification_status FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access" ON public.user_email_verification_status;
CREATE POLICY "Service role full access"
  ON public.user_email_verification_status FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3) mark_email_verified(user_id)
CREATE OR REPLACE FUNCTION public.mark_email_verified(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_email_verification_status (user_id, email, is_verified, verified_at, updated_at)
  SELECT
    p_user_id,
    u.email,
    true,
    NOW(),
    NOW()
  FROM auth.users u
  WHERE u.id = p_user_id
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    is_verified = true,
    verified_at = NOW(),
    updated_at = NOW();

  -- Keep auth.users in sync for consistency with existing auth flow.
  UPDATE auth.users
  SET
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_email_verified(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_email_verified(UUID) TO service_role;

-- 4) track_new_user_email(user_id, email)
CREATE OR REPLACE FUNCTION public.track_new_user_email(p_user_id UUID, p_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_email_verification_status (user_id, email, is_verified, updated_at)
  VALUES (p_user_id, p_email, false, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    is_verified = false,
    verified_at = NULL,
    updated_at = NOW();

  -- Existing login design expects auth email to be usable immediately.
  UPDATE auth.users
  SET
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_new_user_email(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_new_user_email(UUID, TEXT) TO service_role;


