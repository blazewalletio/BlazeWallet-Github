-- =============================================================================
-- USER ONRAMP PREFERENCES TABLE
-- =============================================================================
-- Stores user preferences for onramp providers to enable KYC reuse
-- Tracks which providers user has verified with to avoid repeated KYC

CREATE TABLE IF NOT EXISTS public.user_onramp_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Provider preferences
  preferred_provider TEXT, -- 'banxa', 'moonpay', 'transak', etc.
  verified_providers TEXT[], -- Array of providers where user has done KYC
  last_used_provider TEXT,
  last_transaction_date TIMESTAMPTZ,
  
  -- Payment preferences
  preferred_payment_method TEXT, -- 'creditcard', 'ideal', etc.
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_user_onramp_preferences_user_id 
  ON public.user_onramp_preferences(user_id);

-- RLS (Row Level Security)
ALTER TABLE public.user_onramp_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON public.user_onramp_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_onramp_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_onramp_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_onramp_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_user_onramp_preferences_updated_at
  BEFORE UPDATE ON public.user_onramp_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_onramp_preferences_updated_at();

COMMENT ON TABLE public.user_onramp_preferences IS 'Stores user preferences for onramp providers to enable KYC reuse and faster checkout';
COMMENT ON COLUMN public.user_onramp_preferences.preferred_provider IS 'Provider that user prefers (has done KYC with)';
COMMENT ON COLUMN public.user_onramp_preferences.verified_providers IS 'Array of providers where user has completed KYC';
COMMENT ON COLUMN public.user_onramp_preferences.last_used_provider IS 'Last provider used for purchase';
COMMENT ON COLUMN public.user_onramp_preferences.last_transaction_date IS 'Date of last transaction';

