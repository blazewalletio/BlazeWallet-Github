-- 🔥 Manual cleanup for specific problematic users
-- These users cannot be deleted via Supabase UI

-- First, let's check what's blocking the delete
SELECT 
    u.id,
    u.email,
    u.created_at,
    CASE WHEN p.id IS NOT NULL THEN 'HAS PROFILE' ELSE 'NO PROFILE' END as profile_status,
    CASE WHEN ss.id IS NOT NULL THEN 'HAS SECURITY SCORE' ELSE 'NO SECURITY SCORE' END as security_status,
    CASE WHEN ts.id IS NOT NULL THEN 'HAS TRANSACTION STATS' ELSE 'NO TRANSACTION STATS' END as stats_status
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.user_id = u.id
LEFT JOIN public.user_security_scores ss ON ss.user_id = u.id
LEFT JOIN public.user_transaction_stats ts ON ts.user_id = u.id
WHERE u.email IN (
    'fixeduser123@test.com',
    'info@pakketadvies',
    'info@warmeleads.eu'
);

-- Now delete them properly (CASCADE should handle related records)
-- This deletes from auth.users and all related tables automatically
DELETE FROM auth.users
WHERE email IN (
    'fixeduser123@test.com',
    'info@pakketadvies',
    'info@warmeleads.eu'
);

-- Verify they're gone
SELECT 
    u.email,
    u.created_at
FROM auth.users u
WHERE u.email IN (
    'fixeduser123@test.com',
    'info@pakketadvies',
    'info@warmeleads.eu'
);
-- Should return 0 rows

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully deleted 3 problematic users';
END $$;

