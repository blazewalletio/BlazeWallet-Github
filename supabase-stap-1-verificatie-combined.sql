-- ============================================================================
-- 🔍 BLAZE WALLET - SUPABASE STAP 1: VERIFICATIE (COMBINED VERSION)
-- ============================================================================
-- 
-- Dit script combineert alle verificatie queries in één overzicht.
-- Het verwijdert NIETS, alleen lezen!
--
-- Run dit in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ldehmephukevxumwdbwt/sql/new
-- ============================================================================

-- ============================================================================
-- OVERZICHT 1: ALLE TABLES MET SIZES
-- ============================================================================
SELECT
  'TABLE_SIZES' AS report_section,
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||relname)) AS data_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname) - pg_relation_size(schemaname||'.'||relname)) AS index_size,
  n_live_tup::text AS row_count,
  NULL::text AS extra_info
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC;

-- ============================================================================
-- OVERZICHT 2: EXACT ROW COUNTS PER TABLE
-- ============================================================================
SELECT 
  'ROW_COUNTS' AS report_section,
  'wallets' AS table_name,
  NULL AS total_size,
  NULL AS data_size,
  NULL AS index_size,
  COUNT(*)::text AS row_count,
  NULL::text AS extra_info
FROM public.wallets
UNION ALL
SELECT 'ROW_COUNTS', 'wallet_sync_logs', NULL, NULL, NULL, COUNT(*)::text, NULL FROM public.wallet_sync_logs
UNION ALL
SELECT 'ROW_COUNTS', 'ai_cache', NULL, NULL, NULL, COUNT(*)::text, NULL FROM public.ai_cache
UNION ALL
SELECT 'ROW_COUNTS', 'ai_rate_limits', NULL, NULL, NULL, COUNT(*)::text, NULL FROM public.ai_rate_limits
UNION ALL
SELECT 'ROW_COUNTS', 'gas_history', NULL, NULL, NULL, COUNT(*)::text, NULL FROM public.gas_history
UNION ALL
SELECT 'ROW_COUNTS', 'gas_alerts', NULL, NULL, NULL, COUNT(*)::text, NULL FROM public.gas_alerts
UNION ALL
SELECT 'ROW_COUNTS', 'scheduled_transactions', NULL, NULL, NULL, COUNT(*)::text, NULL FROM public.scheduled_transactions
UNION ALL
SELECT 'ROW_COUNTS', 'user_savings', NULL, NULL, NULL, COUNT(*)::text, NULL FROM public.user_savings
UNION ALL
SELECT 'ROW_COUNTS', 'recurring_sends', NULL, NULL, NULL, COUNT(*)::text, NULL FROM public.recurring_sends
UNION ALL
SELECT 'ROW_COUNTS', 'transaction_savings', NULL, NULL, NULL, COUNT(*)::text, NULL FROM public.transaction_savings
UNION ALL
SELECT 'ROW_COUNTS', 'user_savings_stats', NULL, NULL, NULL, COUNT(*)::text, NULL FROM public.user_savings_stats
UNION ALL
SELECT 'ROW_COUNTS', 'notifications', NULL, NULL, NULL, COUNT(*)::text, NULL FROM public.notifications
UNION ALL
SELECT 'ROW_COUNTS', 'priority_list_registrations', NULL, NULL, NULL, COUNT(*)::text, NULL FROM public.priority_list_registrations
UNION ALL
SELECT 'ROW_COUNTS', 'admin_actions', NULL, NULL, NULL, COUNT(*)::text, NULL FROM public.admin_actions
UNION ALL
SELECT 'ROW_COUNTS', 'email_verification_tokens', NULL, NULL, NULL, COUNT(*)::text, NULL FROM public.email_verification_tokens
ORDER BY table_name;

-- ============================================================================
-- OVERZICHT 3: OVERBODIGE TABLES DETAILS
-- ============================================================================
SELECT 
  'OVERBODIGE_TABLES' AS report_section,
  'wallet_sync_logs' AS table_name,
  NULL AS total_size,
  NULL AS data_size,
  NULL AS index_size,
  COUNT(*)::text AS row_count,
  'Unique users: ' || COUNT(DISTINCT user_id)::text || 
  ' | Oldest: ' || COALESCE(MIN(synced_at)::text, 'N/A') ||
  ' | Newest: ' || COALESCE(MAX(synced_at)::text, 'N/A') AS extra_info
FROM public.wallet_sync_logs
UNION ALL
SELECT 
  'OVERBODIGE_TABLES',
  'user_savings',
  NULL,
  NULL,
  NULL,
  COUNT(*)::text,
  'Unique users: ' || COUNT(DISTINCT user_id)::text ||
  ' | Total USD saved: $' || COALESCE(SUM(usd_saved)::text, '0') ||
  ' | Oldest: ' || COALESCE(MIN(saved_at)::text, 'N/A') ||
  ' | Newest: ' || COALESCE(MAX(saved_at)::text, 'N/A') AS extra_info
FROM public.user_savings;

-- ============================================================================
-- OVERZICHT 4: STALE DATA (data die opgeruimd kan worden)
-- ============================================================================
SELECT 
  'STALE_DATA' AS report_section,
  'ai_cache (expired >7d)' AS table_name,
  NULL AS total_size,
  NULL AS data_size,
  NULL AS index_size,
  COUNT(*)::text AS row_count,
  'Expired entries older than 7 days' AS extra_info
FROM public.ai_cache
WHERE created_at < NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
  'STALE_DATA',
  'wallet_sync_logs (old >30d)',
  NULL,
  NULL,
  NULL,
  COUNT(*)::text,
  'Old logs older than 30 days'
FROM public.wallet_sync_logs
WHERE synced_at < NOW() - INTERVAL '30 days'
UNION ALL
SELECT 
  'STALE_DATA',
  'gas_history (old >7d)',
  NULL,
  NULL,
  NULL,
  COUNT(*)::text,
  'Old gas history older than 7 days (auto-cleanup enabled)'
FROM public.gas_history
WHERE created_at < NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
  'STALE_DATA',
  'notifications (read + old >30d)',
  NULL,
  NULL,
  NULL,
  COUNT(*)::text,
  'Read notifications older than 30 days'
FROM public.notifications
WHERE read = true AND created_at < NOW() - INTERVAL '30 days'
UNION ALL
SELECT 
  'STALE_DATA',
  'email_verification_tokens (expired)',
  NULL,
  NULL,
  NULL,
  COUNT(*)::text,
  'Expired verification tokens'
FROM public.email_verification_tokens
WHERE expires_at < NOW()
UNION ALL
SELECT 
  'STALE_DATA',
  'scheduled_transactions (' || status || ' >7d)',
  NULL,
  NULL,
  NULL,
  COUNT(*)::text,
  'Expired/cancelled/failed transactions older than 7 days'
FROM public.scheduled_transactions
WHERE status IN ('expired', 'cancelled', 'failed')
  AND updated_at < NOW() - INTERVAL '7 days'
GROUP BY status
ORDER BY table_name;

-- ============================================================================
-- ✅ STAP 1 COMPLEET!
-- ============================================================================
-- 
-- Je hebt nu 4 overzichten:
-- 1. TABLE_SIZES - Alle tables met sizes
-- 2. ROW_COUNTS - Exact aantal rijen per table
-- 3. OVERBODIGE_TABLES - Details over wallet_sync_logs en user_savings
-- 4. STALE_DATA - Oude data die opgeruimd kan worden
--
-- Volgende stap: Review de resultaten en besluit of je STAP 2 (cleanup) wilt runnen
-- ============================================================================

