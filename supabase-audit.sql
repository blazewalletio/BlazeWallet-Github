-- ============================================================================
-- 🔍 BLAZE WALLET - SUPABASE DATABASE AUDIT
-- ============================================================================
-- Run this in Supabase SQL Editor to get complete overview
-- ============================================================================

-- ============================================================================
-- 1. ALL TABLES IN DATABASE
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname IN ('public', 'auth')
ORDER BY size_bytes DESC;

-- ============================================================================
-- 2. TABLE ROW COUNTS (Check for empty/unused tables)
-- ============================================================================
SELECT 
  'wallets' as table_name,
  COUNT(*) as row_count,
  COUNT(DISTINCT user_id) as unique_users,
  MAX(created_at) as last_record
FROM public.wallets
UNION ALL
SELECT 
  'wallet_sync_logs',
  COUNT(*),
  COUNT(DISTINCT user_id),
  MAX(synced_at)
FROM public.wallet_sync_logs
UNION ALL
SELECT 
  'ai_cache',
  COUNT(*),
  COUNT(DISTINCT user_id),
  MAX(created_at)
FROM public.ai_cache
UNION ALL
SELECT 
  'ai_rate_limits',
  COUNT(*),
  COUNT(DISTINCT user_id),
  MAX(updated_at)
FROM public.ai_rate_limits
UNION ALL
SELECT 
  'gas_history',
  COUNT(*),
  COUNT(DISTINCT chain),
  MAX(created_at)
FROM public.gas_history
UNION ALL
SELECT 
  'gas_alerts',
  COUNT(*),
  COUNT(DISTINCT user_id),
  MAX(created_at)
FROM public.gas_alerts
UNION ALL
SELECT 
  'scheduled_transactions',
  COUNT(*),
  COUNT(DISTINCT user_id),
  MAX(created_at)
FROM public.scheduled_transactions
UNION ALL
SELECT 
  'recurring_sends',
  COUNT(*),
  COUNT(DISTINCT user_id),
  MAX(created_at)
FROM public.recurring_sends
UNION ALL
SELECT 
  'transaction_savings',
  COUNT(*),
  COUNT(DISTINCT user_id),
  MAX(executed_at)
FROM public.transaction_savings
UNION ALL
SELECT 
  'user_savings_stats',
  COUNT(*),
  COUNT(DISTINCT user_id),
  MAX(updated_at)
FROM public.user_savings_stats
UNION ALL
SELECT 
  'notifications',
  COUNT(*),
  COUNT(DISTINCT user_id),
  MAX(created_at)
FROM public.notifications
UNION ALL
SELECT 
  'priority_list_registrations',
  COUNT(*),
  COUNT(DISTINCT email),
  MAX(created_at)
FROM public.priority_list_registrations
UNION ALL
SELECT 
  'admin_actions',
  COUNT(*),
  COUNT(DISTINCT admin_email),
  MAX(created_at)
FROM public.admin_actions
UNION ALL
SELECT 
  'email_verification_tokens',
  COUNT(*),
  COUNT(DISTINCT email),
  MAX(created_at)
FROM public.email_verification_tokens
ORDER BY row_count DESC;

-- ============================================================================
-- 3. CHECK FOR DUPLICATE TABLES (from multiple migrations)
-- ============================================================================
-- Check if scheduled_transactions exists multiple times or has conflicts
SELECT 
  table_name,
  COUNT(*) as occurrences
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'scheduled_transactions',
    'gas_alerts',
    'user_savings',
    'gas_history'
  )
GROUP BY table_name
HAVING COUNT(*) > 1;

-- ============================================================================
-- 4. CHECK FOR OLD/UNUSED TABLES (not in migrations)
-- ============================================================================
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    -- Expected tables from migrations
    'wallets',
    'wallet_sync_logs',
    'ai_cache',
    'ai_rate_limits',
    'gas_history',
    'gas_alerts',
    'scheduled_transactions',
    'recurring_sends',
    'transaction_savings',
    'user_savings_stats',
    'notifications',
    'priority_list_registrations',
    'admin_actions',
    'email_verification_tokens'
  )
ORDER BY tablename;

