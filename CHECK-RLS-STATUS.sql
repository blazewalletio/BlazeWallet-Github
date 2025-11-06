-- ============================================================================
-- CHECK RLS STATUS FOR scheduled_transactions
-- ============================================================================
-- This will show if RLS is enabled or disabled
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== CHECKING RLS STATUS ===';
END $$;

-- Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'scheduled_transactions';

DO $$
BEGIN
    RAISE NOTICE '=== CHECKING ACTUAL DATA ===';
END $$;

-- Check if we can see the data
SELECT 
    id,
    user_id,
    chain,
    status,
    scheduled_for,
    created_at
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl' 
  AND status = 'pending'
ORDER BY scheduled_for ASC;

DO $$
BEGIN
    RAISE NOTICE '=== CHECK COMPLETE ===';
    RAISE NOTICE 'If RLS Enabled = TRUE, then RLS is still on (needs to be disabled).';
    RAISE NOTICE 'If RLS Enabled = FALSE, then RLS is off (correct).';
    RAISE NOTICE 'If you see 3 transactions above, the data exists.';
END $$;


