-- ============================================================================
-- FIX: Address Book Overly Permissive RLS Policy
-- ============================================================================
-- Problem: Current policy has "OR true" which allows ANYONE to read ALL contacts
-- Severity: HIGH - Data leak vulnerability
-- 
-- Current policy allows: SELECT BY anyone (anon + authenticated)
-- Should allow: SELECT BY authenticated users for their own contacts only
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.address_book;

-- ✅ Create proper, secure RLS policies

-- SELECT: Users can only view their own contacts
CREATE POLICY "Users can view their own contacts"
  ON public.address_book
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

-- INSERT: Users can only insert contacts for themselves
CREATE POLICY "Users can insert their own contacts"
  ON public.address_book
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

-- UPDATE: Users can only update their own contacts
CREATE POLICY "Users can update their own contacts"
  ON public.address_book
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- DELETE: Users can only delete their own contacts
CREATE POLICY "Users can delete their own contacts"
  ON public.address_book
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.address_book ENABLE ROW LEVEL SECURITY;

-- Add helpful comment
COMMENT ON TABLE public.address_book IS 'User contact address book. RLS ensures users can only access their own contacts. NO anon access, NO "OR true" bypass.';

