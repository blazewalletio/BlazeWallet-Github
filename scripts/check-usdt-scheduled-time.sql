-- Check scheduled time for 1 USDT transaction
SELECT 
  id,
  user_id,
  chain,
  amount,
  token_symbol,
  status,
  scheduled_for,
  expires_at,
  created_at,
  -- Convert to UTC explicitly
  scheduled_for AT TIME ZONE 'UTC' as scheduled_for_utc,
  -- Show time until execution
  CASE 
    WHEN scheduled_for IS NULL THEN 'Immediate'
    WHEN scheduled_for <= NOW() THEN 'Ready now'
    ELSE scheduled_for::text
  END as execution_status
FROM scheduled_transactions
WHERE token_symbol = 'USDT'
  AND amount = '1'
  AND status IN ('pending', 'executing', 'ready')
ORDER BY created_at DESC
LIMIT 1;

