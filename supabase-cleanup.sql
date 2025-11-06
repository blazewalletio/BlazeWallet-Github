-- ============================================================================
-- 🧹 BLAZE WALLET - SUPABASE CLEANUP SCRIPTS
-- ============================================================================
-- Run these queries in Supabase SQL Editor AFTER reviewing audit report
-- ============================================================================

-- ============================================================================
-- 1. CHECK ROW COUNTS (Run this FIRST to see what we're dealing with)
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
  'user_savings',
  COUNT(*),
  COUNT(DISTINCT user_id),
  MAX(saved_at)
FROM public.user_savings
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
-- 2. CHECK FOR DUPLICATE TABLE SCHEMAS
-- ============================================================================

-- Check scheduled_transactions columns (from migration 04 vs 05)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'scheduled_transactions'
ORDER BY ordinal_position;

-- Check gas_alerts columns (from migration 04 vs 05)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gas_alerts'
ORDER BY ordinal_position;

-- ============================================================================
-- 3. CLEANUP STALE DATA (Run AFTER reviewing row counts)
-- ============================================================================

-- 3.1: Expired AI cache entries (>7 days old)
DELETE FROM ai_cache 
WHERE expires_at < NOW() - INTERVAL '7 days';

-- 3.2: Old wallet sync logs (>30 days old)
DELETE FROM wallet_sync_logs 
WHERE synced_at < NOW() - INTERVAL '30 days';

-- 3.3: Old notifications (read + >30 days old)
DELETE FROM notifications 
WHERE read = true AND created_at < NOW() - INTERVAL '30 days';

-- 3.4: Expired email verification tokens
DELETE FROM email_verification_tokens 
WHERE expires_at < NOW();

-- 3.5: Old scheduled transactions (expired/cancelled/failed + >7 days old)
DELETE FROM scheduled_transactions 
WHERE status IN ('expired', 'cancelled', 'failed')
  AND created_at < NOW() - INTERVAL '7 days';

-- 3.6: Old gas history (>7 days - should be auto-cleaned but check)
-- Note: This should be handled by cleanup_old_gas_history() function
-- Only run if function is not working:
-- DELETE FROM gas_history WHERE created_at < NOW() - INTERVAL '7 days';

-- ============================================================================
-- 4. VERWIJDER OVERBODIGE TABLES (Run ONLY if 200% zeker!)
-- ============================================================================

-- ⚠️ WAARSCHUWING: Run deze queries ALLEEN als je zeker weet dat:
-- 1. wallet_sync_logs is leeg of niet gebruikt
-- 2. user_savings is leeg of niet gebruikt

-- 4.1: Verwijder wallet_sync_logs (niet gebruikt in code)
-- DROP TABLE IF EXISTS public.wallet_sync_logs CASCADE;

-- 4.2: Verwijder oude user_savings (vervangen door transaction_savings + user_savings_stats)
-- DROP TABLE IF EXISTS public.user_savings CASCADE;

-- ============================================================================
-- 5. VERIFY CLEANUP RESULTS
-- ============================================================================

-- Check remaining row counts after cleanup
SELECT 
  'ai_cache' as table_name,
  COUNT(*) as remaining_rows,
  COUNT(*) FILTER (WHERE expires_at < NOW() - INTERVAL '7 days') as stale_rows
FROM ai_cache
UNION ALL
SELECT 
  'notifications',
  COUNT(*),
  COUNT(*) FILTER (WHERE read = true AND created_at < NOW() - INTERVAL '30 days')
FROM notifications
UNION ALL
SELECT 
  'email_verification_tokens',
  COUNT(*),
  COUNT(*) FILTER (WHERE expires_at < NOW())
FROM email_verification_tokens
UNION ALL
SELECT 
  'scheduled_transactions',
  COUNT(*),
  COUNT(*) FILTER (WHERE status IN ('expired', 'cancelled', 'failed') 
    AND created_at < NOW() - INTERVAL '7 days')
FROM scheduled_transactions;

-- ============================================================================
-- 6. DATABASE SIZE AFTER CLEANUP
-- ============================================================================

SELECT 
  pg_size_pretty(pg_database_size(current_database())) as total_db_size,
  pg_size_pretty(
    (SELECT SUM(pg_total_relation_size(schemaname||'.'||tablename))
     FROM pg_tables
     WHERE schemaname = 'public')
  ) as public_schema_size;

