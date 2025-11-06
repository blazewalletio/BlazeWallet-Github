-- FINAL CLEANUP - Verwijder overbodige tables en expired tokens
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

-- 5. Verifieer dat alles verwijderd is
SELECT 
  'email_verification_tokens (expired)' AS check_type,
  COUNT(*) AS remaining
FROM public.email_verification_tokens
WHERE expires_at < NOW()
UNION ALL
SELECT 
  'wallet_sync_logs table exists',
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_sync_logs') THEN 1 ELSE 0 END
UNION ALL
SELECT 
  'user_savings table exists',
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_savings') THEN 1 ELSE 0 END;

