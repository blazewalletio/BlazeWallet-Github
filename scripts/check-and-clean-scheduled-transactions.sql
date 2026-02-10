-- 🔥 BLAZE WALLET - Check and Clean Scheduled Transactions
-- Run this in Supabase SQL Editor

-- 1. Check all active scheduled transactions
SELECT 
  id,
  user_id,
  chain,
  amount,
  token_symbol,
  to_address,
  status,
  priority,
  scheduled_for,
  expires_at,
  created_at,
  retry_count,
  error_message
FROM scheduled_transactions
WHERE status IN ('pending', 'executing', 'ready')
ORDER BY created_at DESC;

-- 2. Check specifically for Solana transactions
SELECT 
  id,
  user_id,
  chain,
  amount,
  token_symbol,
  to_address,
  status,
  scheduled_for,
  created_at
FROM scheduled_transactions
WHERE chain = 'solana'
  AND status IN ('pending', 'executing', 'ready')
ORDER BY created_at DESC;

-- 3. Count summary
SELECT 
  chain,
  status,
  COUNT(*) as count
FROM scheduled_transactions
WHERE status IN ('pending', 'executing', 'ready')
GROUP BY chain, status
ORDER BY chain, status;


