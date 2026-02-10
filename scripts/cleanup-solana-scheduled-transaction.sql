-- 🔥 BLAZE WALLET - Cleanup Solana Scheduled Transaction
-- Run this in Supabase SQL Editor to remove the Solana scheduled transaction

-- STEP 1: Check what Solana scheduled transactions exist
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
  created_at
FROM scheduled_transactions
WHERE chain = 'solana'
  AND status IN ('pending', 'executing', 'ready')
ORDER BY created_at DESC;

-- STEP 2: Cancel all Solana scheduled transactions (recommended - keeps history)
UPDATE scheduled_transactions
SET 
  status = 'cancelled',
  updated_at = NOW()
WHERE chain = 'solana'
  AND status IN ('pending', 'executing', 'ready')
RETURNING id, user_id, amount, token_symbol, status;

-- STEP 3: Verify they're cancelled
SELECT 
  id,
  user_id,
  chain,
  amount,
  token_symbol,
  status,
  updated_at
FROM scheduled_transactions
WHERE chain = 'solana'
  AND status = 'cancelled'
ORDER BY updated_at DESC
LIMIT 5;


