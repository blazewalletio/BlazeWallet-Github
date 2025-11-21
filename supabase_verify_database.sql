-- ============================================
-- 🔍 BLAZE WALLET - DATABASE VERIFICATION
-- ============================================
-- This script verifies the current Supabase database setup
-- WITHOUT making any changes. Use this to check if everything is correct.
--
-- Safe to run: This is READ-ONLY, no data will be modified.
--
-- Created: 2025-11-21
-- Version: 1.0
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '🔍 Starting BLAZE Wallet database verification...';
  RAISE NOTICE '';
END $$;

-- ====================================
-- CHECK 1: TABLES
-- ====================================

DO $$
DECLARE
  expected_tables TEXT[] := ARRAY[
    'email_verification_tokens',
    'user_profiles',
    'user_activity_log',
    'trusted_devices',
    'user_security_scores',
    'user_transaction_stats',
    'transaction_notes',
    'failed_login_attempts'
  ];
  v_table_name TEXT;
  v_table_exists BOOLEAN;
  missing_count INTEGER := 0;
BEGIN
  RAISE NOTICE '📋 Checking Tables...';
  RAISE NOTICE '-------------------------------------------';
  
  FOREACH v_table_name IN ARRAY expected_tables
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table_name
    ) INTO v_table_exists;
    
    IF v_table_exists THEN
      RAISE NOTICE '✅ % exists', v_table_name;
    ELSE
      RAISE NOTICE '❌ % MISSING', v_table_name;
      missing_count := missing_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  IF missing_count > 0 THEN
    RAISE NOTICE '⚠️  % table(s) missing!', missing_count;
  ELSE
    RAISE NOTICE '✅ All tables present';
  END IF;
  RAISE NOTICE '';
END $$;

-- ====================================
-- CHECK 2: COLUMNS IN user_profiles
-- ====================================

DO $$
DECLARE
  expected_columns TEXT[] := ARRAY[
    'id',
    'user_id',
    'display_name',
    'avatar_url',
    'phone_number',
    'preferred_currency',
    'timezone',
    'theme',
    'balance_visible',
    'notifications_enabled',
    'two_factor_enabled',
    'two_factor_method',
    'two_factor_secret',
    'auto_lock_timeout',
    'created_at',
    'updated_at'
  ];
  v_column_name TEXT;
  v_column_exists BOOLEAN;
  missing_count INTEGER := 0;
BEGIN
  RAISE NOTICE '📋 Checking user_profiles columns...';
  RAISE NOTICE '-------------------------------------------';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'user_profiles') THEN
    FOREACH v_column_name IN ARRAY expected_columns
    LOOP
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND information_schema.columns.table_name = 'user_profiles'
        AND information_schema.columns.column_name = v_column_name
      ) INTO v_column_exists;
      
      IF v_column_exists THEN
        RAISE NOTICE '✅ %', v_column_name;
      ELSE
        RAISE NOTICE '❌ % MISSING', v_column_name;
        missing_count := missing_count + 1;
      END IF;
    END LOOP;
    
    RAISE NOTICE '';
    IF missing_count > 0 THEN
      RAISE NOTICE '⚠️  % column(s) missing!', missing_count;
    ELSE
      RAISE NOTICE '✅ All columns present';
    END IF;
  ELSE
    RAISE NOTICE '❌ user_profiles table does not exist!';
  END IF;
  RAISE NOTICE '';
END $$;

-- ====================================
-- CHECK 3: FUNCTIONS
-- ====================================

DO $$
DECLARE
  expected_functions TEXT[] := ARRAY[
    'mark_user_unverified',
    'calculate_security_score',
    'log_user_activity',
    'update_updated_at_column',
    'create_user_profile_on_signup'
  ];
  v_function_name TEXT;
  v_function_exists BOOLEAN;
  missing_count INTEGER := 0;
BEGIN
  RAISE NOTICE '⚙️  Checking Functions...';
  RAISE NOTICE '-------------------------------------------';
  
  FOREACH v_function_name IN ARRAY expected_functions
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = v_function_name
    ) INTO v_function_exists;
    
    IF v_function_exists THEN
      RAISE NOTICE '✅ %', v_function_name;
    ELSE
      RAISE NOTICE '❌ % MISSING', v_function_name;
      missing_count := missing_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  IF missing_count > 0 THEN
    RAISE NOTICE '⚠️  % function(s) missing!', missing_count;
  ELSE
    RAISE NOTICE '✅ All functions present';
  END IF;
  RAISE NOTICE '';
