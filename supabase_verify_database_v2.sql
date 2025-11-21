-- ============================================
-- 🔍 BLAZE WALLET - DATABASE VERIFICATION V2
-- ============================================
-- This version returns actual TABLE results that you can see in Supabase
--
-- Safe to run: This is READ-ONLY, no data will be modified.
-- ============================================

-- ====================================
-- CHECK 1: TABLES
-- ====================================

SELECT 
  '📋 TABLES' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'email_verification_tokens') THEN '✅'
    ELSE '❌'
  END as email_verification_tokens,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'user_profiles') THEN '✅'
    ELSE '❌'
  END as user_profiles,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'user_activity_log') THEN '✅'
    ELSE '❌'
  END as user_activity_log,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'trusted_devices') THEN '✅'
    ELSE '❌'
  END as trusted_devices,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'user_security_scores') THEN '✅'
    ELSE '❌'
  END as user_security_scores,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'user_transaction_stats') THEN '✅'
    ELSE '❌'
  END as user_transaction_stats,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'transaction_notes') THEN '✅'
    ELSE '❌'
  END as transaction_notes,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'failed_login_attempts') THEN '✅'
    ELSE '❌'
  END as failed_login_attempts;

-- ====================================
-- CHECK 2: FUNCTIONS
-- ====================================

SELECT 
  '⚙️ FUNCTIONS' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'mark_user_unverified') THEN '✅'
    ELSE '❌'
  END as mark_user_unverified,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'calculate_security_score') THEN '✅'
    ELSE '❌'
  END as calculate_security_score,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'log_user_activity') THEN '✅'
    ELSE '❌'
  END as log_user_activity,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column') THEN '✅'
    ELSE '❌'
  END as update_updated_at_column,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'create_user_profile_on_signup') THEN '✅'
    ELSE '❌'
  END as create_user_profile_on_signup;

-- ====================================
-- CHECK 3: TRIGGERS
-- ====================================

SELECT 
  '🔄 TRIGGERS' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE information_schema.triggers.trigger_name = 'update_user_profiles_updated_at') THEN '✅'
    ELSE '❌'
  END as update_user_profiles_updated_at,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE information_schema.triggers.trigger_name = 'update_security_scores_updated_at') THEN '✅'
    ELSE '❌'
  END as update_security_scores_updated_at,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE information_schema.triggers.trigger_name = 'update_transaction_notes_updated_at') THEN '✅'
    ELSE '❌'
  END as update_transaction_notes_updated_at,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE information_schema.triggers.trigger_name = 'on_auth_user_created') THEN '✅'
    ELSE '❌'
  END as on_auth_user_created;

-- ====================================
-- CHECK 4: RLS STATUS
-- ====================================

SELECT 
  information_schema.tables.table_name,
  CASE 
    WHEN pg_class.relrowsecurity THEN '✅ Enabled'
    ELSE '❌ Disabled'
  END as rls_status,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = information_schema.tables.table_name) as policy_count
FROM information_schema.tables
JOIN pg_class ON pg_class.relname = information_schema.tables.table_name
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE information_schema.tables.table_schema = 'public'
  AND pg_namespace.nspname = 'public'
  AND information_schema.tables.table_name IN (
    'email_verification_tokens',
    'user_profiles',
    'user_activity_log',
    'trusted_devices',
    'user_security_scores',
    'user_transaction_stats',
    'transaction_notes',
    'failed_login_attempts'
  )
ORDER BY information_schema.tables.table_name;

-- ====================================
-- CHECK 5: IMPORTANT COLUMNS IN user_profiles
-- ====================================

