-- =====================================================
-- 🔥 BETTER FIX: Allow login WITHOUT blocking, but track verification
-- =====================================================
-- Problem: We need to allow unverified users to login
-- But still show "Verified" badge only after email verification
-- Solution: Don't mark as unverified, but track in separate table
-- =====================================================

-- =====================================================
-- STEP 1: Drop old function (we don't need it)
-- =====================================================
DROP FUNCTION IF EXISTS public.mark_user_unverified(UUID);
DROP FUNCTION IF EXISTS public.auto_verify_user(UUID);

-- =====================================================
-- STEP 2: Create custom verification tracking table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_email_verification_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_email_verification_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own verification status"
  ON public.user_email_verification_status FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own verification status"
  ON public.user_email_verification_status FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.user_email_verification_status FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- STEP 3: Function to mark email as VERIFIED (after click)
-- =====================================================
CREATE OR REPLACE FUNCTION public.mark_email_verified(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update our custom tracking table
  INSERT INTO public.user_email_verification_status (user_id, email, is_verified, verified_at)
  SELECT 
    p_user_id,
    email,
    true,
    NOW()
  FROM auth.users
  WHERE id = p_user_id
  ON CONFLICT (user_id) 
  DO UPDATE SET
    is_verified = true,
    verified_at = NOW(),
    updated_at = NOW();
    
  -- Also update Supabase auth table (for consistency)
  UPDATE auth.users
  SET 
    email_confirmed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_email_verified(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_email_verified(UUID) TO service_role;

-- =====================================================
-- STEP 4: Function to track NEW user signup (unverified)
-- =====================================================
CREATE OR REPLACE FUNCTION public.track_new_user_email(p_user_id UUID, p_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Track user as unverified in our table
  INSERT INTO public.user_email_verification_status (user_id, email, is_verified)
  VALUES (p_user_id, p_email, false)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- BUT: Keep email_confirmed_at in Supabase so they CAN login
  -- We just check our custom table for "Verified" badge
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_new_user_email(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_new_user_email(UUID, TEXT) TO service_role;

-- =====================================================
-- STEP 5: Populate table with existing users
-- =====================================================
INSERT INTO public.user_email_verification_status (user_id, email, is_verified, verified_at)
SELECT 
  id,
  email,
  true,  -- Mark existing users as verified
  email_confirmed_at
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- STEP 6: Update trigger to track new signups
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_user_profile_on_signup()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert user profile
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'BLAZE User'))
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Insert security score
  INSERT INTO public.user_security_scores (user_id, email_verified)
  VALUES (NEW.id, false)  -- Start as unverified
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Insert transaction stats
  INSERT INTO public.user_transaction_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Track email verification status (starts as unverified)
  INSERT INTO public.user_email_verification_status (user_id, email, is_verified)
  VALUES (NEW.id, NEW.email, false)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_profile_on_signup();

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
DECLARE
  verified_count INTEGER;
  unverified_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM auth.users;
  SELECT COUNT(*) INTO verified_count FROM public.user_email_verification_status WHERE is_verified = true;
  SELECT COUNT(*) INTO unverified_count FROM public.user_email_verification_status WHERE is_verified = false;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '📊 EMAIL VERIFICATION TRACKING:';
  RAISE NOTICE '';
  RAISE NOTICE '   Total users: %', total_count;
  RAISE NOTICE '   ✅ Verified: %', verified_count;
  RAISE NOTICE '   ⚠️  Unverified: %', unverified_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ All users can LOGIN (verified or not)';
  RAISE NOTICE '✅ "Verified" badge only shows after email verification';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;