-- ============================================================================
-- 5. CHECK FOR EMPTY TABLES (potential cleanup candidates)
-- ============================================================================
SELECT 
  'wallets' as table_name,
  COUNT(*) as rows,
  CASE WHEN COUNT(*) = 0 THEN '⚠️ EMPTY - Can delete if not used' ELSE '✅ Has data' END as status
FROM public.wallets
UNION ALL
SELECT 'wallet_sync_logs', COUNT(*), 
  CASE WHEN COUNT(*) = 0 THEN '⚠️ EMPTY - Can delete if not used' ELSE '✅ Has data' END
FROM public.wallet_sync_logs
UNION ALL
SELECT 'ai_cache', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '⚠️ EMPTY - Can delete if not used' ELSE '✅ Has data' END
FROM public.ai_cache
UNION ALL
SELECT 'ai_rate_limits', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '⚠️ EMPTY - Can delete if not used' ELSE '✅ Has data' END
FROM public.ai_rate_limits
UNION ALL
SELECT 'gas_history', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '⚠️ EMPTY - Can delete if not used' ELSE '✅ Has data' END
FROM public.gas_history
UNION ALL
SELECT 'gas_alerts', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '⚠️ EMPTY - Can delete if not used' ELSE '✅ Has data' END
FROM public.gas_alerts
UNION ALL
SELECT 'scheduled_transactions', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '⚠️ EMPTY - Can delete if not used' ELSE '✅ Has data' END
FROM public.scheduled_transactions
UNION ALL
SELECT 'recurring_sends', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '⚠️ EMPTY - Can delete if not used' ELSE '✅ Has data' END
FROM public.recurring_sends
UNION ALL
SELECT 'transaction_savings', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '⚠️ EMPTY - Can delete if not used' ELSE '✅ Has data' END
FROM public.transaction_savings
UNION ALL
SELECT 'user_savings_stats', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '⚠️ EMPTY - Can delete if not used' ELSE '✅ Has data' END
FROM public.user_savings_stats
UNION ALL
SELECT 'notifications', COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '⚠️ EMPTY - Can delete if not used' ELSE '✅ Has data' END
FROM public.notifications
ORDER BY rows ASC;

-- ============================================================================
-- 6. CHECK FOR STALE DATA (old records that can be cleaned)
-- ============================================================================
SELECT 
  'ai_cache (expired)' as category,
  COUNT(*) as stale_records
FROM public.ai_cache
WHERE expires_at < NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
  'wallet_sync_logs (old)',
  COUNT(*)
FROM public.wallet_sync_logs
WHERE synced_at < NOW() - INTERVAL '30 days'
UNION ALL
SELECT 
  'gas_history (old)',
  COUNT(*)
FROM public.gas_history
WHERE created_at < NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
  'notifications (read + old)',
  COUNT(*)
FROM public.notifications
WHERE read = true AND created_at < NOW() - INTERVAL '30 days'
UNION ALL
SELECT 
  'email_verification_tokens (expired)',
  COUNT(*)
FROM public.email_verification_tokens
WHERE expires_at < NOW()
UNION ALL
SELECT 
  'scheduled_transactions (expired/cancelled)',
  COUNT(*)
FROM public.scheduled_transactions
WHERE status IN ('expired', 'cancelled', 'failed')
  AND created_at < NOW() - INTERVAL '7 days';

-- ============================================================================
-- 7. CHECK FOR UNUSED FUNCTIONS/TRIGGERS
-- ============================================================================
SELECT 
  routine_name,
  routine_type,
  routine_schema
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- ============================================================================
-- 8. CHECK FOR EXTENSIONS (pg_cron, etc.)
-- ============================================================================
SELECT 
  extname,
  extversion
FROM pg_extension
ORDER BY extname;

-- ============================================================================
-- 9. CHECK FOR CRON JOBS (if pg_cron enabled)
-- ============================================================================
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
ORDER BY jobid;

-- ============================================================================
-- 10. DATABASE SIZE BREAKDOWN
-- ============================================================================
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as total_db_size,
  pg_size_pretty(
    SELECT SUM(pg_total_relation_size(schemaname||'.'||tablename))
    FROM pg_tables
    WHERE schemaname = 'public'
  ) as public_schema_size;

-- ============================================================================
-- 11. CHECK FOR INDEXES (can be optimized)
-- ============================================================================
SELECT 
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

