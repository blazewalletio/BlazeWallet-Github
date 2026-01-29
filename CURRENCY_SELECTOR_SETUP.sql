-- ============================================================================
-- 💱 CURRENCY SELECTOR - VERIFICATION & SETUP
-- ============================================================================
-- 
-- UITVOEREN VIA SUPABASE SQL EDITOR:
-- 1. Open Supabase Dashboard: https://supabase.com/dashboard
-- 2. Ga naar je project: ldehmephukevxumwdbwt
-- 3. Klik op "SQL Editor" in sidebar
-- 4. Kopieer en plak deze SQL
-- 5. Klik "Run" (of Ctrl+Enter)
-- 
-- ============================================================================

-- STAP 1: Verify that preferred_currency column exists
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'preferred_currency'
  ) THEN
    -- Add column if it doesn't exist
    ALTER TABLE public.user_profiles 
    ADD COLUMN preferred_currency TEXT DEFAULT 'USD';
    
    RAISE NOTICE '✅ Added preferred_currency column to user_profiles';
  ELSE
    RAISE NOTICE '✅ preferred_currency column already exists';
  END IF;
END $$;

-- STAP 2: Add index for better performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_preferred_currency 
ON public.user_profiles(preferred_currency);

-- STAP 3: Add column comment for documentation
-- ============================================================================
COMMENT ON COLUMN public.user_profiles.preferred_currency IS 'User preferred display currency (USD, EUR, GBP, JPY, AUD, CAD, CHF, CNY, BTC, ETH)';

-- STAP 4: Verify RLS policies allow users to update their currency
-- ============================================================================
-- Check if update policy exists
DO $$
DECLARE
  policy_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_profiles' 
    AND policyname = 'Users can update own profile'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    RAISE NOTICE '✅ RLS policy "Users can update own profile" exists';
  ELSE
    RAISE WARNING '⚠️ RLS policy "Users can update own profile" not found - users may not be able to update currency';
  END IF;
END $$;

-- STAP 5: Final verification
-- ============================================================================
DO $$
DECLARE
  col_exists BOOLEAN;
  idx_exists BOOLEAN;
BEGIN
  -- Check column
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'preferred_currency'
  ) INTO col_exists;
  
  -- Check index
  SELECT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'user_profiles' 
    AND indexname = 'idx_user_profiles_preferred_currency'
  ) INTO idx_exists;
  
  IF col_exists AND idx_exists THEN
    RAISE NOTICE '';
    RAISE NOTICE '╔═══════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║                                                               ║';
    RAISE NOTICE '║  ✅ CURRENCY SELECTOR - DATABASE KLAAR!                       ║';
    RAISE NOTICE '║                                                               ║';
    RAISE NOTICE '╚═══════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Column: preferred_currency exists';
    RAISE NOTICE '✅ Index: idx_user_profiles_preferred_currency exists';
    RAISE NOTICE '✅ Default value: USD';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Je kunt nu de app testen!';
    RAISE NOTICE '   Settings → Preferences → Currency';
    RAISE NOTICE '';
  ELSE
    RAISE EXCEPTION '❌ Verification failed - something went wrong';
  END IF;
END $$;

-- STAP 6: (Optional) Check current currency settings for all users
-- ============================================================================
SELECT 
  user_id,
  display_name,
  preferred_currency,
  created_at
FROM public.user_profiles
ORDER BY created_at DESC
LIMIT 10;

