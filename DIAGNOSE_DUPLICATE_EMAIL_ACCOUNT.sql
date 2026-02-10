-- =====================================================
-- DIAGNOSE DUPLICATE EMAIL ACCOUNT SITUATION
-- =====================================================
-- This script provides a comprehensive analysis of what happened
-- when a duplicate account was created with email: ricks_@live.nl
-- =====================================================

\echo '========================================'
\echo 'DIAGNOSTIC REPORT: DUPLICATE EMAIL ACCOUNT'
\echo 'Email: ricks_@live.nl'
\echo '========================================'
\echo ''

-- =====================================================
-- SECTION 1: AUTH.USERS ANALYSIS
-- =====================================================
\echo 'SECTION 1: AUTH.USERS ANALYSIS'
\echo '----------------------------------------'

-- 1.1: All users with this email (case-insensitive)
SELECT 
  id as user_id,
  email,
  created_at,
  updated_at,
  email_confirmed_at,
  last_sign_in_at,
  confirmed_at,
  raw_user_meta_data,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN 'VERIFIED'
    ELSE 'UNVERIFIED'
  END as verification_status,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_since_creation
FROM auth.users
WHERE LOWER(email) = LOWER('ricks_@live.nl')
ORDER BY created_at ASC;

\echo ''
\echo 'User Count:'
SELECT COUNT(*) as total_users_with_email
FROM auth.users
WHERE LOWER(email) = LOWER('ricks_@live.nl');

\echo ''
\echo '========================================'
\echo ''

-- =====================================================
-- SECTION 2: WALLETS ANALYSIS
-- =====================================================
\echo 'SECTION 2: WALLETS ANALYSIS'
\echo '----------------------------------------'

-- 2.1: All wallets for users with this email
SELECT 
  u.id as user_id,
  u.email,
  u.created_at as user_created_at,
  w.id as wallet_id,
  w.wallet_address,
  w.created_at as wallet_created_at,
  w.updated_at as wallet_updated_at,
  w.last_synced_at,
  CASE 
    WHEN w.wallet_address IS NULL THEN 'NO ADDRESS'
    ELSE 'HAS ADDRESS'
  END as address_status
FROM auth.users u
LEFT JOIN wallets w ON w.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
ORDER BY u.created_at ASC, w.created_at ASC;

\echo ''
\echo 'Wallet Count per User:'
SELECT 
  u.id as user_id,
  u.email,
  COUNT(w.id) as wallet_count,
  STRING_AGG(w.id::text, ', ') as wallet_ids,
  STRING_AGG(w.wallet_address, ', ') as wallet_addresses
FROM auth.users u
LEFT JOIN wallets w ON w.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
GROUP BY u.id, u.email
ORDER BY u.created_at ASC;

\echo ''
\echo '========================================'
\echo ''

-- =====================================================
-- SECTION 3: DUPLICATE WALLET ADDRESSES
-- =====================================================
\echo 'SECTION 3: DUPLICATE WALLET ADDRESSES'
\echo '----------------------------------------'

-- 3.1: Check for duplicate wallet addresses
SELECT 
  w.wallet_address,
  COUNT(*) as address_count,
  STRING_AGG(DISTINCT w.user_id::text, ', ') as user_ids,
  STRING_AGG(DISTINCT u.email, ', ') as emails,
  STRING_AGG(w.id::text, ', ') as wallet_ids,
  MIN(w.created_at) as first_created,
  MAX(w.created_at) as last_created
FROM wallets w
JOIN auth.users u ON u.id = w.user_id
WHERE w.wallet_address IN (
  SELECT wallet_address 
  FROM wallets 
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE LOWER(email) = LOWER('ricks_@live.nl')
  )
  AND wallet_address IS NOT NULL
)
GROUP BY w.wallet_address
HAVING COUNT(*) > 1
ORDER BY address_count DESC;

\echo ''
\echo 'All Wallet Addresses (including NULL):'
SELECT 
  w.wallet_address,
  w.user_id,
  u.email,
  w.id as wallet_id,
  w.created_at
FROM wallets w
JOIN auth.users u ON u.id = w.user_id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
ORDER BY w.wallet_address NULLS LAST, w.created_at ASC;

