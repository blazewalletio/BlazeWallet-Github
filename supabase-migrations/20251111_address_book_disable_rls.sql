-- ============================================================================
-- 📇 ADDRESS BOOK - DISABLE RLS (Wallet-based auth doesn't use Supabase JWT)
-- ============================================================================
-- Blaze Wallet uses its own authentication system (wallet-based)
-- RLS policies that depend on Supabase auth.uid() will always fail
-- So we disable RLS and rely on client-side user_id filtering
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own contacts" ON address_book;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON address_book;
DROP POLICY IF EXISTS "Users can update their own contacts" ON address_book;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON address_book;

-- Disable RLS entirely
ALTER TABLE address_book DISABLE ROW LEVEL SECURITY;

-- Add a comment explaining why RLS is disabled
COMMENT ON TABLE address_book IS 'RLS disabled because Blaze Wallet uses wallet-based auth, not Supabase auth. User isolation is enforced client-side using user_id (email or wallet hash).';

SELECT 'Address Book RLS disabled successfully!' as message;

