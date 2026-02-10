-- 🔥 BLAZE WALLET - Get Active Scheduled Transactions
-- Run this in Supabase SQL Editor to see all active scheduled transactions

SELECT 
  id,
  user_id,
  supabase_user_id,
  chain,
  from_address,
  to_address,
  amount,
  token_symbol,
  status,
  priority,
  scheduled_for,
  expires_at,
  optimal_gas_threshold,
  estimated_gas_cost_usd,
  created_at,
  updated_at,
  executed_at,
  retry_count,
  error_message
FROM scheduled_transactions
WHERE status IN ('pending', 'executing', 'ready')
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY 
  priority DESC,
  scheduled_for ASC,
  created_at ASC;

-- Count summary
SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN scheduled_for <= NOW() THEN 1 END) as ready_to_execute,
  COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired
FROM scheduled_transactions
WHERE status IN ('pending', 'executing', 'ready')
GROUP BY status;