SELECT 
  'user_profiles COLUMNS' as check_type,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND information_schema.columns.table_name = 'user_profiles' AND information_schema.columns.column_name = 'auto_lock_timeout') THEN '✅' ELSE '❌' END as auto_lock_timeout,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND information_schema.columns.table_name = 'user_profiles' AND information_schema.columns.column_name = 'preferred_currency') THEN '✅' ELSE '❌' END as preferred_currency,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND information_schema.columns.table_name = 'user_profiles' AND information_schema.columns.column_name = 'balance_visible') THEN '✅' ELSE '❌' END as balance_visible,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND information_schema.columns.table_name = 'user_profiles' AND information_schema.columns.column_name = 'two_factor_enabled') THEN '✅' ELSE '❌' END as two_factor_enabled,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND information_schema.columns.table_name = 'user_profiles' AND information_schema.columns.column_name = 'two_factor_secret') THEN '✅' ELSE '❌' END as two_factor_secret,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND information_schema.columns.table_name = 'user_profiles' AND information_schema.columns.column_name = 'avatar_url') THEN '✅' ELSE '❌' END as avatar_url;

-- ====================================
-- CHECK 6: DATA INTEGRITY
-- ====================================

SELECT 
  '🔍 DATA INTEGRITY' as check_type,
  (SELECT COUNT(*) FROM auth.users) as total_auth_users,
  (SELECT COUNT(*) FROM public.user_profiles) as total_profiles,
  (SELECT COUNT(*) 
   FROM auth.users u 
   LEFT JOIN public.user_profiles p ON u.id = p.user_id 
   WHERE p.id IS NULL) as users_without_profiles,
  (SELECT COUNT(*) 
   FROM public.user_profiles p 
   LEFT JOIN auth.users u ON p.user_id = u.id 
   WHERE u.id IS NULL) as orphaned_profiles;

-- ====================================
-- CHECK 7: STORAGE BUCKET
-- ====================================

SELECT 
  '📦 STORAGE' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'user-uploads') THEN '✅ Exists'
    ELSE '❌ Missing'
  END as user_uploads_bucket,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%avatar%') as avatar_policies;

-- ====================================
-- CHECK 8: INDEXES
-- ====================================

SELECT 
  'INDEXES' as check_type,
  CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_email_verification_tokens_token') THEN '✅' ELSE '❌' END as verification_token_idx,
  CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_activity_user_id') THEN '✅' ELSE '❌' END as activity_user_idx,
  CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_trusted_devices_user_id') THEN '✅' ELSE '❌' END as devices_user_idx,
  CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_transaction_notes_user_chain') THEN '✅' ELSE '❌' END as notes_user_chain_idx;

-- ====================================
-- FINAL SUMMARY
-- ====================================

SELECT 
  '📊 SUMMARY' as report_section,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name IN (
    'email_verification_tokens', 'user_profiles', 'user_activity_log', 'trusted_devices',
    'user_security_scores', 'user_transaction_stats', 'transaction_notes', 'failed_login_attempts'
  )) || '/8' as tables_present,
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
   WHERE n.nspname = 'public' AND p.proname IN (
     'mark_user_unverified', 'calculate_security_score', 'log_user_activity',
     'update_updated_at_column', 'create_user_profile_on_signup'
   )) || '/5' as functions_present,
  (SELECT COUNT(*) FROM information_schema.triggers 
   WHERE information_schema.triggers.trigger_name IN (
     'update_user_profiles_updated_at', 'update_security_scores_updated_at',
     'update_transaction_notes_updated_at', 'on_auth_user_created'
   )) || '/4' as triggers_present,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name IN (
      'email_verification_tokens', 'user_profiles', 'user_activity_log', 'trusted_devices',
      'user_security_scores', 'user_transaction_stats', 'transaction_notes', 'failed_login_attempts'
    )) = 8 
    AND (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
         WHERE n.nspname = 'public' AND p.proname IN (
           'mark_user_unverified', 'calculate_security_score', 'log_user_activity',
           'update_updated_at_column', 'create_user_profile_on_signup'
         )) = 5
    AND (SELECT COUNT(*) FROM information_schema.triggers 
         WHERE information_schema.triggers.trigger_name IN (
           'update_user_profiles_updated_at', 'update_security_scores_updated_at',
           'update_transaction_notes_updated_at', 'on_auth_user_created'
         )) >= 4
    THEN '✅ Database OK'
    ELSE '⚠️ Issues Found'
  END as overall_status;

