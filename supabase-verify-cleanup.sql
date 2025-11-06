-- VERIFICATIE NA CLEANUP
-- Run dit na cleanup om te checken of alles verwijderd is

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

-- Alles moet 0 zijn als cleanup succesvol was!

