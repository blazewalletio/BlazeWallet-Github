-- CANCEL ALLE ACTIEVE SCHEDULED TRANSACTIONS
-- Dit zet de status op 'cancelled' zodat ze niet meer uitgevoerd worden
-- De data blijft in de database (voor historie)

-- Eerst checken hoeveel er zijn
SELECT 
  status,
  COUNT(*) AS count
FROM scheduled_transactions
WHERE status IN ('pending', 'ready', 'executing')
GROUP BY status;

-- Cancel alle actieve transactions
UPDATE scheduled_transactions
SET 
  status = 'cancelled',
  updated_at = NOW()
WHERE status IN ('pending', 'ready', 'executing');

-- Verifieer dat ze gecancelled zijn
SELECT 
  status,
  COUNT(*) AS count
FROM scheduled_transactions
GROUP BY status
ORDER BY count DESC;

