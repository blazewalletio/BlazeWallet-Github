-- ============================================================================
-- FIX: Address Book RLS - Support Email-Based User IDs
-- ============================================================================
-- Problem: RLS policy only checks auth.uid() but we use email as user_id
-- Solution: Check BOTH auth.uid() AND auth.email()
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.address_book;

-- ✅ CREATE IMPROVED POLICIES - Support both UUID and email

-- SELECT: Users can view contacts where user_id matches EITHER their UUID OR email
CREATE POLICY "Users can view their own contacts"
  ON public.address_book
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = user_id OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) = user_id
  );

-- INSERT: Users can insert contacts for themselves (UUID or email)
CREATE POLICY "Users can insert their own contacts"
  ON public.address_book
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = user_id OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) = user_id
  );

-- UPDATE: Users can update their own contacts
CREATE POLICY "Users can update their own contacts"
  ON public.address_book
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid()::text = user_id OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) = user_id
  )
  WITH CHECK (
    auth.uid()::text = user_id OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) = user_id
  );

-- DELETE: Users can delete their own contacts
CREATE POLICY "Users can delete their own contacts"
  ON public.address_book
  FOR DELETE
  TO authenticated
  USING (
    auth.uid()::text = user_id OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) = user_id
  );

-- Ensure RLS is enabled
ALTER TABLE public.address_book ENABLE ROW LEVEL SECURITY;

-- Update comment
COMMENT ON TABLE public.address_book IS 'User contact address book. RLS supports both UUID and email-based user_id for wallet-based auth compatibility.';

-- Success message
SELECT '✅ Address Book RLS updated to support email-based user_id!' as message;
