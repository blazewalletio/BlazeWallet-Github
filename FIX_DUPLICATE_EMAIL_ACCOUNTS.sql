-- =====================================================
-- FIX DUPLICATE EMAIL ACCOUNTS
-- =====================================================
-- This script finds and fixes duplicate accounts with the same email
-- For email: ricks_@live.nl
-- =====================================================

-- Step 1: Find all duplicate email accounts
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at,
  raw_user_meta_data
FROM auth.users
WHERE LOWER(email) = LOWER('ricks_@live.nl')
ORDER BY created_at ASC;

-- Step 2: Check which accounts have wallets
SELECT 
  u.id as user_id,
  u.email,
  u.created_at as user_created_at,
  w.id as wallet_id,
  w.wallet_address,
  w.created_at as wallet_created_at
FROM auth.users u
LEFT JOIN wallets w ON w.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
ORDER BY u.created_at ASC;

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

-- Step 5: Identify which account to keep (oldest) and which to delete (newest)
DO $$
DECLARE
  v_keep_user_id UUID;
  v_delete_user_id UUID;
  v_email TEXT := 'ricks_@live.nl';
BEGIN
  -- Get oldest account (keep this one)
  SELECT id INTO v_keep_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(v_email)
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Get newest account (delete this one)
  SELECT id INTO v_delete_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(v_email)
  AND id != v_keep_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_keep_user_id IS NULL OR v_delete_user_id IS NULL THEN
    RAISE NOTICE 'Could not find duplicate accounts for email: %', v_email;
    RETURN;
  END IF;
  
  RAISE NOTICE 'Keeping user_id: % (oldest account)', v_keep_user_id;
  RAISE NOTICE 'Deleting user_id: % (newest account)', v_delete_user_id;
  
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
  
END $$;

-- =====================================================
-- VERIFICATION: Check if fix was successful
-- =====================================================
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
WHERE LOWER(email) = LOWER('ricks_@live.nl')
ORDER BY created_at ASC;

