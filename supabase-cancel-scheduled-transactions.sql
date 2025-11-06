-- ============================================================================
-- 🚫 BLAZE WALLET - CANCEL/REMOVE SCHEDULED TRANSACTIONS
-- ============================================================================
-- 
-- Dit script laat je scheduled transactions zien en annuleren/verwijderen.
-- 
-- ⚠️  BELANGRIJK: 
-- - 'cancelled' = Status wordt op cancelled gezet (data blijft, maar wordt niet uitgevoerd)
-- - 'DELETE' = Data wordt volledig verwijderd (kan niet ongedaan gemaakt worden)
-- - Run eerst STAP 1 om te zien wat er is!
--
-- Run dit in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ldehmephukevxumwdbwt/sql/new
-- ============================================================================

-- ============================================================================
-- STAP 1: OVERZICHT (run eerst dit om te zien wat er is)
-- ============================================================================

-- 1.1. Alle scheduled transactions met details
SELECT 
  id,
  user_id,
  chain,
  status,
  amount,
  token_symbol,
  to_address,
  scheduled_for,
  expires_at,
  created_at,
  estimated_savings_usd,
  priority
FROM scheduled_transactions
ORDER BY created_at DESC;

-- 1.2. Aantal per status
SELECT 
  status,
  COUNT(*) AS count,
  STRING_AGG(id::text, ', ') AS transaction_ids
FROM scheduled_transactions
GROUP BY status
ORDER BY count DESC;

-- 1.3. Alleen ACTIEVE transactions (die nog uitgevoerd kunnen worden)
SELECT 
  id,
  user_id,
  chain,
  status,
  amount,
  token_symbol,
  scheduled_for,
  expires_at,
  created_at
FROM scheduled_transactions
WHERE status IN ('pending', 'ready', 'executing')
ORDER BY created_at DESC;

-- ============================================================================
-- STAP 2: CANCEL ALLE ACTIEVE TRANSACTIONS (veilig - data blijft)
-- ============================================================================
-- ⚠️  Dit zet de status op 'cancelled' zodat ze niet meer uitgevoerd worden
-- ⚠️  De data blijft in de database (voor historie)

/*
-- 2.1. Cancel alle pending/ready/executing transactions
UPDATE scheduled_transactions
SET 
  status = 'cancelled',
  updated_at = NOW()
WHERE status IN ('pending', 'ready', 'executing');

-- 2.2. Verifieer dat ze gecancelled zijn
SELECT 
  status,
  COUNT(*) AS count
FROM scheduled_transactions
WHERE status = 'cancelled'
GROUP BY status;
*/

-- ============================================================================
-- STAP 3: VERWIJDER ALLE SCHEDULED TRANSACTIONS (drastisch)
-- ============================================================================
-- ⚠️  ⚠️  ⚠️  KRITIEK: Dit verwijdert ALLE scheduled transactions! ⚠️  ⚠️  ⚠️
-- ⚠️  Dit kan NIET ongedaan gemaakt worden!
-- ⚠️  Gebruik dit alleen als je zeker weet dat je alles wilt verwijderen!

/*
-- 3.1. Verwijder ALLE scheduled transactions
DELETE FROM scheduled_transactions;

-- 3.2. Verifieer dat alles verwijderd is
SELECT COUNT(*) AS remaining_transactions
FROM scheduled_transactions;
-- Moet 0 zijn
*/

-- ============================================================================
-- STAP 4: SELECTIEF CANCEL/VERWIJDER (op basis van criteria)
-- ============================================================================
-- ⚠️  Pas de WHERE clause aan naar jouw wensen!

/*
-- 4.1. Cancel alleen pending transactions ouder dan X dagen
UPDATE scheduled_transactions
SET 
  status = 'cancelled',
  updated_at = NOW()
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '7 days';

-- 4.2. Verwijder alleen completed/failed/cancelled ouder dan X dagen
DELETE FROM scheduled_transactions
WHERE status IN ('completed', 'failed', 'cancelled')
  AND updated_at < NOW() - INTERVAL '30 days';

-- 4.3. Cancel transactions voor een specifieke user
UPDATE scheduled_transactions
SET 
  status = 'cancelled',
  updated_at = NOW()
WHERE user_id = 'JE_USER_ID_HIER'
  AND status IN ('pending', 'ready', 'executing');

-- 4.4. Verwijder transactions voor een specifieke user
DELETE FROM scheduled_transactions
WHERE user_id = 'JE_USER_ID_HIER';
*/

-- ============================================================================
-- ✅ KLAAR!
-- ============================================================================
-- 
-- Aanbeveling:
-- 1. Run STAP 1 om te zien wat er is
-- 2. Gebruik STAP 2 om actieve transactions te cancellen (veilig)
-- 3. Gebruik STAP 4 voor selectieve cleanup
-- 4. Gebruik STAP 3 alleen als je ALLES wilt verwijderen
--
-- Na cancellen worden de transactions NIET meer uitgevoerd door de cron job!
-- ============================================================================

