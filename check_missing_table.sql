-- Check which specific table is missing
SELECT 
  'CHECK: email_verification_tokens' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'email_verification_tokens') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT 
  'CHECK: user_profiles',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'user_profiles') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'CHECK: user_activity_log',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'user_activity_log') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'CHECK: trusted_devices',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'trusted_devices') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'CHECK: user_security_scores',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'user_security_scores') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'CHECK: user_transaction_stats',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'user_transaction_stats') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'CHECK: transaction_notes',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'transaction_notes') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'CHECK: failed_login_attempts',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = 'failed_login_attempts') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END;

