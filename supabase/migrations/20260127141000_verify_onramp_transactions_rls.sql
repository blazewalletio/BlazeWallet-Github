-- ============================================================================
-- VERIFY/CREATE: Onramp Transactions RLS Policies
-- ============================================================================
-- Ensure users can only read their own onramp transaction history
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own transactions" ON public.onramp_transactions;
DROP POLICY IF EXISTS "Service role can manage transactions" ON public.onramp_transactions;

-- ✅ Users can only read their own transactions
CREATE POLICY "Users can read their own transactions"
  ON public.onramp_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ✅ Service role (webhooks) can insert/update transactions
CREATE POLICY "Service role can manage transactions"
  ON public.onramp_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE public.onramp_transactions ENABLE ROW LEVEL SECURITY;

-- Add helpful comment
COMMENT ON TABLE public.onramp_transactions IS 'Onramp purchase transactions. Users can only read their own. Webhooks use service role to insert/update.';

