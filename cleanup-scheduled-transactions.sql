-- ============================================================================
-- 🔍 CHECK & CLEANUP SCHEDULED TRANSACTIONS
-- ============================================================================
-- Use this script to investigate and fix scheduled transaction issues
-- ============================================================================

-- 1️⃣ CHECK: View all scheduled transactions for a user
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
  scheduled_for AT TIME ZONE 'UTC' as scheduled_for_utc,
  scheduled_for AT TIME ZONE 'Europe/Amsterdam' as scheduled_for_local,
  created_at AT TIME ZONE 'UTC' as created_at_utc,
  created_at AT TIME ZONE 'Europe/Amsterdam' as created_at_local,
  expires_at AT TIME ZONE 'UTC' as expires_at_utc,
  expires_at AT TIME ZONE 'Europe/Amsterdam' as expires_at_local,
  CASE 
    WHEN scheduled_for IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (scheduled_for - NOW())) / 3600
    ELSE NULL
  END as hours_until_execution,
  CASE
    WHEN encrypted_auth IS NOT NULL THEN 'Yes'
    ELSE 'No'
  END as has_encrypted_auth
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl' -- ✅ Replace with your email
ORDER BY created_at DESC;

-- 2️⃣ CHECK: Count transactions by status
SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN encrypted_auth IS NOT NULL THEN 1 END) as with_auth,
  COUNT(CASE WHEN encrypted_auth IS NULL THEN 1 END) as without_auth
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl' -- ✅ Replace with your email
GROUP BY status
ORDER BY count DESC;

-- 3️⃣ CHECK: Find expired transactions that weren't executed
SELECT 
  id,
  chain,
  amount,
  token_symbol,
  status,
  scheduled_for AT TIME ZONE 'Europe/Amsterdam' as scheduled_for,
  expires_at AT TIME ZONE 'Europe/Amsterdam' as expires_at,
  CASE 
    WHEN expires_at < NOW() THEN 'EXPIRED'
    WHEN scheduled_for < NOW() AND status = 'pending' THEN 'OVERDUE'
    ELSE 'OK'
  END as execution_status
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl' -- ✅ Replace with your email
  AND status IN ('pending', 'ready')
ORDER BY scheduled_for DESC;

-- 4️⃣ FIX: Mark expired transactions as 'expired' (oude transacties die niet uitgevoerd zijn)
UPDATE scheduled_transactions
SET 
  status = 'expired',
  updated_at = NOW()
WHERE user_id = 'ricks_@live.nl' -- ✅ Replace with your email
  AND status = 'pending'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();

-- Check result
SELECT 
  'Marked as expired:' as action,
  COUNT(*) as count
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl' -- ✅ Replace with your email
  AND status = 'expired'
  AND updated_at > NOW() - INTERVAL '1 minute';

-- 5️⃣ FIX: Cancel old pending transactions zonder expiry
UPDATE scheduled_transactions
SET 
  status = 'cancelled',
  updated_at = NOW()
WHERE user_id = 'ricks_@live.nl' -- ✅ Replace with your email
  AND status = 'pending'
  AND scheduled_for < NOW() - INTERVAL '24 hours'
  AND expires_at IS NULL;

-- Check result
SELECT 
  'Marked as cancelled:' as action,
  COUNT(*) as count
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl' -- ✅ Replace with your email
  AND status = 'cancelled'
  AND updated_at > NOW() - INTERVAL '1 minute';

-- 6️⃣ CHECK: View remaining active transactions
SELECT 
  id,
  chain,
  amount,
  token_symbol,
  status,
  scheduled_for AT TIME ZONE 'Europe/Amsterdam' as scheduled_for,
  CASE 
    WHEN scheduled_for IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (scheduled_for - NOW())) / 60
    ELSE NULL
  END as minutes_until_execution,
  CASE
    WHEN encrypted_auth IS NOT NULL THEN '✅ Has Auth'
    ELSE '❌ No Auth (will not auto-execute)'
  END as auth_status
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl' -- ✅ Replace with your email
  AND status IN ('pending', 'ready')
ORDER BY scheduled_for ASC;

-- 7️⃣ DEBUG: Check why transactions might not be executing
SELECT 
  id,
  chain,
  amount,
  status,
  scheduled_for AT TIME ZONE 'Europe/Amsterdam' as scheduled_for_local,
  NOW() AT TIME ZONE 'Europe/Amsterdam' as current_time_local,
  CASE
    WHEN scheduled_for > NOW() THEN '⏳ Not yet time'
    WHEN scheduled_for <= NOW() AND encrypted_auth IS NULL THEN '❌ No encrypted auth'
    WHEN scheduled_for <= NOW() AND encrypted_auth IS NOT NULL THEN '✅ Should execute soon'
    ELSE '❓ Unknown'
  END as execution_status,
  CASE
    WHEN encrypted_auth IS NOT NULL THEN 
      (encrypted_auth->>'expires_at')::timestamp AT TIME ZONE 'Europe/Amsterdam'
    ELSE NULL
  END as auth_expires_at
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl' -- ✅ Replace with your email
  AND status = 'pending'
ORDER BY scheduled_for ASC;

-- 8️⃣ CLEANUP: Delete all cancelled/expired/failed transactions (optional - only if you want to clean up)
-- ⚠️ UNCOMMENT ONLY IF YOU WANT TO PERMANENTLY DELETE THESE TRANSACTIONS
-- DELETE FROM scheduled_transactions
-- WHERE user_id = 'ricks_@live.nl' -- ✅ Replace with your email
--   AND status IN ('cancelled', 'expired', 'failed')
--   AND created_at < NOW() - INTERVAL '7 days';

-- ============================================================================
-- 📊 SUMMARY QUERY
-- ============================================================================
SELECT 
  '📊 SCHEDULED TRANSACTIONS SUMMARY' as info,
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
  COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
  COUNT(CASE WHEN encrypted_auth IS NOT NULL AND status IN ('pending', 'ready') THEN 1 END) as active_with_auth,
  COUNT(CASE WHEN encrypted_auth IS NULL AND status IN ('pending', 'ready') THEN 1 END) as active_without_auth
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl'; -- ✅ Replace with your email

-- ============================================================================
-- 💡 HOW TO USE THIS SCRIPT
-- ============================================================================
-- 1. Open Supabase SQL Editor
-- 2. Replace 'ricks_@live.nl' with your email address (or wallet address)
-- 3. Run queries 1-3 to inspect current state
-- 4. Run queries 4-5 to fix expired/old transactions
-- 5. Run query 6 to verify remaining active transactions
-- 6. Run query 7 to debug why transactions aren't executing
-- 7. (Optional) Run query 8 to cleanup old transactions
-- ============================================================================

