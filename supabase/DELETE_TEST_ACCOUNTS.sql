-- =====================================================
-- 🗑️ DELETE TEST ACCOUNTS
-- =====================================================
-- Safely delete test accounts that were created with old code
-- Accounts to delete:
-- - info@pakketadvies.nl
-- - info@warmeleads.eu
-- - info@thuisbatterijleads.nl
-- =====================================================

DO $$
DECLARE
  test_email TEXT;
  test_user_id UUID;
  deleted_count INTEGER := 0;
  test_emails TEXT[] := ARRAY[
    'info@pakketadvies.nl',
    'info@warmeleads.eu',
    'info@thuisbatterijleads.nl'
  ];
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '🗑️  DELETING TEST ACCOUNTS';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- Loop through each test email
  FOREACH test_email IN ARRAY test_emails
  LOOP
    -- Find user ID
    SELECT id INTO test_user_id
    FROM auth.users
    WHERE email = test_email;

    IF test_user_id IS NOT NULL THEN
      RAISE NOTICE '🔍 Found user: % (ID: %)', test_email, test_user_id;
      
      -- Delete from public tables first (CASCADE will handle this, but being explicit)
      DELETE FROM public.wallets WHERE user_id = test_user_id;
      DELETE FROM public.user_profiles WHERE user_id = test_user_id;
      DELETE FROM public.user_activity_log WHERE user_id = test_user_id;
      DELETE FROM public.trusted_devices WHERE user_id = test_user_id;
      DELETE FROM public.user_security_scores WHERE user_id = test_user_id;
      DELETE FROM public.user_transaction_stats WHERE user_id = test_user_id;
      DELETE FROM public.transaction_notes WHERE user_id = test_user_id;
      DELETE FROM public.email_verification_tokens WHERE user_id = test_user_id;
      
      -- Delete from auth.users (this triggers CASCADE delete for any remaining references)
      DELETE FROM auth.users WHERE id = test_user_id;
      
      deleted_count := deleted_count + 1;
      RAISE NOTICE '✅ Deleted: %', test_email;
      RAISE NOTICE '';
    ELSE
      RAISE NOTICE '⚠️  Not found: %', test_email;
      RAISE NOTICE '';
    END IF;
  END LOOP;

  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ DELETION COMPLETE!';
  RAISE NOTICE '📊 Total accounts deleted: %', deleted_count;
  RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;

-- =====================================================
-- VERIFY DELETION
-- =====================================================

-- Show remaining users (should not include deleted test accounts)
DO $$
DECLARE
  remaining_count INTEGER;
  user_record RECORD;  -- ✅ Declare the record variable
BEGIN
  SELECT COUNT(*) INTO remaining_count FROM auth.users;
  RAISE NOTICE '';
  RAISE NOTICE '👥 Remaining users in database: %', remaining_count;
  RAISE NOTICE '';
  
  -- List remaining users (for verification)
  RAISE NOTICE '📋 Remaining user emails:';
  FOR user_record IN 
    SELECT email, created_at 
    FROM auth.users 
    ORDER BY created_at DESC
  LOOP
    RAISE NOTICE '   - % (created: %)', user_record.email, user_record.created_at;
  END LOOP;
END $$;

