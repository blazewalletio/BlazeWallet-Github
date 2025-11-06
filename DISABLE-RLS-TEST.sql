-- ============================================================================
-- 🔥 NUCLEAR OPTION - DISABLE RLS COMPLETELY FOR TESTING
-- ============================================================================
-- This will TEMPORARILY disable ALL RLS to test if that's the issue
-- ============================================================================

-- Step 1: Show current situation
DO $$
DECLARE
  tx_count INT;
BEGIN
  SELECT COUNT(*) INTO tx_count 
  FROM scheduled_transactions 
  WHERE user_id = 'ricks_@live.nl' AND status = 'pending';
  
  RAISE NOTICE '📊 Current pending transactions for ricks_@live.nl: %', tx_count;
END $$;

-- Step 2: COMPLETELY DISABLE RLS
ALTER TABLE scheduled_transactions DISABLE ROW LEVEL SECURITY;

-- Step 3: Verify it's disabled
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'scheduled_transactions') THEN
    RAISE NOTICE '✅ RLS is now DISABLED';
  ELSE
    RAISE NOTICE '⚠️ RLS is still ENABLED';
  END IF;
END $$;

-- Step 4: Test query
DO $$
DECLARE
  tx_count INT;
BEGIN
  SELECT COUNT(*) INTO tx_count 
  FROM scheduled_transactions 
  WHERE user_id = 'ricks_@live.nl' AND status = 'pending';
  
  RAISE NOTICE '🧪 Test query result: % transactions', tx_count;
END $$;

-- Step 5: Show sample data
SELECT 
  id,
  user_id,
  chain,
  status,
  scheduled_for
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl'
AND status = 'pending'
ORDER BY created_at DESC
LIMIT 5;

-- Done
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '⚠️ RLS IS NOW DISABLED FOR TESTING';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Now test in browser:';
  RAISE NOTICE '1. Hard refresh (Cmd+Shift+R)';
  RAISE NOTICE '2. Check if banner shows transactions';
  RAISE NOTICE '3. If it works, we know RLS was the issue';
  RAISE NOTICE '========================================';
END $$;