END $$;

-- ====================================
-- CHECK 4: TRIGGERS
-- ====================================

DO $$
DECLARE
  expected_triggers TEXT[] := ARRAY[
    'update_user_profiles_updated_at',
    'update_security_scores_updated_at',
    'update_transaction_notes_updated_at',
    'on_auth_user_created'
  ];
  v_trigger_name TEXT;
  v_trigger_exists BOOLEAN;
  missing_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔄 Checking Triggers...';
  RAISE NOTICE '-------------------------------------------';
  
  FOREACH v_trigger_name IN ARRAY expected_triggers
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE information_schema.triggers.trigger_name = v_trigger_name
    ) INTO v_trigger_exists;
    
    IF v_trigger_exists THEN
      RAISE NOTICE '✅ %', v_trigger_name;
    ELSE
      RAISE NOTICE '❌ % MISSING', v_trigger_name;
      missing_count := missing_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  IF missing_count > 0 THEN
    RAISE NOTICE '⚠️  % trigger(s) missing!', missing_count;
  ELSE
    RAISE NOTICE '✅ All triggers present';
  END IF;
  RAISE NOTICE '';
END $$;

-- ====================================
-- CHECK 5: RLS POLICIES
-- ====================================

DO $$
DECLARE
  v_table_name TEXT;
  v_rls_enabled BOOLEAN;
  v_policy_count INTEGER;
  tables_to_check TEXT[] := ARRAY[
    'email_verification_tokens',
    'user_profiles',
    'user_activity_log',
    'trusted_devices',
    'user_security_scores',
    'user_transaction_stats',
    'transaction_notes',
    'failed_login_attempts'
  ];
  total_issues INTEGER := 0;
BEGIN
  RAISE NOTICE '🔐 Checking RLS Policies...';
  RAISE NOTICE '-------------------------------------------';
  
  FOREACH v_table_name IN ARRAY tables_to_check
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = v_table_name) THEN
      -- Check if RLS is enabled
      SELECT relrowsecurity INTO v_rls_enabled
      FROM pg_class
      JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
      WHERE pg_namespace.nspname = 'public'
      AND pg_class.relname = v_table_name;
      
      -- Count policies
      SELECT COUNT(*) INTO v_policy_count
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = v_table_name;
      
      IF v_rls_enabled AND v_policy_count > 0 THEN
        RAISE NOTICE '✅ % (RLS enabled, % policies)', v_table_name, v_policy_count;
      ELSIF NOT v_rls_enabled THEN
        RAISE NOTICE '❌ % (RLS NOT ENABLED)', v_table_name;
        total_issues := total_issues + 1;
      ELSIF v_policy_count = 0 THEN
        RAISE NOTICE '⚠️  % (RLS enabled but NO POLICIES)', v_table_name;
        total_issues := total_issues + 1;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  IF total_issues > 0 THEN
    RAISE NOTICE '⚠️  % RLS issue(s) found!', total_issues;
  ELSE
    RAISE NOTICE '✅ All RLS policies configured correctly';
  END IF;
  RAISE NOTICE '';
END $$;

-- ====================================
-- CHECK 6: STORAGE BUCKET
-- ====================================

DO $$
DECLARE
  bucket_exists BOOLEAN;
  policy_count INTEGER;
BEGIN
  RAISE NOTICE '📦 Checking Storage Bucket...';
  RAISE NOTICE '-------------------------------------------';
  
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'user-uploads'
  ) INTO bucket_exists;
  
  IF bucket_exists THEN
    RAISE NOTICE '✅ user-uploads bucket exists';
    
    -- Count storage policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE '%avatar%';
    
    RAISE NOTICE '✅ % avatar-related storage policies', policy_count;
  ELSE
    RAISE NOTICE '❌ user-uploads bucket MISSING';
  END IF;
  RAISE NOTICE '';
END $$;

-- ====================================
-- CHECK 7: DATA INTEGRITY
-- ====================================

DO $$
DECLARE
  total_users INTEGER;
  users_with_profiles INTEGER;
  users_without_profiles INTEGER;
  orphaned_profiles INTEGER;