\echo ''
\echo '========================================'
\echo ''

-- =====================================================
-- SECTION 4: TRUSTED DEVICES ANALYSIS
-- =====================================================
\echo 'SECTION 4: TRUSTED DEVICES ANALYSIS'
\echo '----------------------------------------'

SELECT 
  u.id as user_id,
  u.email,
  COUNT(td.id) as device_count,
  STRING_AGG(td.device_name, ', ') as device_names,
  STRING_AGG(td.id::text, ', ') as device_ids,
  MAX(td.last_used_at) as last_device_used
FROM auth.users u
LEFT JOIN trusted_devices td ON td.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
GROUP BY u.id, u.email
ORDER BY u.created_at ASC;

\echo ''
\echo 'Detailed Device Information:'
SELECT 
  u.id as user_id,
  u.email,
  td.id as device_id,
  td.device_name,
  td.device_fingerprint,
  td.verified_at,
  td.last_used_at,
  td.is_current,
  td.created_at as device_created_at
FROM auth.users u
LEFT JOIN trusted_devices td ON td.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
ORDER BY u.created_at ASC, td.last_used_at DESC NULLS LAST;

\echo ''
\echo '========================================'
\echo ''

-- =====================================================
-- SECTION 5: USER PROFILES ANALYSIS
-- =====================================================
\echo 'SECTION 5: USER PROFILES ANALYSIS'
\echo '----------------------------------------'

SELECT 
  u.id as user_id,
  u.email,
  up.id as profile_id,
  up.display_name,
  up.avatar_url,
  up.created_at as profile_created_at,
  up.updated_at as profile_updated_at
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
ORDER BY u.created_at ASC;

\echo ''
\echo '========================================'
\echo ''

-- =====================================================
-- SECTION 6: SECURITY SCORES ANALYSIS
-- =====================================================
\echo 'SECTION 6: SECURITY SCORES ANALYSIS'
\echo '----------------------------------------'

SELECT 
  u.id as user_id,
  u.email,
  uss.score,
  uss.email_verified,
  uss.two_factor_enabled,
  uss.last_calculated_at,
  uss.created_at as score_created_at
FROM auth.users u
LEFT JOIN user_security_scores uss ON uss.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
ORDER BY u.created_at ASC;

\echo ''
\echo '========================================'
\echo ''

-- =====================================================
-- SECTION 7: EMAIL VERIFICATION STATUS
-- =====================================================
\echo 'SECTION 7: EMAIL VERIFICATION STATUS'
\echo '----------------------------------------'

SELECT 
  u.id as user_id,
  u.email,
  uevs.is_verified,
  uevs.verified_at,
  uevs.created_at as status_created_at
FROM auth.users u
LEFT JOIN user_email_verification_status uevs ON uevs.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
ORDER BY u.created_at ASC;

\echo ''
\echo 'Email Verification Tokens:'
SELECT 
  u.id as user_id,
  u.email,
  evt.token,
  evt.email as token_email,
  evt.expires_at,
  evt.used_at,
  CASE 
    WHEN evt.used_at IS NOT NULL THEN 'USED'
    WHEN evt.expires_at < NOW() THEN 'EXPIRED'
    ELSE 'ACTIVE'
  END as token_status
FROM auth.users u
LEFT JOIN email_verification_tokens evt ON evt.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
ORDER BY u.created_at ASC, evt.created_at DESC;

\echo ''
\echo '========================================'
\echo ''

-- =====================================================
-- SECTION 8: TRANSACTION STATS ANALYSIS
-- =====================================================
\echo 'SECTION 8: TRANSACTION STATS ANALYSIS'
\echo '----------------------------------------'

SELECT 
  u.id as user_id,
  u.email,
  uts.total_transactions,
  uts.total_sent,
  uts.total_received,
  uts.last_transaction_at,
  uts.created_at as stats_created_at
FROM auth.users u
LEFT JOIN user_transaction_stats uts ON uts.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
ORDER BY u.created_at ASC;

\echo ''
\echo '========================================'
\echo ''

-- =====================================================
-- SECTION 9: ACTIVITY LOG ANALYSIS
-- =====================================================
\echo 'SECTION 9: ACTIVITY LOG ANALYSIS'
\echo '----------------------------------------'

