-- ============================================================================
-- FIX: Wallets Table RLS Policy
-- ============================================================================
-- Problem: Wallets table is blocking authenticated users from reading their own wallet
-- Error: GET /rest/v1/wallets?select=encrypted_mnemonic&user_id=eq.xxx 400 (Bad Request)
-- 
-- Solution: Add RLS policy to allow authenticated users to read their own wallet
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Service role can manage wallets" ON public.wallets;

-- Ensure RLS is enabled
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- ✅ Allow authenticated users to read their own wallet
CREATE POLICY "Users can read their own wallet"
  ON public.wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ✅ Allow authenticated users to update their own wallet
CREATE POLICY "Users can update their own wallet"
  ON public.wallets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ✅ Allow authenticated users to insert their own wallet (for new accounts)
CREATE POLICY "Users can insert their own wallet"
  ON public.wallets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ✅ Service role can manage all wallets (for admin operations)
CREATE POLICY "Service role can manage wallets"
  ON public.wallets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add helpful comment
COMMENT ON TABLE public.wallets IS 'Stores encrypted wallet mnemonics. RLS ensures users can only access their own wallet.';

