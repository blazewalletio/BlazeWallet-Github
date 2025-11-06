-- VIEW SCHEDULED TRANSACTIONS
-- Run dit eerst om te zien wat er is

-- 1. Alle scheduled transactions met details
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

-- 2. Aantal per status
SELECT 
  status,
  COUNT(*) AS count
FROM scheduled_transactions
GROUP BY status
ORDER BY count DESC;

-- 3. Alleen ACTIEVE transactions (die nog uitgevoerd kunnen worden)
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