SELECT 
  u.id as user_id,
  u.email,
  COUNT(ual.id) as activity_count,
  MIN(ual.created_at) as first_activity,
  MAX(ual.created_at) as last_activity
FROM auth.users u
LEFT JOIN user_activity_log ual ON ual.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
GROUP BY u.id, u.email
ORDER BY u.created_at ASC;

\echo ''
\echo 'Recent Activity (Last 10 per user):'
SELECT 
  u.id as user_id,
  u.email,
  ual.activity_type,
  ual.description,
  ual.created_at
FROM auth.users u
LEFT JOIN user_activity_log ual ON ual.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
ORDER BY u.created_at ASC, ual.created_at DESC
LIMIT 20;

\echo ''
\echo '========================================'
\echo ''

-- =====================================================
-- SECTION 10: DATA INTEGRITY ISSUES
-- =====================================================
\echo 'SECTION 10: DATA INTEGRITY ISSUES'
\echo '----------------------------------------'

\echo 'Issue 1: Multiple wallets per user_id (should be max 1):'
SELECT 
  user_id,
  COUNT(*) as wallet_count,
  STRING_AGG(id::text, ', ') as wallet_ids,
  STRING_AGG(wallet_address, ', ') as wallet_addresses
FROM wallets
WHERE user_id IN (
  SELECT id FROM auth.users WHERE LOWER(email) = LOWER('ricks_@live.nl')
)
GROUP BY user_id
HAVING COUNT(*) > 1;

\echo ''
\echo 'Issue 2: Duplicate wallet addresses (UNIQUE constraint violation):'
SELECT 
  wallet_address,
  COUNT(*) as address_count,
  STRING_AGG(user_id::text, ', ') as user_ids,
  STRING_AGG(w.id::text, ', ') as wallet_ids
FROM wallets w
WHERE wallet_address IN (
  SELECT wallet_address 
  FROM wallets 
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE LOWER(email) = LOWER('ricks_@live.nl')
  )
  AND wallet_address IS NOT NULL
)
GROUP BY wallet_address
HAVING COUNT(*) > 1;

\echo ''
\echo 'Issue 3: Wallets without wallet_address (NULL addresses):'
SELECT 
  w.id as wallet_id,
  w.user_id,
  u.email,
  w.created_at
FROM wallets w
JOIN auth.users u ON u.id = w.user_id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
AND w.wallet_address IS NULL;

\echo ''
\echo 'Issue 4: Multiple user_profiles per user_id:'
SELECT 
  user_id,
  COUNT(*) as profile_count,
  STRING_AGG(id::text, ', ') as profile_ids
FROM user_profiles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE LOWER(email) = LOWER('ricks_@live.nl')
)
GROUP BY user_id
HAVING COUNT(*) > 1;

\echo ''
\echo 'Issue 5: Multiple security scores per user_id:'
SELECT 
  user_id,
  COUNT(*) as score_count,
  STRING_AGG(id::text, ', ') as score_ids
FROM user_security_scores
WHERE user_id IN (
  SELECT id FROM auth.users WHERE LOWER(email) = LOWER('ricks_@live.nl')
)
GROUP BY user_id
HAVING COUNT(*) > 1;

\echo ''
\echo '========================================'
\echo ''

-- =====================================================
-- SECTION 11: TIMELINE ANALYSIS
-- =====================================================
\echo 'SECTION 11: TIMELINE ANALYSIS'
\echo '----------------------------------------'

SELECT 
  'USER CREATED' as event_type,
  u.id::text as entity_id,
  u.email,
  u.created_at as event_time,
  NULL::text as related_entity
FROM auth.users u
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')

UNION ALL

SELECT 
  'WALLET CREATED' as event_type,
  w.id::text as entity_id,
  u.email,
  w.created_at as event_time,
  w.wallet_address as related_entity
FROM wallets w
JOIN auth.users u ON u.id = w.user_id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')

UNION ALL

SELECT 
  'DEVICE VERIFIED' as event_type,
  td.id::text as entity_id,
  u.email,
  td.verified_at as event_time,
  td.device_name as related_entity
FROM trusted_devices td
JOIN auth.users u ON u.id = td.user_id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
AND td.verified_at IS NOT NULL

