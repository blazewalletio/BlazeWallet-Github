-- =============================================================================
-- ONRAMP TRANSACTIONS TABLE
-- =============================================================================
-- Stores onramp transaction statuses from providers (BANXA, MoonPay, etc.)
-- Used to track purchase status and update UI in real-time

CREATE TABLE IF NOT EXISTS public.onramp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Transaction Identifiers
  onramp_transaction_id TEXT NOT NULL, -- Onramper transaction ID (unique per provider)
  provider TEXT NOT NULL, -- 'banxa', 'moonpay', 'transak', etc.
  
  -- Transaction Details
  fiat_amount DECIMAL(20, 2) NOT NULL,
  fiat_currency TEXT NOT NULL,
  crypto_amount DECIMAL(20, 8),
  crypto_currency TEXT NOT NULL,
  payment_method TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, cancelled, refunded
  status_updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Wallet Info
  wallet_address TEXT,
  
  -- Provider-specific data (stored as JSONB for flexibility)
  provider_data JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique transaction per provider
  CONSTRAINT onramp_transactions_unique UNIQUE (onramp_transaction_id, provider)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_onramp_transactions_user ON public.onramp_transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_onramp_transactions_status ON public.onramp_transactions(status, status_updated_at);
CREATE INDEX IF NOT EXISTS idx_onramp_transactions_provider ON public.onramp_transactions(provider, status);
CREATE INDEX IF NOT EXISTS idx_onramp_transactions_created ON public.onramp_transactions(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE public.onramp_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onramp transactions"
  ON public.onramp_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onramp transactions"
  ON public.onramp_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onramp transactions"
  ON public.onramp_transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_onramp_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_onramp_transactions_updated_at
  BEFORE UPDATE ON public.onramp_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_onramp_transactions_updated_at();

-- Comments
COMMENT ON TABLE public.onramp_transactions IS 'Stores onramp transaction statuses from providers (BANXA, MoonPay, etc.)';
COMMENT ON COLUMN public.onramp_transactions.onramp_transaction_id IS 'Provider-specific transaction ID';
COMMENT ON COLUMN public.onramp_transactions.provider IS 'Provider name: banxa, moonpay, transak, etc.';
COMMENT ON COLUMN public.onramp_transactions.status IS 'Transaction status: pending, processing, completed, failed, cancelled, refunded';
COMMENT ON COLUMN public.onramp_transactions.provider_data IS 'Provider-specific data stored as JSONB';

