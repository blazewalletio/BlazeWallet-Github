-- ============================================================================
-- CHECK EXACT TABLE STRUCTURES IN SUPABASE
-- Run this FIRST to see what columns actually exist
-- ============================================================================

-- 1. Get all columns in debug_logs table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'debug_logs'
ORDER BY ordinal_position;

-- 2. Get all columns in trusted_devices table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'trusted_devices'
ORDER BY ordinal_position;

-- 3. Get actual pg_policies columns (to fix the query)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'pg_catalog'
  AND table_name = 'pg_policies'
ORDER BY ordinal_position;

