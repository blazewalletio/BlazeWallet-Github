-- 🔥 BLAZE WALLET - Delete All Scheduled Transactions
-- ⚠️ WARNING: This will delete ALL scheduled transactions
-- Run this in Supabase SQL Editor

-- First, check what will be deleted
SELECT 
  id,
  user_id,
  chain,
  amount,
  token_symbol,
  status,
  created_at
FROM scheduled_transactions
WHERE status IN ('pending', 'executing', 'ready');

-- Then delete them (uncomment to execute)
-- UPDATE scheduled_transactions
-- SET status = 'cancelled',
--     updated_at = NOW()
-- WHERE status IN ('pending', 'executing', 'ready');

-- Or permanently delete (more aggressive)
-- DELETE FROM scheduled_transactions
-- WHERE status IN ('pending', 'executing', 'ready');