UNION ALL

SELECT 
  'LAST SIGN IN' as event_type,
  u.id::text as entity_id,
  u.email,
  u.last_sign_in_at as event_time,
  NULL::text as related_entity
FROM auth.users u
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
AND u.last_sign_in_at IS NOT NULL

ORDER BY event_time ASC;

\echo ''
\echo '========================================'
\echo ''

-- =====================================================
-- SECTION 12: SUMMARY & RECOMMENDATIONS
-- =====================================================
\echo 'SECTION 12: SUMMARY & RECOMMENDATIONS'
\echo '----------------------------------------'

DO $$
DECLARE
  v_user_count INTEGER;
  v_wallet_count INTEGER;
  v_duplicate_address_count INTEGER;
  v_multiple_wallets_count INTEGER;
  v_oldest_user_id UUID;
  v_newest_user_id UUID;
BEGIN
  -- Count users
  SELECT COUNT(*) INTO v_user_count
  FROM auth.users
  WHERE LOWER(email) = LOWER('ricks_@live.nl');
  
  -- Count wallets
  SELECT COUNT(*) INTO v_wallet_count
  FROM wallets
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE LOWER(email) = LOWER('ricks_@live.nl')
  );
  
  -- Count duplicate addresses
  SELECT COUNT(*) INTO v_duplicate_address_count
  FROM (
    SELECT wallet_address
    FROM wallets
    WHERE wallet_address IS NOT NULL
    AND user_id IN (
      SELECT id FROM auth.users WHERE LOWER(email) = LOWER('ricks_@live.nl')
    )
    GROUP BY wallet_address
    HAVING COUNT(*) > 1
  ) duplicates;
  
  -- Count users with multiple wallets
  SELECT COUNT(*) INTO v_multiple_wallets_count
  FROM (
    SELECT user_id
    FROM wallets
    WHERE user_id IN (
      SELECT id FROM auth.users WHERE LOWER(email) = LOWER('ricks_@live.nl')
    )
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) multiple;
  
  -- Get oldest and newest user
  SELECT id INTO v_oldest_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER('ricks_@live.nl')
  ORDER BY created_at ASC
  LIMIT 1;
  
  SELECT id INTO v_newest_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER('ricks_@live.nl')
  ORDER BY created_at DESC
  LIMIT 1;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total users with email: %', v_user_count;
  RAISE NOTICE 'Total wallets: %', v_wallet_count;
  RAISE NOTICE 'Duplicate wallet addresses: %', v_duplicate_address_count;
  RAISE NOTICE 'Users with multiple wallets: %', v_multiple_wallets_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Oldest user_id: %', v_oldest_user_id;
  IF v_oldest_user_id != v_newest_user_id THEN
    RAISE NOTICE 'Newest user_id: %', v_newest_user_id;
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  DUPLICATE USERS DETECTED!';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '✅ Only one user found';
  END IF;
  
  IF v_multiple_wallets_count > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  DATA INTEGRITY ISSUE: Multiple wallets per user_id!';
  END IF;
  
  IF v_duplicate_address_count > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  DATA INTEGRITY ISSUE: Duplicate wallet addresses!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RECOMMENDATIONS';
  RAISE NOTICE '========================================';
  
  IF v_user_count > 1 THEN
    RAISE NOTICE '1. Keep oldest user_id: %', v_oldest_user_id;
    RAISE NOTICE '2. Delete newest user_id: %', v_newest_user_id;
    RAISE NOTICE '3. Merge/keep wallets from oldest user';
  END IF;
  
  IF v_multiple_wallets_count > 0 THEN
    RAISE NOTICE '4. Keep oldest wallet per user_id';
    RAISE NOTICE '5. Delete duplicate wallets';
  END IF;
  
  IF v_duplicate_address_count > 0 THEN
    RAISE NOTICE '6. Keep wallet from oldest user for each duplicate address';
    RAISE NOTICE '7. Delete duplicate wallet addresses';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Run FIX_DUPLICATE_EMAIL_ACCOUNTS.sql to fix all issues';
  RAISE NOTICE '========================================';
  
END $$;

\echo ''
\echo '========================================'
\echo 'DIAGNOSTIC REPORT COMPLETE'
\echo '========================================'