BEGIN
  RAISE NOTICE '🔍 Checking Data Integrity...';
  RAISE NOTICE '-------------------------------------------';
  
  -- Count total auth users
  SELECT COUNT(*) INTO total_users FROM auth.users;
  RAISE NOTICE 'ℹ️  Total auth.users: %', total_users;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
    -- Count users with profiles
    SELECT COUNT(*) INTO users_with_profiles
    FROM auth.users u
    INNER JOIN public.user_profiles p ON u.id = p.user_id;
    
    users_without_profiles := total_users - users_with_profiles;
    
    RAISE NOTICE 'ℹ️  Users with profiles: %', users_with_profiles;
    
    IF users_without_profiles > 0 THEN
      RAISE NOTICE '⚠️  Users WITHOUT profiles: % (orphaned users)', users_without_profiles;
    ELSE
      RAISE NOTICE '✅ All users have profiles';
    END IF;
    
    -- Count orphaned profiles (profiles without users)
    SELECT COUNT(*) INTO orphaned_profiles
    FROM public.user_profiles p
    LEFT JOIN auth.users u ON p.user_id = u.id
    WHERE u.id IS NULL;
    
    IF orphaned_profiles > 0 THEN
      RAISE NOTICE '⚠️  Orphaned profiles (no auth user): %', orphaned_profiles;
    ELSE
      RAISE NOTICE '✅ No orphaned profiles';
    END IF;
  ELSE
    RAISE NOTICE '❌ Cannot check: user_profiles table does not exist';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ====================================
-- CHECK 8: INDEXES
-- ====================================

DO $$
DECLARE
  expected_indexes TEXT[] := ARRAY[
    'idx_email_verification_tokens_token',
    'idx_email_verification_tokens_user_id',
    'idx_activity_user_id',
    'idx_activity_created_at',
    'idx_trusted_devices_user_id',
    'idx_trusted_devices_fingerprint',
    'idx_transaction_notes_user_chain',
    'idx_transaction_notes_tx_hash',
    'idx_failed_login_user',
    'idx_failed_login_locked'
  ];
  v_index_name TEXT;
  v_index_exists BOOLEAN;
  missing_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔍 Checking Indexes...';
  RAISE NOTICE '-------------------------------------------';
  
  FOREACH v_index_name IN ARRAY expected_indexes
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = v_index_name
    ) INTO v_index_exists;
    
    IF v_index_exists THEN
      RAISE NOTICE '✅ %', v_index_name;
    ELSE
      RAISE NOTICE '❌ % MISSING', v_index_name;
      missing_count := missing_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  IF missing_count > 0 THEN
    RAISE NOTICE '⚠️  % index(es) missing!', missing_count;
  ELSE
    RAISE NOTICE '✅ All indexes present';
  END IF;
  RAISE NOTICE '';
END $$;

-- ====================================
-- FINAL SUMMARY
-- ====================================

DO $$
DECLARE
  table_count INTEGER;
  function_count INTEGER;
  trigger_count INTEGER;
  total_policies INTEGER;
BEGIN
  -- Count everything
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'email_verification_tokens',
    'user_profiles',
    'user_activity_log',
    'trusted_devices',
    'user_security_scores',
    'user_transaction_stats',
    'transaction_notes',
    'failed_login_attempts'
  );
  
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname IN (
    'mark_user_unverified',
    'calculate_security_score',
    'log_user_activity',
    'update_updated_at_column',
    'create_user_profile_on_signup'
  );
  
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
  OR trigger_name = 'on_auth_user_created';
  
  SELECT COUNT(*) INTO total_policies
  FROM pg_policies
  WHERE schemaname = 'public';
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '🔍 VERIFICATION SUMMARY';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📋 Tables: %/8', table_count;
  RAISE NOTICE '⚙️  Functions: %/5', function_count;
  RAISE NOTICE '🔄 Triggers: %/4', trigger_count;
  RAISE NOTICE '🔐 RLS Policies: %', total_policies;
  RAISE NOTICE '';
  
  IF table_count = 8 AND function_count = 5 AND trigger_count >= 4 AND total_policies > 0 THEN
    RAISE NOTICE '✅ Database appears to be correctly configured!';
  ELSE
    RAISE NOTICE '⚠️  Database has missing components!';
    RAISE NOTICE '💡 Run supabase_complete_reset.sql to fix';
  END IF;
  
  RAISE NOTICE '============================================';
END $$;

