-- =====================================================
-- FIX DUPLICATE EMAIL ACCOUNTS AND WALLETS
-- =====================================================
-- This script finds and fixes:
-- 1. Duplicate accounts with the same email
-- 2. Multiple wallets for the same user_id (data integrity issue)
-- 3. Duplicate wallet addresses across different users
-- For email: ricks_@live.nl
-- =====================================================

-- Step 1: Find all users with this email
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
WHERE LOWER(email) = LOWER('ricks_@live.nl')
ORDER BY created_at ASC;

-- Step 2: Check ALL wallets for this email (including duplicates)
SELECT 
  u.id as user_id,
  u.email,
  u.created_at as user_created_at,
  w.id as wallet_id,
  w.wallet_address,
  w.created_at as wallet_created_at,
  w.updated_at as wallet_updated_at
FROM auth.users u
LEFT JOIN wallets w ON w.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
ORDER BY u.created_at ASC, w.created_at ASC;

-- Step 2.5: Check for multiple wallets per user_id (data integrity issue)
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

-- Step 2.6: Check for duplicate wallet addresses (same address, different users)
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
)
GROUP BY wallet_address
HAVING COUNT(*) > 1;

-- Step 3: Check trusted devices for each account
SELECT 
  u.id as user_id,
  u.email,
  td.id as device_id,
  td.device_name,
  td.verified_at,
  td.last_used_at
FROM auth.users u
LEFT JOIN trusted_devices td ON td.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
ORDER BY u.created_at ASC, td.last_used_at DESC;

-- Step 4: Check user_profiles for each account
SELECT 
  u.id as user_id,
  u.email,
  up.id as profile_id,
  up.display_name,
  up.created_at as profile_created_at
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
ORDER BY u.created_at ASC;

-- =====================================================
-- DECISION: Keep the OLDEST account (first created)
-- Delete the NEWEST account (duplicate)
-- =====================================================

-- Step 5: Fix duplicate wallets and accounts
DO $$
DECLARE
  v_keep_user_id UUID;
  v_delete_user_id UUID;
  v_email TEXT := 'ricks_@live.nl';
  v_wallet_record RECORD;
  v_duplicate_wallet_id UUID;
  v_keep_wallet_id UUID;
