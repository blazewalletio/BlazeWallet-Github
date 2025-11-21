-- 🔥 CHECK FOR AUTH HOOKS
-- Supabase can have custom hooks that break sign-in

-- Check auth hooks
SELECT 
  id,
  hook_table_id,
  hook_name,
  created_at
FROM supabase_functions.hooks
WHERE hook_table_id IN (
  SELECT id FROM supabase_functions.tables 
  WHERE name = 'auth.users'
);

-- If that doesn't work, try this alternative:
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'auth'
  AND tablename = 'users';

