-- 🔥 BLAZE WALLET - Check Failed Transaction Details
-- Run this in Supabase SQL Editor to see why the transaction failed

SELECT 
  id,
  user_id,
  chain,
  amount,
  token_symbol,
  to_address,
  status,
  scheduled_for,
  expires_at,
  retry_count,
  error_message,
  created_at,
  updated_at,
  executed_at
FROM scheduled_transactions
WHERE status = 'failed'
  AND updated_at >= NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
LIMIT 5;

-- Also check if there are any pending transactions that should have executed
SELECT 
  id,
  user_id,
  chain,
  amount,
  token_symbol,
  status,
  scheduled_for,
  expires_at,
  retry_count,
  error_message,
  CASE 
    WHEN scheduled_for IS NULL THEN 'Immediate'
    WHEN scheduled_for <= NOW() THEN 'Ready now'
    ELSE 'Scheduled for future'
  END as execution_status,
  NOW() as current_time_utc,
  scheduled_for as scheduled_time_utc
FROM scheduled_transactions
WHERE status IN ('pending', 'executing', 'failed')
ORDER BY updated_at DESC
LIMIT 10;


