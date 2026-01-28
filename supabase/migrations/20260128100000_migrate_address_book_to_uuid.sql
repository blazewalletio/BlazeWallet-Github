-- ============================================================================
-- MIGRATE ADDRESS_BOOK TO UUID-BASED USER_IDS
-- ============================================================================
-- Current state: address_book uses emails as user_id
-- Target state: address_book uses UUIDs (consistent with wallets table)
-- ============================================================================

-- Step 1: Create backup table
CREATE TABLE IF NOT EXISTS address_book_backup_20260128 AS 
SELECT * FROM address_book;

COMMENT ON TABLE address_book_backup_20260128 IS 'Backup before migrating user_id from email to UUID';

-- Step 2: Update email-based user_ids to UUID
UPDATE address_book
SET user_id = (
  SELECT id::text 
  FROM auth.users 
  WHERE email = address_book.user_id
)
WHERE user_id LIKE '%@%';

-- Step 3: Verify migration
DO $$
DECLARE
  email_count INTEGER;
  uuid_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE user_id LIKE '%@%'),
    COUNT(*) FILTER (WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
    COUNT(*)
  INTO email_count, uuid_count, total_count
  FROM address_book;
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  Total rows: %', total_count;
  RAISE NOTICE '  Email format: %', email_count;
  RAISE NOTICE '  UUID format: %', uuid_count;
  
  IF email_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % rows still have email format', email_count;
  END IF;
  
  IF uuid_count != total_count THEN
    RAISE WARNING 'Some rows have neither email nor UUID format';
  END IF;
END $$;

-- Step 4: Drop old policies
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.address_book;

-- Step 5: Create NEW UUID-based policies (consistent with wallets)
CREATE POLICY "Users can view their own contacts"
  ON public.address_book
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own contacts"
  ON public.address_book
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own contacts"
  ON public.address_book
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON public.address_book
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- Step 6: Service role policy (for admin operations)
CREATE POLICY "Service role can manage address_book"
  ON public.address_book
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE public.address_book ENABLE ROW LEVEL SECURITY;

-- Update comment
COMMENT ON TABLE public.address_book IS 'User contact address book. Now uses UUID-based user_id (consistent with wallets table). Migration completed 2026-01-28.';

-- Success message
SELECT 
  '✅ Address Book migrated to UUID-based user_id!' as message,
  COUNT(*) as total_contacts,
  COUNT(DISTINCT user_id) as unique_users
FROM address_book;

-- Rollback instructions (in case needed)
COMMENT ON TABLE address_book_backup_20260128 IS 
'ROLLBACK: UPDATE address_book SET user_id = backup.user_id FROM address_book_backup_20260128 backup WHERE address_book.id = backup.id;';
