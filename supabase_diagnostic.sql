-- ============================================
-- 🔍 DETAILED DIAGNOSTIC - Find Missing Items
-- ============================================

-- Which TABLE is missing?
SELECT 
  'MISSING TABLES' as issue_type,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'email_verification_tokens') THEN NULL ELSE 'email_verification_tokens' END as missing_1,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'user_profiles') THEN NULL ELSE 'user_profiles' END as missing_2,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'user_activity_log') THEN NULL ELSE 'user_activity_log' END as missing_3,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'trusted_devices') THEN NULL ELSE 'trusted_devices' END as missing_4,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'user_security_scores') THEN NULL ELSE 'user_security_scores' END as missing_5,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'user_transaction_stats') THEN NULL ELSE 'user_transaction_stats' END as missing_6,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'transaction_notes') THEN NULL ELSE 'transaction_notes' END as missing_7,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'failed_login_attempts') THEN NULL ELSE 'failed_login_attempts' END as missing_8;

-- Which TRIGGER is missing?
SELECT 
  'MISSING TRIGGERS' as issue_type,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE information_schema.triggers.trigger_name = 'update_user_profiles_updated_at') THEN NULL ELSE 'update_user_profiles_updated_at' END as missing_1,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE information_schema.triggers.trigger_name = 'update_security_scores_updated_at') THEN NULL ELSE 'update_security_scores_updated_at' END as missing_2,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE information_schema.triggers.trigger_name = 'update_transaction_notes_updated_at') THEN NULL ELSE 'update_transaction_notes_updated_at' END as missing_3,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE information_schema.triggers.trigger_name = 'on_auth_user_created') THEN NULL ELSE 'on_auth_user_created' END as missing_4;

-- Show ALL existing tables in public schema (to see what you DO have)
SELECT 
  'EXISTING TABLES' as info,
  string_agg(information_schema.tables.table_name, ', ' ORDER BY information_schema.tables.table_name) as all_public_tables
FROM information_schema.tables
WHERE table_schema = 'public';

-- Show ALL existing triggers (to see what you DO have)
SELECT 
  'EXISTING TRIGGERS' as info,
  string_agg(DISTINCT information_schema.triggers.trigger_name, ', ' ORDER BY information_schema.triggers.trigger_name) as all_triggers
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'auth');

