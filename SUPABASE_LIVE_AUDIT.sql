-- ============================================================================
-- LIVE SUPABASE DATABASE AUDIT
-- ============================================================================
-- Run deze queries in Supabase SQL Editor om de HUIDIGE staat te checken
-- ============================================================================

-- ============================================================================
-- PART 1: CHECK USER_ID DATA FORMATS
-- ============================================================================

SELECT '=== PART 1: USER_ID DATA FORMATS ===' as section;

-- Check address_book: zijn user_ids UUIDs of emails?
SELECT 
  'address_book' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as uuid_format,
  COUNT(*) FILTER (WHERE user_id LIKE '%@%') as email_format,
  COUNT(*) FILTER (WHERE user_id NOT LIKE '%@%' AND user_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as other_format,
  ARRAY_AGG(DISTINCT LEFT(user_id, 20)) as sample_user_ids
FROM address_book
GROUP BY table_name;

-- Check wallets: zijn user_ids UUIDs of emails?
SELECT 
  'wallets' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE user_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as uuid_format,
  COUNT(*) FILTER (WHERE user_id::text LIKE '%@%') as email_format,
  ARRAY_AGG(DISTINCT LEFT(user_id::text, 20)) as sample_user_ids
FROM wallets
GROUP BY table_name;

-- Check trusted_devices: zijn user_ids UUIDs of emails?
SELECT 
  'trusted_devices' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE user_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as uuid_format,
  COUNT(*) FILTER (WHERE user_id::text LIKE '%@%') as email_format,
  ARRAY_AGG(DISTINCT LEFT(user_id::text, 20)) as sample_user_ids
FROM trusted_devices
GROUP BY table_name;

-- Check user_profiles: zijn user_ids UUIDs of emails?
SELECT 
  'user_profiles' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as uuid_format,
  COUNT(*) FILTER (WHERE user_id LIKE '%@%') as email_format,
  ARRAY_AGG(DISTINCT LEFT(user_id, 20)) as sample_user_ids
FROM user_profiles
GROUP BY table_name;

-- ============================================================================
-- PART 2: CHECK RLS POLICIES
-- ============================================================================

SELECT '=== PART 2: CURRENT RLS POLICIES ===' as section;

-- Get all RLS policies for our tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('address_book', 'wallets', 'trusted_devices', 'user_profiles')
ORDER BY tablename, policyname;

-- ============================================================================
-- PART 3: CHECK TABLE COLUMN TYPES
-- ============================================================================

SELECT '=== PART 3: USER_ID COLUMN TYPES ===' as section;

SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('address_book', 'wallets', 'trusted_devices', 'user_profiles')
  AND column_name = 'user_id'
ORDER BY table_name;

-- ============================================================================
-- PART 4: CHECK SPECIFIC USER DATA (voor ricks_@live.nl)
-- ============================================================================

SELECT '=== PART 4: RICK''S DATA CHECK ===' as section;

-- Check auth.users
SELECT 
  'auth.users' as source,
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE email = 'ricks_@live.nl';

-- Check address_book for Rick
SELECT 
  'address_book' as source,
  user_id,
  COUNT(*) as contact_count,
  ARRAY_AGG(name) as contact_names
FROM address_book
WHERE user_id = 'ricks_@live.nl' 
   OR user_id = (SELECT id::text FROM auth.users WHERE email = 'ricks_@live.nl')
GROUP BY user_id;

-- Check wallets for Rick
SELECT 
  'wallets' as source,
  user_id,
  created_at,
  updated_at
FROM wallets
WHERE user_id::text = 'ricks_@live.nl' 
   OR user_id = (SELECT id FROM auth.users WHERE email = 'ricks_@live.nl')
LIMIT 1;

-- Check trusted_devices for Rick
SELECT 
  'trusted_devices' as source,
  user_id,
  COUNT(*) as device_count
FROM trusted_devices
WHERE user_id::text = 'ricks_@live.nl' 
   OR user_id = (SELECT id FROM auth.users WHERE email = 'ricks_@live.nl')
GROUP BY user_id;

-- ============================================================================
-- PART 5: CHECK RLS ENABLED STATUS
-- ============================================================================

SELECT '=== PART 5: RLS ENABLED STATUS ===' as section;

SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('address_book', 'wallets', 'trusted_devices', 'user_profiles')
ORDER BY tablename;

-- ============================================================================
-- END OF AUDIT
-- ============================================================================

SELECT '=== AUDIT COMPLETE ===' as section;
SELECT 'Copy the results and share them for analysis' as next_step;
