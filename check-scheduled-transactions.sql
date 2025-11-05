-- ============================================================================
-- 🔍 CHECK SCHEDULED TRANSACTIONS
-- ============================================================================
-- Run this in Supabase SQL Editor to find your scheduled transactions
-- ============================================================================

-- 1. Show ALL scheduled transactions (recent first)
SELECT 
  id,
  user_id,
  chain,
  status,
  amount,
  token_symbol,
  to_address,
  scheduled_for,
  created_at,
  estimated_savings_usd
FROM scheduled_transactions
ORDER BY created_at DESC
LIMIT 10;

-- 2. Count transactions by status
SELECT 
  status,
  COUNT(*) as count
FROM scheduled_transactions
GROUP BY status
ORDER BY count DESC;

-- 3. Count transactions by chain
SELECT 
  chain,
  COUNT(*) as count
FROM scheduled_transactions
GROUP BY chain
ORDER BY count DESC;

-- 4. Show ONLY pending transactions
SELECT 
  id,
  user_id,
  chain,
  status,
  amount,
  token_symbol,
  scheduled_for,
  created_at
FROM scheduled_transactions
WHERE status = 'pending'
ORDER BY created_at DESC;

-- 5. Check if there are ANY transactions at all
SELECT COUNT(*) as total_transactions FROM scheduled_transactions;

-- 6. Check RLS policies (should show policies)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'scheduled_transactions';

-- 7. Find transactions for a specific user (replace with your address)
-- Example: WHERE user_id = 'Hz4Yqp126MUTT6Go7Q8x9B4mcPsiMLHpXTXn513yDcMX'
SELECT 
  *
FROM scheduled_transactions
WHERE user_id LIKE '%your_address_here%'
ORDER BY created_at DESC;