BEGIN
  -- Get oldest account (keep this one)
  SELECT id INTO v_keep_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(v_email)
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF v_keep_user_id IS NULL THEN
    RAISE NOTICE 'No user found with email: %', v_email;
    RETURN;
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIXING DUPLICATES FOR EMAIL: %', v_email;
  RAISE NOTICE 'Keeping user_id: % (oldest account)', v_keep_user_id;
  RAISE NOTICE '========================================';
  
  -- =====================================================
  -- FIX 1: Multiple wallets for the same user_id
  -- =====================================================
  -- Keep the oldest wallet, delete the rest
  FOR v_wallet_record IN
    SELECT id, wallet_address, created_at
    FROM wallets
    WHERE user_id = v_keep_user_id
    ORDER BY created_at ASC
  LOOP
    IF v_keep_wallet_id IS NULL THEN
      -- First wallet = keep this one
      v_keep_wallet_id := v_wallet_record.id;
      RAISE NOTICE 'Keeping wallet_id: % (oldest wallet for user)', v_keep_wallet_id;
    ELSE
      -- Duplicate wallet = delete it
      RAISE NOTICE 'Deleting duplicate wallet_id: % (wallet_address: %)', v_wallet_record.id, v_wallet_record.wallet_address;
      DELETE FROM wallets WHERE id = v_wallet_record.id;
    END IF;
  END LOOP;
  
  -- =====================================================
  -- FIX 2: Duplicate wallet addresses (same address, different users)
  -- =====================================================
  -- For each duplicate wallet address, keep the one from the oldest user
  FOR v_wallet_record IN
    SELECT 
      w.id,
      w.user_id,
      w.wallet_address,
      u.created_at as user_created_at
    FROM wallets w
    JOIN auth.users u ON u.id = w.user_id
    WHERE w.wallet_address IN (
      SELECT wallet_address
      FROM wallets
      WHERE user_id IN (
        SELECT id FROM auth.users WHERE LOWER(email) = LOWER(v_email)
      )
      GROUP BY wallet_address
      HAVING COUNT(*) > 1
    )
    AND LOWER(u.email) = LOWER(v_email)
    ORDER BY w.wallet_address, u.created_at ASC
  LOOP
    -- Check if we already kept a wallet with this address
    SELECT id INTO v_keep_wallet_id
    FROM wallets
    WHERE wallet_address = v_wallet_record.wallet_address
    AND user_id = v_keep_user_id
    AND id != v_wallet_record.id
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF v_keep_wallet_id IS NOT NULL AND v_wallet_record.id != v_keep_wallet_id THEN
      -- This is a duplicate address, delete it
      RAISE NOTICE 'Deleting duplicate wallet_address: % (wallet_id: %, user_id: %)', 
        v_wallet_record.wallet_address, v_wallet_record.id, v_wallet_record.user_id;
      DELETE FROM wallets WHERE id = v_wallet_record.id;
    END IF;
  END LOOP;
  
  -- =====================================================
  -- FIX 3: Duplicate users (if they exist)
  -- =====================================================
  -- Get newest account (delete this one if it exists)
  SELECT id INTO v_delete_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(v_email)
  AND id != v_keep_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_delete_user_id IS NOT NULL THEN
    RAISE NOTICE 'Found duplicate user_id: % (newest account)', v_delete_user_id;
    
    -- Delete wallet from newest account (if exists)
    DELETE FROM wallets WHERE user_id = v_delete_user_id;
    RAISE NOTICE 'Deleted wallet for user_id: %', v_delete_user_id;
  
  -- Delete trusted devices from newest account
  DELETE FROM trusted_devices WHERE user_id = v_delete_user_id;
  RAISE NOTICE 'Deleted trusted devices for user_id: %', v_delete_user_id;
  
  -- Delete user profile from newest account
  DELETE FROM user_profiles WHERE user_id = v_delete_user_id;
  RAISE NOTICE 'Deleted user profile for user_id: %', v_delete_user_id;
  
  -- Delete user security score from newest account
  DELETE FROM user_security_scores WHERE user_id = v_delete_user_id;
  RAISE NOTICE 'Deleted security score for user_id: %', v_delete_user_id;
  
  -- Delete user transaction stats from newest account
  DELETE FROM user_transaction_stats WHERE user_id = v_delete_user_id;
  RAISE NOTICE 'Deleted transaction stats for user_id: %', v_delete_user_id;
  
  -- Delete email verification tokens from newest account
  DELETE FROM email_verification_tokens WHERE user_id = v_delete_user_id;
  RAISE NOTICE 'Deleted email verification tokens for user_id: %', v_delete_user_id;
  
  -- Delete user email verification status from newest account
  DELETE FROM user_email_verification_status WHERE user_id = v_delete_user_id;
  RAISE NOTICE 'Deleted email verification status for user_id: %', v_delete_user_id;
  
  -- Delete user activity log from newest account
  DELETE FROM user_activity_log WHERE user_id = v_delete_user_id;
  RAISE NOTICE 'Deleted activity log for user_id: %', v_delete_user_id;
  
    -- Delete trusted devices from newest account
    DELETE FROM trusted_devices WHERE user_id = v_delete_user_id;
    RAISE NOTICE 'Deleted trusted devices for user_id: %', v_delete_user_id;
    
    -- Delete user profile from newest account
    DELETE FROM user_profiles WHERE user_id = v_delete_user_id;
    RAISE NOTICE 'Deleted user profile for user_id: %', v_delete_user_id;
    
    -- Delete user security score from newest account
    DELETE FROM user_security_scores WHERE user_id = v_delete_user_id;
    RAISE NOTICE 'Deleted security score for user_id: %', v_delete_user_id;
    
    -- Delete user transaction stats from newest account
    DELETE FROM user_transaction_stats WHERE user_id = v_delete_user_id;
    RAISE NOTICE 'Deleted transaction stats for user_id: %', v_delete_user_id;
    
    -- Delete email verification tokens from newest account
    DELETE FROM email_verification_tokens WHERE user_id = v_delete_user_id;
    RAISE NOTICE 'Deleted email verification tokens for user_id: %', v_delete_user_id;
    
    -- Delete user email verification status from newest account
    DELETE FROM user_email_verification_status WHERE user_id = v_delete_user_id;
    RAISE NOTICE 'Deleted email verification status for user_id: %', v_delete_user_id;
    
    -- Delete user activity log from newest account
    DELETE FROM user_activity_log WHERE user_id = v_delete_user_id;
    RAISE NOTICE 'Deleted activity log for user_id: %', v_delete_user_id;
    
    -- Finally, delete the user from auth.users (this will cascade delete related records)
    -- NOTE: This must be done via Supabase Admin API or Dashboard, not directly via SQL
    -- For now, we'll just mark it for manual deletion
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MANUAL STEP REQUIRED:';
    RAISE NOTICE 'Delete user from Supabase Dashboard:';
    RAISE NOTICE 'User ID to delete: %', v_delete_user_id;
    RAISE NOTICE 'Email: %', v_email;
    RAISE NOTICE 'Go to: Supabase Dashboard → Authentication → Users';
    RAISE NOTICE 'Search for user_id: %', v_delete_user_id;
    RAISE NOTICE 'Click Delete User';
    RAISE NOTICE '========================================';
  ELSE
    RAISE NOTICE 'No duplicate users found - only one user with email: %', v_email;
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CLEANUP COMPLETE!';
  RAISE NOTICE '========================================';
  
END $$;

-- =====================================================
-- VERIFICATION: Check if fix was successful
-- =====================================================

-- Verify: Should only be 1 user now
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
WHERE LOWER(email) = LOWER('ricks_@live.nl')
ORDER BY created_at ASC;

-- Verify: Should only be 1 wallet per user now
SELECT 
  u.id as user_id,
  u.email,
  COUNT(w.id) as wallet_count,
  STRING_AGG(w.wallet_address, ', ') as wallet_addresses
FROM auth.users u
LEFT JOIN wallets w ON w.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
GROUP BY u.id, u.email;

-- Verify: No duplicate wallet addresses
SELECT 
  wallet_address,
  COUNT(*) as address_count,
  STRING_AGG(user_id::text, ', ') as user_ids
FROM wallets
WHERE user_id IN (
  SELECT id FROM auth.users WHERE LOWER(email) = LOWER('ricks_@live.nl')
)
GROUP BY wallet_address
HAVING COUNT(*) > 1;

