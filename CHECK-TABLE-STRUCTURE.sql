-- ============================================================================
-- CHECK TABLE STRUCTURE - What columns exist?
-- ============================================================================

-- 1. Show all columns in scheduled_transactions table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'scheduled_transactions'
ORDER BY ordinal_position;

-- 2. Show ALL transactions (any user, any status) with ONLY existing columns
SELECT *
FROM scheduled_transactions
ORDER BY created_at DESC
LIMIT 10;


