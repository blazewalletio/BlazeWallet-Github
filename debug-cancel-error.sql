-- ============================================================================
-- 🔍 DEBUG: Cancel Scheduled Transaction Issue
-- ============================================================================
-- Run these queries in Supabase SQL Editor to debug the 500 error
-- ============================================================================

-- 1️⃣ Check if transaction exists and is cancellable
SELECT 
  id,
  user_id,
  supabase_user_id,
  status,
  chain,
  amount,
  token_symbol,
  scheduled_for,
  created_at,
  CASE 
    WHEN status IN ('pending', 'ready') THEN '✅ Can cancel'
    ELSE '❌ Cannot cancel (status: ' || status || ')'
  END as cancellable
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl' -- Your email
ORDER BY created_at DESC
LIMIT 5;

-- 2️⃣ Test the UPDATE query that cancel API uses
-- This will show you if RLS is blocking the update
UPDATE scheduled_transactions
SET 
  status = 'cancelled',
  updated_at = NOW()
WHERE id = 'YOUR_TRANSACTION_ID' -- ✅ REPLACE with actual transaction ID from query 1
  AND user_id = 'ricks_@live.nl'
  AND status IN ('pending', 'ready')
RETURNING *;

-- 3️⃣ Check RLS policies on scheduled_transactions table
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

-- 4️⃣ Check if SUPABASE_SERVICE_ROLE_KEY has correct permissions
-- Run this to test if service role can update:
SET ROLE service_role;
UPDATE scheduled_transactions
SET updated_at = NOW()
WHERE id = 'YOUR_TRANSACTION_ID' -- ✅ REPLACE with actual transaction ID
RETURNING id, status;
RESET ROLE;

-- 5️⃣ Check notifications table RLS (if notification insert fails)
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
WHERE tablename = 'notifications';

-- ============================================================================
-- 📊 LIKELY ISSUES & FIXES
-- ============================================================================

-- ISSUE 1: RLS Policy blocks service role
-- FIX: Disable RLS for service role on scheduled_transactions
ALTER TABLE scheduled_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can do everything" ON scheduled_transactions;
CREATE POLICY "Service role can do everything"
ON scheduled_transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ISSUE 2: No UPDATE policy for anon/authenticated users
-- FIX: Add policy for users to update their own transactions
DROP POLICY IF EXISTS "Users can update own transactions" ON scheduled_transactions;
CREATE POLICY "Users can update own transactions"
ON scheduled_transactions
FOR UPDATE
TO authenticated, anon
USING (
  user_id = auth.jwt() ->> 'email' 
  OR user_id = current_setting('request.jwt.claims', true)::json ->> 'email'
)
WITH CHECK (
  user_id = auth.jwt() ->> 'email'
  OR user_id = current_setting('request.jwt.claims', true)::json ->> 'email'
);

-- ISSUE 3: Notifications table blocks inserts
-- FIX: Allow service role to insert notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
CREATE POLICY "Service role can insert notifications"
ON notifications
FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================================
-- 🚀 QUICK FIX: Temporarily disable RLS (NOT RECOMMENDED FOR PRODUCTION)
-- ============================================================================
-- ⚠️ ONLY USE THIS TO TEST IF RLS IS THE ISSUE
-- ⚠️ RE-ENABLE RLS AFTER TESTING!

-- Disable RLS temporarily
-- ALTER TABLE scheduled_transactions DISABLE ROW LEVEL SECURITY;

-- Test cancel, then re-enable:
-- ALTER TABLE scheduled_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 📝 HOW TO USE THIS SCRIPT
-- ============================================================================
-- 1. Run query 1 to see your transactions
-- 2. Copy a transaction ID from results
-- 3. Replace 'YOUR_TRANSACTION_ID' in queries 2 & 4
-- 4. Run queries 2-5 to debug
-- 5. If RLS is the issue, run the fixes under "LIKELY ISSUES & FIXES"
-- ============================================================================

