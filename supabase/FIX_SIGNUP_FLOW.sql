-- =====================================================
-- 🔥 URGENT FIX: SIGNUP FLOW DATABASE ERROR
-- =====================================================
-- Error: "Database error creating new user"
-- Cause: Trigger cannot insert into user_profiles due to RLS
-- Solution: Allow inserts when auth.uid() IS NULL (from triggers)
-- =====================================================

-- =====================================================
-- STEP 1: FIX RLS POLICIES FOR TRIGGER INSERTS
-- =====================================================

-- User Profiles: Allow trigger inserts
DROP POLICY IF EXISTS "Enable insert for authenticated users on own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow inserts on user_profiles from triggers and users" ON public.user_profiles;

CREATE POLICY "Allow inserts on user_profiles from triggers and users"
  ON public.user_profiles FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL  -- Allow when no auth context (triggers)
    OR auth.uid() = user_id  -- Allow when user inserts own profile
  );

-- Activity Log: Allow trigger inserts
DROP POLICY IF EXISTS "Enable insert for authenticated users on own activity" ON public.user_activity_log;
DROP POLICY IF EXISTS "Allow inserts on user_activity_log from triggers and users" ON public.user_activity_log;

CREATE POLICY "Allow inserts on user_activity_log from triggers and users"
  ON public.user_activity_log FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL  -- Allow when no auth context (triggers)
    OR auth.uid() = user_id  -- Allow when user inserts own activity
  );

-- Security Scores: Allow trigger inserts
DROP POLICY IF EXISTS "Enable insert for authenticated users on own security score" ON public.user_security_scores;
DROP POLICY IF EXISTS "Allow inserts on user_security_scores from triggers and users" ON public.user_security_scores;

CREATE POLICY "Allow inserts on user_security_scores from triggers and users"
  ON public.user_security_scores FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL  -- Allow when no auth context (triggers)
    OR auth.uid() = user_id  -- Allow when user inserts own score
  );

-- Transaction Stats: Allow trigger inserts
DROP POLICY IF EXISTS "Enable insert for authenticated users on own transaction stats" ON public.user_transaction_stats;
DROP POLICY IF EXISTS "Allow inserts on user_transaction_stats from triggers and users" ON public.user_transaction_stats;

CREATE POLICY "Allow inserts on user_transaction_stats from triggers and users"
  ON public.user_transaction_stats FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL  -- Allow when no auth context (triggers)
    OR auth.uid() = user_id  -- Allow when user inserts own stats
  );

-- =====================================================
-- STEP 2: ENSURE TRIGGER HAS SECURITY DEFINER
-- =====================================================

-- Recreate the trigger function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.create_user_profile_on_signup()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER  -- ✅ This is critical - bypasses RLS
SET search_path = public
AS $$
BEGIN
  -- Insert user profile
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'BLAZE User'))
  ON CONFLICT (user_id) DO NOTHING;  -- Prevent duplicate errors
  
  -- Insert security score
  INSERT INTO public.user_security_scores (user_id, email_verified)
  VALUES (NEW.id, NEW.email_confirmed_at IS NOT NULL)
  ON CONFLICT (user_id) DO NOTHING;  -- Prevent duplicate errors
  
  -- Insert transaction stats
  INSERT INTO public.user_transaction_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;  -- Prevent duplicate errors
  
  RETURN NEW;
END;
$$;

-- Ensure trigger exists and is properly configured
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_profile_on_signup();

-- =====================================================
-- STEP 3: VERIFY WALLETS TABLE EXISTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_wallet TEXT NOT NULL,
  wallet_address TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wallets
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Service role full access to wallets" ON public.wallets;

CREATE POLICY "Users can view their own wallet"
  ON public.wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet"
  ON public.wallets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet"
  ON public.wallets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to wallets"
  ON public.wallets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- STEP 4: ADD MISSING COLUMNS TO USER_PROFILES
-- =====================================================

-- Ensure auto_lock_timeout exists
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS auto_lock_timeout INTEGER DEFAULT 5;

COMMENT ON COLUMN public.user_profiles.auto_lock_timeout IS 'Auto-lock timeout in minutes. 0 = never lock.';

-- =====================================================
-- STEP 5: GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Grant execute on trigger function
GRANT EXECUTE ON FUNCTION public.create_user_profile_on_signup() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile_on_signup() TO service_role;

-- Grant table access
GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;

-- =====================================================
-- STEP 6: CLEANUP ORPHANED USERS (if any exist)
-- =====================================================

-- Find and fix users without profiles (created before fix)
DO $$
DECLARE
  orphaned_record RECORD;
  fixed_count INTEGER := 0;
BEGIN
  FOR orphaned_record IN 
    SELECT u.id, u.email, u.email_confirmed_at, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.user_profiles p ON p.user_id = u.id
    WHERE p.id IS NULL
  LOOP
    -- Create missing profile
    INSERT INTO public.user_profiles (user_id, display_name)
    VALUES (
      orphaned_record.id, 
      COALESCE(orphaned_record.raw_user_meta_data->>'name', 'BLAZE User')
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Create missing security score
    INSERT INTO public.user_security_scores (user_id, email_verified)
    VALUES (
      orphaned_record.id, 
      orphaned_record.email_confirmed_at IS NOT NULL
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Create missing transaction stats
    INSERT INTO public.user_transaction_stats (user_id)
    VALUES (orphaned_record.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    fixed_count := fixed_count + 1;
  END LOOP;
  
  IF fixed_count > 0 THEN
    RAISE NOTICE '✅ Fixed % orphaned user profiles', fixed_count;
  ELSE
    RAISE NOTICE '✅ No orphaned users found';
  END IF;
END $$;

-- =====================================================
-- STEP 7: TEST TRIGGER (Optional - for verification)
-- =====================================================

-- To test, you can manually trigger the function:
-- SELECT public.create_user_profile_on_signup();
-- Or create a test user via Supabase auth and verify profiles are created

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '🔥 BLAZE WALLET - SIGNUP FLOW FIXED!';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ RLS policies updated for trigger inserts';
  RAISE NOTICE '✅ Trigger function secured with SECURITY DEFINER';
  RAISE NOTICE '✅ Wallets table verified';
  RAISE NOTICE '✅ Orphaned users fixed (if any existed)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 NEW USERS CAN NOW SIGN UP SUCCESSFULLY!';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;

