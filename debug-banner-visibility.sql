-- ============================================================================
-- 🔍 DEBUG: Check laatst aangemaakte transaction
-- ============================================================================

-- Check de LAATSTE transaction die is aangemaakt (laatste 5 minuten)
SELECT 
  id,
  user_id,
  supabase_user_id,
  status,
  chain,
  amount,
  token_symbol,
  from_address,
  to_address,
  scheduled_for AT TIME ZONE 'Europe/Amsterdam' as scheduled_for_local,
  created_at AT TIME ZONE 'Europe/Amsterdam' as created_at_local,
  CASE 
    WHEN encrypted_auth IS NOT NULL THEN 'Yes ✅'
    ELSE 'No ❌'
  END as has_encrypted_auth,
  -- Check waarom deze NIET wordt getoond in banner:
  CASE 
    WHEN user_id != 'ricks_@live.nl' THEN '❌ Wrong user_id: ' || user_id
    WHEN status != 'pending' THEN '❌ Wrong status: ' || status
    WHEN chain != 'solana' THEN '⚠️ Different chain: ' || chain
    WHEN scheduled_for < NOW() THEN '⚠️ Already scheduled time passed'
    ELSE '✅ Should be visible in banner!'
  END as visibility_check
FROM scheduled_transactions
WHERE created_at > NOW() - INTERVAL '5 minutes'  -- Laatste 5 minuten
ORDER BY created_at DESC
LIMIT 5;

-- Check RLS policy voor SELECT
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'scheduled_transactions'
  AND cmd = 'SELECT';

-- Test of je de transaction KAN zien met jouw user_id
SELECT COUNT(*) as pending_transactions_for_your_user
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl'
  AND status = 'pending'
  AND chain = 'solana';

