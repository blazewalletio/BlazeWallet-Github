-- ============================================================================
-- 🧹 BLAZE WALLET - SUPABASE SAFE CLEANUP SCRIPT
-- ============================================================================
-- 
-- Dit script verwijdert alleen VEILIGE items:
-- 1. Expired email verification tokens (3 stuks)
-- 2. Overbodige tables: wallet_sync_logs en user_savings (beide 0 rows)
--
-- ⚠️  BELANGRIJK: 
-- - Dit script verwijdert alleen items die 100% zeker overbodig zijn
-- - Back-up je database eerst (optioneel, maar aanbevolen)
-- - Run dit alleen als je zeker bent!
--
-- Run dit in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ldehmephukevxumwdbwt/sql/new
-- ============================================================================

-- ============================================================================
-- STAP 1: VERIFICATIE (check eerst wat er verwijderd gaat worden)
-- ============================================================================

-- Check expired email tokens
SELECT 
  'EXPIRED_TOKENS' AS cleanup_type,
  COUNT(*) AS count_to_delete,
  'Expired email verification tokens' AS description
FROM public.email_verification_tokens
WHERE expires_at < NOW();

-- Check wallet_sync_logs
SELECT 
  'WALLET_SYNC_LOGS' AS cleanup_type,
  COUNT(*) AS count_to_delete,
  'wallet_sync_logs table (0 rows, niet gebruikt)' AS description
FROM public.wallet_sync_logs;

-- Check user_savings
SELECT 
  'USER_SAVINGS' AS cleanup_type,
  COUNT(*) AS count_to_delete,
  'user_savings table (0 rows, vervangen door transaction_savings)' AS description
FROM public.user_savings;

-- ============================================================================
-- STAP 2: CLEANUP (uncomment om uit te voeren)
-- ============================================================================
-- ⚠️  UNCOMMENT ALLEEN ALS JE ZEKER BENT!

/*
-- 2.1. Verwijder expired email verification tokens
DELETE FROM public.email_verification_tokens
WHERE expires_at < NOW();

-- 2.2. Verwijder wallet_sync_logs table (0 rows, niet gebruikt)
DROP TABLE IF EXISTS public.wallet_sync_logs CASCADE;

-- 2.3. Verwijder user_savings table (0 rows, vervangen door nieuwe tables)
DROP TABLE IF EXISTS public.user_savings CASCADE;

-- 2.4. Verwijder oude functie die user_savings gebruikt (niet meer nodig)
DROP FUNCTION IF EXISTS get_user_total_savings(TEXT);
*/

-- ============================================================================
-- STAP 3: VERIFICATIE NA CLEANUP (run na cleanup)
-- ============================================================================
-- Uncomment na cleanup om te verifiëren:

/*
-- Check of tokens verwijderd zijn
SELECT COUNT(*) AS remaining_expired_tokens
FROM public.email_verification_tokens
WHERE expires_at < NOW();
-- Moet 0 zijn

-- Check of tables verwijderd zijn
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('wallet_sync_logs', 'user_savings');
-- Moet leeg zijn (0 rows)

-- Check of functie verwijderd is
SELECT proname 
FROM pg_proc 
WHERE proname = 'get_user_total_savings';
-- Moet leeg zijn (0 rows)
*/

-- ============================================================================
-- ✅ CLEANUP COMPLEET!
-- ============================================================================
-- 
-- Na cleanup:
-- ✅ 3 expired email tokens verwijderd
-- ✅ wallet_sync_logs table verwijderd
-- ✅ user_savings table verwijderd
-- ✅ get_user_total_savings functie verwijderd
--
-- Database is nu schoner en bevat alleen actieve tables!
-- ============================================================================

