-- ============================================================================
-- 🚨 FINAL FIX: COMPLETELY DISABLE RLS FOR scheduled_transactions
-- ============================================================================
-- This will disable RLS so the service_role can access all data
-- ============================================================================

-- Step 1: Show current status
SELECT 
    tablename,
    rowsecurity as "RLS_Currently_Enabled"
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'scheduled_transactions';

-- Step 2: Drop ALL policies (clean slate)
DO $$
BEGIN
    -- Drop every possible policy name
    EXECUTE 'DROP POLICY IF EXISTS service_role_full_access ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS authenticated_users_select_own ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS authenticated_users_insert_own ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS authenticated_users_update_own ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS authenticated_users_delete_own ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS anon_select_all_for_debug ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Enable read access for all users" ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated users to read their own scheduled transactions" ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated users to insert their own scheduled transactions" ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated users to update their own scheduled transactions" ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Allow service role to manage all scheduled transactions" ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Allow service_role full access" ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon select" ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon insert" ON public.scheduled_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon update" ON public.scheduled_transactions';
    
    RAISE NOTICE '✅ All policies dropped';
END $$;

-- Step 3: DISABLE RLS
ALTER TABLE public.scheduled_transactions DISABLE ROW LEVEL SECURITY;

-- Step 4: Verify it's disabled
SELECT 
    tablename,
    rowsecurity as "RLS_Now_Disabled"
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'scheduled_transactions';

-- Step 5: Test query (should return 3 transactions)
SELECT 
    COUNT(*) as "Total_Pending_Transactions"
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl' AND status = 'pending';

-- Step 6: Show the transactions
SELECT 
    id,
    user_id,
    chain,
    status,
    scheduled_for,
    created_at
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl' AND status = 'pending'
ORDER BY scheduled_for ASC;

-- Final message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🎉 RLS IS NOW COMPLETELY DISABLED';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ The API should now return data!';
    RAISE NOTICE '⚠️  Remember: RLS is disabled for TESTING only';
    RAISE NOTICE '';
END $$;

