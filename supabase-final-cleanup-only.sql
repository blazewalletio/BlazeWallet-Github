-- FINAL CLEANUP - Alleen cleanup queries (geen verificatie)
-- Run dit om de laatste cleanup te doen

-- 1. Verwijder expired email verification tokens (3 stuks)
DELETE FROM public.email_verification_tokens
WHERE expires_at < NOW();

-- 2. Verwijder wallet_sync_logs table (0 rows, niet gebruikt)
DROP TABLE IF EXISTS public.wallet_sync_logs CASCADE;

-- 3. Verwijder user_savings table (0 rows, vervangen door nieuwe tables)
DROP TABLE IF EXISTS public.user_savings CASCADE;

-- 4. Verwijder oude functie die user_savings gebruikt (niet meer nodig)
DROP FUNCTION IF EXISTS get_user_total_savings(TEXT);

