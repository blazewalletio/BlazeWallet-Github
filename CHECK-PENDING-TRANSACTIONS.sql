-- ============================================================================
-- CHECK PENDING TRANSACTIONS - DIRECT DATABASE QUERY
-- ============================================================================
-- Run this in Supabase SQL Editor to see what's in the database
-- ============================================================================

-- 1. Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'scheduled_transactions';

-- 2. Count all transactions
SELECT 
  status,
  COUNT(*) as count
FROM scheduled_transactions
GROUP BY status;

-- 3. Show all pending transactions for this user
SELECT 
  id,
  user_id,
  chain,
  status,
  amount,
  token_symbol,
  recipient_address,
  scheduled_for,
  created_at,
  updated_at
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl'
  AND status = 'pending'
ORDER BY created_at DESC;

-- 4. Show ALL transactions for this user (any status)
SELECT 
  id,
  user_id,
  chain,
  status,
  amount,
  token_symbol,
  recipient_address,
  scheduled_for,
  created_at,
  updated_at
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl'
ORDER BY created_at DESC;

-- 5. Check environment variables that might be causing issues
-- Show me the exact user_id format in the database
SELECT DISTINCT 
  user_id,
  LENGTH(user_id) as user_id_length,
  ASCII(SUBSTRING(user_id, 1, 1)) as first_char_ascii
FROM scheduled_transactions;

