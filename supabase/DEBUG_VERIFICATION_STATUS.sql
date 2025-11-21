-- =====================================================
-- 🔍 DEBUG: Check email verification status
-- =====================================================

-- Check if table exists and has data
SELECT 
  'TABLE EXISTS' as check_type,
  COUNT(*) as total_records
FROM public.user_email_verification_status;

-- Show all verification statuses
SELECT 
  'ALL USERS VERIFICATION STATUS' as check_type,
  u.email,
  u.email_confirmed_at IS NOT NULL as auth_confirmed,
  COALESCE(v.is_verified, false) as custom_verified,
  v.verified_at,
  v.created_at
FROM auth.users u
LEFT JOIN public.user_email_verification_status v ON v.user_id = u.id
ORDER BY u.created_at DESC;

-- Check if functions exist
SELECT 
  'FUNCTIONS' as check_type,
  routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('mark_email_verified', 'track_new_user_email');

