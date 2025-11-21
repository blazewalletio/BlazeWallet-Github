-- 🔥 QUERY 4: Check auth.identities constraints en triggers
-- Dit kan het echte probleem zijn!

-- Check triggers op auth.identities
SELECT 
  trigger_name,
  event_manipulation as trigger_event,
  action_timing as timing,
  action_statement as function_called
FROM information_schema.triggers
WHERE event_object_table = 'identities'
  AND event_object_schema = 'auth';

-- Check constraints op auth.identities  
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'identities'
  AND tc.table_schema = 'auth'
ORDER BY tc.constraint_type;

-- Check NOT NULL columns in auth.identities
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name = 'identities'
  AND is_nullable = 'NO'
ORDER BY ordinal_position;

