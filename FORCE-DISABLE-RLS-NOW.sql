-- ============================================================================
-- 🚨 FORCE DISABLE RLS FOR scheduled_transactions - NOW!
-- ============================================================================
-- This will completely disable RLS to test if that's the issue
-- ============================================================================

-- Step 1: Check current RLS status
DO $$
DECLARE
    rls_status BOOLEAN;
BEGIN
    SELECT rowsecurity INTO rls_status
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'scheduled_transactions';
    
    RAISE NOTICE '📊 Current RLS status: %', rls_status;
END $$;

-- Step 2: Drop ALL existing policies (to start clean)
DROP POLICY IF EXISTS "service_role_full_access" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "authenticated_users_select_own" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "authenticated_users_insert_own" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "authenticated_users_update_own" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "authenticated_users_delete_own" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "anon_select_all_for_debug" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "Allow authenticated users to read their own scheduled transactions" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "Allow authenticated users to insert their own scheduled transactions" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "Allow authenticated users to update their own scheduled transactions" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "Allow service role to manage all scheduled transactions" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "Allow service_role full access" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "Allow anon select" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "Allow anon insert" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "Allow anon update" ON public.scheduled_transactions;

DO $$
BEGIN
    RAISE NOTICE '✅ All existing policies dropped';
END $$;

-- Step 3: DISABLE RLS completely
ALTER TABLE public.scheduled_transactions DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    RAISE NOTICE '🚨 RLS DISABLED for scheduled_transactions';
END $$;

-- Step 4: Verify RLS is disabled
DO $$
DECLARE
    rls_status BOOLEAN;
BEGIN
    SELECT rowsecurity INTO rls_status
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'scheduled_transactions';
    
    RAISE NOTICE '📊 New RLS status: %', rls_status;
    
    IF rls_status = FALSE THEN
        RAISE NOTICE '✅ SUCCESS - RLS is now DISABLED';
    ELSE
        RAISE NOTICE '❌ ERROR - RLS is still ENABLED';
    END IF;
END $$;

-- Step 5: Test query
DO $$
DECLARE
    tx_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tx_count
    FROM scheduled_transactions
    WHERE user_id = 'ricks_@live.nl' AND status = 'pending';
    
    RAISE NOTICE '📋 Found % pending transactions for ricks_@live.nl', tx_count;
END $$;

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

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🎉 RLS HAS BEEN COMPLETELY DISABLED';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: This is for testing only!';
    RAISE NOTICE '⚠️  You should re-enable RLS with proper policies later!';
    RAISE NOTICE '';
END $$;

