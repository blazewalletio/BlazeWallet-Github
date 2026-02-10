-- =====================================================
-- FIX MULTIPLE WALLET ADDRESSES FOR SAME USER
-- =====================================================
-- This script fixes the situation where a user has multiple
-- wallet addresses (possibly from failed duplicate signup attempts)
-- For email: ricks_@live.nl
-- =====================================================

-- Step 1: Find the user
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE LOWER(email) = LOWER('ricks_@live.nl')
ORDER BY created_at ASC;

-- Step 2: Check ALL wallets for this user
SELECT 
  id as wallet_id,
  user_id,
  wallet_address,
  created_at,
  updated_at
FROM wallets
WHERE user_id IN (
  SELECT id FROM auth.users WHERE LOWER(email) = LOWER('ricks_@live.nl')
)
ORDER BY created_at ASC;

-- Step 3: Check for multiple wallets per user_id
SELECT 
  user_id,
  COUNT(*) as wallet_count,
  STRING_AGG(id::text, ', ') as wallet_ids,
  STRING_AGG(wallet_address, ', ') as wallet_addresses,
  MIN(created_at) as oldest_wallet,
  MAX(created_at) as newest_wallet
FROM wallets
WHERE user_id IN (
  SELECT id FROM auth.users WHERE LOWER(email) = LOWER('ricks_@live.nl')
)
GROUP BY user_id
HAVING COUNT(*) > 1;

-- =====================================================
-- FIX: Keep oldest wallet, delete duplicates
-- =====================================================
DO $$
DECLARE
  v_user_id UUID;
  v_keep_wallet_id UUID;
  v_wallet_record RECORD;
  v_wallet_count INTEGER;
BEGIN
  -- Get user_id
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER('ricks_@live.nl')
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user found with email: ricks_@live.nl';
    RETURN;
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIXING WALLETS FOR USER: %', v_user_id;
  RAISE NOTICE '========================================';
  
  -- Count wallets for this user
  SELECT COUNT(*) INTO v_wallet_count
  FROM wallets
  WHERE user_id = v_user_id;
  
  RAISE NOTICE 'Found % wallet(s) for this user', v_wallet_count;
  
  IF v_wallet_count = 0 THEN
    RAISE NOTICE 'No wallets found - nothing to fix';
    RETURN;
  ELSIF v_wallet_count = 1 THEN
    RAISE NOTICE 'Only 1 wallet found - no fix needed';
    RETURN;
  END IF;
  
  -- Get oldest wallet (keep this one)
  SELECT id INTO v_keep_wallet_id
  FROM wallets
  WHERE user_id = v_user_id
  ORDER BY created_at ASC
  LIMIT 1;
  
  RAISE NOTICE 'Keeping wallet_id: % (oldest)', v_keep_wallet_id;
  
  -- Delete all other wallets for this user
  FOR v_wallet_record IN
    SELECT id, wallet_address, created_at
    FROM wallets
    WHERE user_id = v_user_id
    AND id != v_keep_wallet_id
    ORDER BY created_at ASC
  LOOP
    RAISE NOTICE 'Deleting duplicate wallet_id: % (Address: %, Created: %)', 
      v_wallet_record.id, 
      v_wallet_record.wallet_address,
      v_wallet_record.created_at;
    
    DELETE FROM wallets WHERE id = v_wallet_record.id;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CLEANUP COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Kept wallet_id: %', v_keep_wallet_id;
  RAISE NOTICE 'Deleted % duplicate wallet(s)', v_wallet_count - 1;
  
END $$;

-- =====================================================
-- VERIFICATION: Check if fix was successful
-- =====================================================
SELECT 
  u.id as user_id,
  u.email,
  COUNT(w.id) as wallet_count,
  STRING_AGG(w.wallet_address, ', ') as wallet_addresses
FROM auth.users u
LEFT JOIN wallets w ON w.user_id = u.id
WHERE LOWER(u.email) = LOWER('ricks_@live.nl')
GROUP BY u.id, u.email;

-- Should show: wallet_count = 1

