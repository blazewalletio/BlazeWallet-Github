-- ============================================================================
-- 🔍 BLAZE WALLET - SUPABASE FINAL VERIFICATION & CLEANUP SCRIPT
-- ============================================================================
-- 
-- STAP 1: VERIFICATIE (run eerst dit deel)
-- STAP 2: CLEANUP STALE DATA (optioneel)
-- STAP 3: VERWIJDER OVERBODIGE TABLES (alleen na goedkeuring)
--
-- ⚠️  BELANGRIJK: Run dit script in delen!
-- ============================================================================

-- ============================================================================
-- STAP 1: VERIFICATIE - CHECK ALLE TABLES
-- ============================================================================
-- Run dit eerst om te zien wat er allemaal in de database staat

-- 1.1. TABLE SIZES & ROW COUNTS
-- ============================================================================
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS data_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size,
  n_live_tup AS estimated_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

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
  COUNT(*) AS count,
  pg_size_pretty(SUM(pg_column_size(ai_cache.*))) AS size
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
-- STAP 2: CLEANUP STALE DATA (optioneel - run alleen als je zeker bent)
-- ============================================================================
-- ⚠️  UNCOMMENT DEZE QUERIES ALLEEN ALS JE ZEKER BENT!

/*
-- 2.1. Cleanup expired AI cache (>7 dagen)
DELETE FROM public.ai_cache
WHERE created_at < NOW() - INTERVAL '7 days';

-- 2.2. Cleanup oude wallet sync logs (>30 dagen)
DELETE FROM public.wallet_sync_logs
WHERE synced_at < NOW() - INTERVAL '30 days';

-- 2.3. Cleanup oude gas history (>7 dagen) - AUTO-CLEANUP al ingesteld
-- Deze wordt automatisch opgeruimd door cleanup_old_gas_history() functie
-- Maar je kunt het handmatig doen:
DELETE FROM public.gas_history
WHERE created_at < NOW() - INTERVAL '7 days';

-- 2.4. Cleanup gelezen + oude notifications (>30 dagen)
DELETE FROM public.notifications
WHERE read = true AND created_at < NOW() - INTERVAL '30 days';

-- 2.5. Cleanup expired email verification tokens
DELETE FROM public.email_verification_tokens
WHERE expires_at < NOW();

-- 2.6. Cleanup expired/cancelled/failed scheduled transactions (>7 dagen)
DELETE FROM public.scheduled_transactions
WHERE status IN ('expired', 'cancelled', 'failed')
  AND updated_at < NOW() - INTERVAL '7 days';
*/

-- ============================================================================
-- STAP 3: VERWIJDER OVERBODIGE TABLES (100% ZEKER OVERBODIG)
-- ============================================================================
-- ⚠️  ⚠️  ⚠️  KRITIEK: UNCOMMENT ALLEEN NA GOEDKEURING! ⚠️  ⚠️  ⚠️
-- 
-- Deze tables zijn 100% zeker overbodig:
-- 1. wallet_sync_logs - Geen enkele query gebruikt deze table
-- 2. user_savings - Vervangen door transaction_savings + user_savings_stats
--
-- ⚠️  BACKUP EERST JE DATABASE VOOR JE DIT RUNS!

/*
-- 3.1. Verwijder wallet_sync_logs table (100% overbodig)
-- ============================================================================
-- Check eerst hoeveel data erin zit:
SELECT COUNT(*) FROM public.wallet_sync_logs;

-- Verwijder table (inclusief indexes en policies):
DROP TABLE IF EXISTS public.wallet_sync_logs CASCADE;

-- 3.2. Verwijder user_savings table (100% overbodig)
-- ============================================================================
-- Check eerst hoeveel data erin zit:
SELECT COUNT(*) FROM public.user_savings;
SELECT SUM(usd_saved) AS total_usd_saved FROM public.user_savings;

-- ⚠️  OPTIONEEL: Migreer data naar transaction_savings (als je wilt behouden)
-- Dit is alleen nodig als je historische data wilt behouden:
-- INSERT INTO public.transaction_savings (
--   user_id,
--   chain,
--   transaction_hash,
--   gas_price_used,
--   gas_cost_usd,
--   savings_usd,
--   executed_at,
--   was_scheduled
-- )
-- SELECT 
--   user_id,
--   chain,
--   COALESCE(tx_hash, 'MIGRATED_FROM_USER_SAVINGS'),
--   original_gas,
--   original_gas * 0.000000001 * 21000 * (SELECT AVG(price) FROM gas_history WHERE chain = user_savings.chain LIMIT 1),
--   usd_saved,
--   saved_at,
--   false
-- FROM public.user_savings
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.transaction_savings 
--   WHERE transaction_savings.user_id = user_savings.user_id
--     AND transaction_savings.transaction_hash = COALESCE(user_savings.tx_hash, 'MIGRATED_FROM_USER_SAVINGS')
-- );

-- Verwijder table (inclusief indexes en policies):
DROP TABLE IF EXISTS public.user_savings CASCADE;

-- 3.3. Verwijder oude functie die user_savings gebruikt (niet meer nodig)
-- ============================================================================
DROP FUNCTION IF EXISTS get_user_total_savings(TEXT);
*/

-- ============================================================================
-- STAP 4: VERIFICATIE NA CLEANUP
-- ============================================================================
-- Run dit na cleanup om te verifiëren dat alles goed is gegaan

/*
-- Check of tables verwijderd zijn:
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('wallet_sync_logs', 'user_savings');

-- Moet leeg zijn (0 rows) als cleanup succesvol was

-- Check of andere tables nog intact zijn:
SELECT tablename, 
       (SELECT COUNT(*) FROM information_schema.tables t2 
        WHERE t2.table_schema = 'public' 
          AND t2.table_name = t1.tablename) AS exists
FROM pg_tables t1
WHERE schemaname = 'public'
  AND tablename IN (
    'wallets',
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
*/

-- ============================================================================
-- SAMENVATTING
-- ============================================================================
-- 
-- ✅ VERIFICATIE COMPLEET:
--    - Run STAP 1 om alle data te zien
--    - Check row counts en stale data
--
-- 🧹 CLEANUP STALE DATA:
--    - Uncomment STAP 2 queries om stale data op te ruimen
--    - Dit verwijdert alleen oude data, geen tables
--
-- 🗑️  VERWIJDER OVERBODIGE TABLES:
--    - Uncomment STAP 3 queries om overbodige tables te verwijderen
--    - ⚠️  BACKUP EERST JE DATABASE!
--    - ⚠️  Dit kan niet ongedaan gemaakt worden!
--
-- ✅ VERIFICATIE NA CLEANUP:
--    - Run STAP 4 om te verifiëren dat alles goed is
--
-- ============================================================================

