-- ============================================================================
-- VERIFY PREFERRED_CURRENCY COLUMN EXISTS
-- ============================================================================
-- Migration: 20260129160000_verify_currency_column
-- Description: Verify that preferred_currency column exists in user_profiles
--              This is a safety check - column should already exist from
--              migration 20251117100000_account_features.sql
-- ============================================================================

-- Check if column exists, if not, add it
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
    
    RAISE NOTICE 'Added preferred_currency column to user_profiles';
  ELSE
    RAISE NOTICE 'preferred_currency column already exists in user_profiles';
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.user_profiles.preferred_currency IS 'User preferred display currency (USD, EUR, GBP, JPY, AUD, CAD, CHF, CNY, BTC, ETH)';

-- Create index for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_user_profiles_preferred_currency 
ON public.user_profiles(preferred_currency);

-- Verify column exists (this will fail if column doesn't exist)
DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'preferred_currency'
  ) INTO col_exists;
  
  IF NOT col_exists THEN
    RAISE EXCEPTION 'preferred_currency column does not exist in user_profiles table';
  END IF;
  
  RAISE NOTICE '✅ Verification successful: preferred_currency column exists';
END $$;

