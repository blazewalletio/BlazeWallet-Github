-- =============================================================================
-- USER ONRAMP PREFERENCES - COMPLETE SETUP SCRIPT
-- =============================================================================
-- Purpose: Fix 404 error for user_onramp_preferences table
-- What it does:
--   1. Creates user_onramp_preferences table if it doesn't exist
--   2. Sets up RLS (Row Level Security) policies
--   3. Creates indexes for performance
--   4. Adds trigger for auto-updating updated_at timestamp
-- 
-- How to use:
--   1. Open Supabase Dashboard: https://supabase.com/dashboard/project/ldehmephukevxumwdbwt
--   2. Go to: SQL Editor (left menu)
--   3. Click: "+ New query"
--   4. Copy-paste this ENTIRE script
--   5. Click: "Run" (or press Cmd+Enter / Ctrl+Enter)
--   6. Check output: Should show "Success. No rows returned"
--   7. Done! The 404 error will be gone after next deploy/refresh
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: CHECK IF TABLE EXISTS (for verification)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'user_onramp_preferences'
  ) THEN
    RAISE NOTICE '✅ Table user_onramp_preferences already exists - will be skipped';
  ELSE
    RAISE NOTICE '🔨 Table user_onramp_preferences does not exist - will be created';
  END IF;
END $$;

-- =============================================================================
-- STEP 2: CREATE TABLE
-- =============================================================================
-- Stores user preferences for onramp providers to enable KYC reuse
-- Tracks which providers user has verified with to avoid repeated KYC
CREATE TABLE IF NOT EXISTS public.user_onramp_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Provider preferences
  preferred_provider TEXT, -- 'banxa', 'moonpay', 'transak', etc.
  verified_providers TEXT[], -- Array of providers where user has done KYC
  last_used_provider TEXT,
  last_transaction_date TIMESTAMPTZ,
  
  -- Payment preferences
  preferred_payment_method TEXT, -- 'creditcard', 'ideal', etc.
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- =============================================================================
-- STEP 3: CREATE INDEXES
-- =============================================================================
-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_onramp_preferences_user_id 
  ON public.user_onramp_preferences(user_id);

-- =============================================================================
-- STEP 4: ENABLE ROW LEVEL SECURITY (RLS)
-- =============================================================================
ALTER TABLE public.user_onramp_preferences ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 5: DROP EXISTING POLICIES (if they exist)
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_onramp_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_onramp_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_onramp_preferences;
DROP POLICY IF EXISTS "Users can delete own preferences" ON public.user_onramp_preferences;

-- =============================================================================
-- STEP 6: CREATE RLS POLICIES
-- =============================================================================
-- Policy 1: Users can view their own preferences
CREATE POLICY "Users can view own preferences"
  ON public.user_onramp_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Users can update their own preferences
CREATE POLICY "Users can update own preferences"
  ON public.user_onramp_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
  ON public.user_onramp_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can delete their own preferences (optional, but good to have)
CREATE POLICY "Users can delete own preferences"
  ON public.user_onramp_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================================================
-- STEP 7: CREATE OR REPLACE TRIGGER FUNCTION
-- =============================================================================
-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_onramp_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 8: DROP EXISTING TRIGGER (if exists) AND CREATE NEW ONE
-- =============================================================================
DROP TRIGGER IF EXISTS update_user_onramp_preferences_updated_at ON public.user_onramp_preferences;

CREATE TRIGGER update_user_onramp_preferences_updated_at
  BEFORE UPDATE ON public.user_onramp_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_onramp_preferences_updated_at();

-- =============================================================================
-- STEP 9: ADD COMMENTS (for documentation)
-- =============================================================================
COMMENT ON TABLE public.user_onramp_preferences IS 'Stores user preferences for onramp providers to enable KYC reuse and faster checkout';
COMMENT ON COLUMN public.user_onramp_preferences.preferred_provider IS 'Provider that user prefers (has done KYC with)';
COMMENT ON COLUMN public.user_onramp_preferences.verified_providers IS 'Array of providers where user has completed KYC';
COMMENT ON COLUMN public.user_onramp_preferences.last_used_provider IS 'Last provider used for purchase';
COMMENT ON COLUMN public.user_onramp_preferences.last_transaction_date IS 'Date of last transaction';

-- =============================================================================
-- STEP 10: VERIFICATION - SHOW TABLE INFO
-- =============================================================================
DO $$
DECLARE
  table_exists BOOLEAN;
  policy_count INTEGER;
  index_count INTEGER;
BEGIN
  -- Check if table exists
  SELECT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'user_onramp_preferences'
  ) INTO table_exists;

  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND tablename = 'user_onramp_preferences';

  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes 
  WHERE schemaname = 'public' 
  AND tablename = 'user_onramp_preferences';

  -- Output results
  IF table_exists THEN
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ SUCCESS! Table user_onramp_preferences is ready!';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 VERIFICATION RESULTS:';
    RAISE NOTICE '  ✅ Table exists: user_onramp_preferences';
    RAISE NOTICE '  ✅ RLS Policies: % active', policy_count;
    RAISE NOTICE '  ✅ Indexes: % created', index_count;
    RAISE NOTICE '  ✅ Trigger: update_user_onramp_preferences_updated_at';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 NEXT STEPS:';
    RAISE NOTICE '  1. Refresh your app (hard refresh: Cmd+Shift+R / Ctrl+Shift+F5)';
    RAISE NOTICE '  2. Check Network tab - 404 error should be GONE!';
    RAISE NOTICE '  3. User onramp preferences will now be saved';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  ELSE
    RAISE EXCEPTION '❌ FAILED! Table was not created. Check for errors above.';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- MANUAL VERIFICATION QUERIES (run these separately if you want to check)
-- =============================================================================
-- Check table structure:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND table_name = 'user_onramp_preferences';

-- Check RLS policies:
-- SELECT * FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND tablename = 'user_onramp_preferences';

-- Check indexes:
-- SELECT * FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- AND tablename = 'user_onramp_preferences';

-- Check if RLS is enabled:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename = 'user_onramp_preferences';

-- =============================================================================
-- END OF SCRIPT
-- =============================================================================

