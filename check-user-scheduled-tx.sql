-- Check user's scheduled transactions
SELECT 
  id,
  status,
  chain,
  amount,
  token_symbol,
  to_address,
  scheduled_for AT TIME ZONE 'UTC' as scheduled_for_utc,
  scheduled_for AT TIME ZONE 'Europe/Amsterdam' as scheduled_for_local,
  NOW() AT TIME ZONE 'UTC' as current_time_utc,
  NOW() AT TIME ZONE 'Europe/Amsterdam' as current_time_local,
  expires_at AT TIME ZONE 'UTC' as expires_at_utc,
  expires_at AT TIME ZONE 'Europe/Amsterdam' as expires_at_local,
  optimal_gas_threshold,
  created_at,
  updated_at,
  executed_at,
  error_message,
  retry_count,
  CASE 
    WHEN scheduled_for > NOW() THEN 'FUTURE - Not ready yet'
    WHEN expires_at < NOW() THEN 'EXPIRED - Too late'
    WHEN optimal_gas_threshold IS NOT NULL THEN 'WAITING - For optimal gas'
    ELSE 'READY - Should execute now'
  END as execution_status
FROM scheduled_transactions
WHERE user_id LIKE '%Aof4nnSvqH%'
ORDER BY created_at DESC
LIMIT 5;
