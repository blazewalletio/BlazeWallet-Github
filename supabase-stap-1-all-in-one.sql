-- ============================================================================
-- 🔍 BLAZE WALLET - SUPABASE STAP 1: ALL-IN-ONE VERIFICATIE
-- ============================================================================
-- 
-- Dit script combineert ALLE verificatie queries in ÉÉN result set.
-- Je ziet alle resultaten in één keer!
--
-- Run dit in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ldehmephukevxumwdbwt/sql/new
-- ============================================================================

-- COMBINEER ALLE RESULTATEN IN ÉÉN QUERY
SELECT 
  'TABLE_SIZES' AS report_section,
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS info_1,
  pg_size_pretty(pg_relation_size(schemaname||'.'||relname)) AS info_2,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname) - pg_relation_size(schemaname||'.'||relname)) AS info_3,
  n_live_tup::text AS count_value,
  'Total size | Data size | Index size' AS description
FROM pg_stat_user_tables
WHERE schemaname = 'public'

UNION ALL

-- ROW COUNTS
SELECT 
  'ROW_COUNTS' AS report_section,
  'wallets' AS table_name,
  NULL AS info_1,
  NULL AS info_2,
  NULL AS info_3,
  COUNT(*)::text AS count_value,
  'Total rows' AS description
FROM public.wallets
UNION ALL
SELECT 'ROW_COUNTS', 'wallet_sync_logs', NULL, NULL, NULL, COUNT(*)::text, 'Total rows' FROM public.wallet_sync_logs
UNION ALL
SELECT 'ROW_COUNTS', 'ai_cache', NULL, NULL, NULL, COUNT(*)::text, 'Total rows' FROM public.ai_cache
UNION ALL
SELECT 'ROW_COUNTS', 'ai_rate_limits', NULL, NULL, NULL, COUNT(*)::text, 'Total rows' FROM public.ai_rate_limits
UNION ALL
SELECT 'ROW_COUNTS', 'gas_history', NULL, NULL, NULL, COUNT(*)::text, 'Total rows' FROM public.gas_history
UNION ALL
SELECT 'ROW_COUNTS', 'gas_alerts', NULL, NULL, NULL, COUNT(*)::text, 'Total rows' FROM public.gas_alerts
UNION ALL
SELECT 'ROW_COUNTS', 'scheduled_transactions', NULL, NULL, NULL, COUNT(*)::text, 'Total rows' FROM public.scheduled_transactions
UNION ALL
SELECT 'ROW_COUNTS', 'user_savings', NULL, NULL, NULL, COUNT(*)::text, 'Total rows' FROM public.user_savings
UNION ALL
SELECT 'ROW_COUNTS', 'recurring_sends', NULL, NULL, NULL, COUNT(*)::text, 'Total rows' FROM public.recurring_sends
UNION ALL
SELECT 'ROW_COUNTS', 'transaction_savings', NULL, NULL, NULL, COUNT(*)::text, 'Total rows' FROM public.transaction_savings
UNION ALL
SELECT 'ROW_COUNTS', 'user_savings_stats', NULL, NULL, NULL, COUNT(*)::text, 'Total rows' FROM public.user_savings_stats
UNION ALL
SELECT 'ROW_COUNTS', 'notifications', NULL, NULL, NULL, COUNT(*)::text, 'Total rows' FROM public.notifications
UNION ALL
SELECT 'ROW_COUNTS', 'priority_list_registrations', NULL, NULL, NULL, COUNT(*)::text, 'Total rows' FROM public.priority_list_registrations
UNION ALL
SELECT 'ROW_COUNTS', 'admin_actions', NULL, NULL, NULL, COUNT(*)::text, 'Total rows' FROM public.admin_actions
UNION ALL
SELECT 'ROW_COUNTS', 'email_verification_tokens', NULL, NULL, NULL, COUNT(*)::text, 'Total rows' FROM public.email_verification_tokens

UNION ALL

-- OVERBODIGE TABLES
SELECT 
  'OVERBODIGE_TABLES' AS report_section,
  'wallet_sync_logs' AS table_name,
  COUNT(*)::text AS info_1,
  COUNT(DISTINCT user_id)::text AS info_2,
  COALESCE(MIN(synced_at)::text, 'N/A') AS info_3,
  COALESCE(MAX(synced_at)::text, 'N/A') AS count_value,
  'Total rows | Unique users | Oldest | Newest' AS description
FROM public.wallet_sync_logs
UNION ALL
SELECT 
  'OVERBODIGE_TABLES',
  'user_savings',
  COUNT(*)::text,
  COUNT(DISTINCT user_id)::text,
  COALESCE(SUM(usd_saved)::text, '0'),
  COALESCE(MIN(saved_at)::text, 'N/A') || ' | ' || COALESCE(MAX(saved_at)::text, 'N/A'),
  'Total rows | Unique users | Total USD saved | Date range'
FROM public.user_savings

UNION ALL

-- STALE DATA
SELECT 
  'STALE_DATA' AS report_section,
  'ai_cache (expired >7d)' AS table_name,
  NULL AS info_1,
  NULL AS info_2,
  NULL AS info_3,
  COUNT(*)::text AS count_value,
  'Expired entries older than 7 days' AS description
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

ORDER BY 
  CASE report_section
    WHEN 'TABLE_SIZES' THEN 1
    WHEN 'ROW_COUNTS' THEN 2
    WHEN 'OVERBODIGE_TABLES' THEN 3
    WHEN 'STALE_DATA' THEN 4
  END,
  table_name;

-- ============================================================================
-- ✅ ALLE RESULTATEN IN ÉÉN OVERZICHT!
-- ============================================================================
-- 
-- Je ziet nu:
-- 1. TABLE_SIZES - Alle tables met sizes (gesorteerd op grootte)
-- 2. ROW_COUNTS - Exact aantal rijen per table
-- 3. OVERBODIGE_TABLES - Details over wallet_sync_logs en user_savings
-- 4. STALE_DATA - Oude data die opgeruimd kan worden
--
-- Filter op report_section om specifieke secties te zien!
-- ============================================================================

