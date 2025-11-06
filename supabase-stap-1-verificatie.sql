-- ============================================================================
-- 🔍 BLAZE WALLET - SUPABASE STAP 1: VERIFICATIE
-- ============================================================================
-- 
-- Dit script checkt alle tables en data in je Supabase database.
-- Het verwijdert NIETS, alleen lezen!
--
-- Run dit in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ldehmephukevxumwdbwt/sql/new
-- ============================================================================

-- 1.1. TABLE SIZES & ROW COUNTS
-- ============================================================================
SELECT
  schemaname,
  relname AS tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||relname)) AS data_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname) - pg_relation_size(schemaname||'.'||relname)) AS index_size,
  n_live_tup AS estimated_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC;

-- 1.2. EXACT ROW COUNTS (meer accuraat)
-- ============================================================================
SELECT 'wallets' AS table_name, COUNT(*) AS row_count FROM public.wallets
UNION ALL
SELECT 'wallet_sync_logs', COUNT(*) FROM public.wallet_sync_logs
UNION ALL
SELECT 'ai_cache', COUNT(*) FROM public.ai_cache
UNION ALL
SELECT 'ai_rate_limits', COUNT(*) FROM public.ai_rate_limits
UNION ALL
SELECT 'gas_history', COUNT(*) FROM public.gas_history
UNION ALL
SELECT 'gas_alerts', COUNT(*) FROM public.gas_alerts
UNION ALL
SELECT 'scheduled_transactions', COUNT(*) FROM public.scheduled_transactions
UNION ALL
SELECT 'user_savings', COUNT(*) FROM public.user_savings
UNION ALL
SELECT 'recurring_sends', COUNT(*) FROM public.recurring_sends
UNION ALL
SELECT 'transaction_savings', COUNT(*) FROM public.transaction_savings
UNION ALL
SELECT 'user_savings_stats', COUNT(*) FROM public.user_savings_stats
UNION ALL
SELECT 'notifications', COUNT(*) FROM public.notifications
UNION ALL
SELECT 'priority_list_registrations', COUNT(*) FROM public.priority_list_registrations
UNION ALL
SELECT 'admin_actions', COUNT(*) FROM public.admin_actions
UNION ALL
SELECT 'email_verification_tokens', COUNT(*) FROM public.email_verification_tokens
ORDER BY table_name;

-- 1.3. CHECK OVERBODIGE TABLES (100% ZEKER NIET GEBRUIKT)
-- ============================================================================
-- Deze tables worden NIET gebruikt in de codebase:

-- wallet_sync_logs: Geen enkele .from('wallet_sync_logs') query gevonden
SELECT 
  'wallet_sync_logs' AS table_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT user_id) AS unique_users,
  MIN(synced_at) AS oldest_log,
  MAX(synced_at) AS newest_log
FROM public.wallet_sync_logs;

-- user_savings: Vervangen door transaction_savings + user_savings_stats
-- Geen enkele .from('user_savings') query gevonden
SELECT 
  'user_savings' AS table_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT user_id) AS unique_users,
  SUM(usd_saved) AS total_usd_saved,
  MIN(saved_at) AS oldest_saving,
  MAX(saved_at) AS newest_saving
FROM public.user_savings;

-- 1.4. CHECK STALE DATA (data die opgeruimd kan worden)
-- ============================================================================

-- ai_cache: Expired entries (>7 dagen)
SELECT 
  'ai_cache (expired >7d)' AS category,
  COUNT(*) AS count
FROM public.ai_cache
WHERE created_at < NOW() - INTERVAL '7 days';

-- wallet_sync_logs: Oude logs (>30 dagen) - alleen als je deze table houdt
SELECT 
  'wallet_sync_logs (old >30d)' AS category,
  COUNT(*) AS count
FROM public.wallet_sync_logs
WHERE synced_at < NOW() - INTERVAL '30 days';

-- gas_history: Oude data (>7 dagen) - AUTO-CLEANUP al ingesteld, maar check
SELECT 
  'gas_history (old >7d)' AS category,
  COUNT(*) AS count
FROM public.gas_history
WHERE created_at < NOW() - INTERVAL '7 days';

-- notifications: Read + oud (>30 dagen)
SELECT 
  'notifications (read + old >30d)' AS category,
  COUNT(*) AS count
FROM public.notifications
WHERE read = true AND created_at < NOW() - INTERVAL '30 days';

-- email_verification_tokens: Expired tokens
SELECT 
  'email_verification_tokens (expired)' AS category,
  COUNT(*) AS count
FROM public.email_verification_tokens
WHERE expires_at < NOW();

-- scheduled_transactions: Expired/cancelled/failed (>7 dagen oud)
SELECT 
  'scheduled_transactions (expired/cancelled/failed >7d)' AS category,
  COUNT(*) AS count,
  status
FROM public.scheduled_transactions
WHERE status IN ('expired', 'cancelled', 'failed')
  AND updated_at < NOW() - INTERVAL '7 days'
GROUP BY status;

-- ============================================================================
-- ✅ STAP 1 COMPLEET!
-- ============================================================================
-- 
-- Je hebt nu een overzicht van:
-- ✅ Alle table sizes en row counts
-- ✅ Overbodige tables (wallet_sync_logs, user_savings)
-- ✅ Stale data die opgeruimd kan worden
--
-- Volgende stap: Review de resultaten en besluit of je STAP 2 (cleanup) wilt runnen
-- ============================================================================

