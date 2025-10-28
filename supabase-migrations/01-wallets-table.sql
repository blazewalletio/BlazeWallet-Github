-- =============================================================================
-- BLAZE WALLET - SUPABASE DATABASE SCHEMA
-- =============================================================================
-- This creates the database structure for secure encrypted wallet storage
-- with email/social authentication and multi-device sync
--
-- EXECUTE THIS IN SUPABASE SQL EDITOR:
-- 1. Go to: https://supabase.com/dashboard/project/ldehmephukevxumwdbwt/sql/new
-- 2. Paste this entire file
-- 3. Click "RUN"
-- =============================================================================

-- =============================================================================
-- 1. WALLETS TABLE
-- =============================================================================
-- Stores encrypted wallet data (mnemonic encrypted with user's password)
-- Each user (from auth.users) has ONE wallet

CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Encrypted wallet data (AES-256 encrypted mnemonic)
  encrypted_wallet TEXT NOT NULL,
  
  -- Wallet metadata
  wallet_address TEXT,
  wallet_name TEXT DEFAULT 'My Wallet',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  UNIQUE(user_id),
  UNIQUE(wallet_address)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_wallet_address ON public.wallets(wallet_address);

-- =============================================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- Critical: Users can ONLY access their own encrypted wallet
-- Even Supabase admins cannot decrypt (encryption key is client-side only)

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own wallet
CREATE POLICY "Users can view own wallet"
  ON public.wallets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only insert their own wallet
CREATE POLICY "Users can insert own wallet"
  ON public.wallets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own wallet
CREATE POLICY "Users can update own wallet"
  ON public.wallets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own wallet
CREATE POLICY "Users can delete own wallet"
  ON public.wallets
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- 3. UPDATED_AT TRIGGER
-- =============================================================================
-- Automatically update 'updated_at' timestamp on every update

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 4. WALLET SYNC LOGS (Optional - for debugging)
-- =============================================================================
-- Track wallet sync history for troubleshooting

CREATE TABLE IF NOT EXISTS public.wallet_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE,
  
  -- Sync details
  sync_type TEXT NOT NULL, -- 'upload', 'download', 'update'
  device_info TEXT, -- Browser, OS, etc.
  ip_address INET,
  
  -- Status
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  
  -- Timestamp
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_wallet_sync_logs_user_id ON public.wallet_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_sync_logs_wallet_id ON public.wallet_sync_logs(wallet_id);

-- RLS for sync logs
ALTER TABLE public.wallet_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs"
  ON public.wallet_sync_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- 5. HELPER FUNCTIONS
-- =============================================================================

-- Function to get user's wallet
CREATE OR REPLACE FUNCTION get_user_wallet(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  encrypted_wallet TEXT,
  wallet_address TEXT,
  wallet_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT w.id, w.encrypted_wallet, w.wallet_address, w.wallet_name, 
         w.created_at, w.updated_at, w.last_synced_at
  FROM public.wallets w
  WHERE w.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. GRANTS (Ensure proper permissions)
-- =============================================================================

-- Grant authenticated users access to wallets table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallets TO authenticated;
GRANT SELECT, INSERT ON public.wallet_sync_logs TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =============================================================================
-- MIGRATION COMPLETE! ✅
-- =============================================================================
-- 
-- Next steps:
-- 1. Enable Email/Password auth in Supabase Dashboard
-- 2. Configure Google OAuth (optional)
-- 3. Configure Apple OAuth (optional)
-- 4. Test the integration
--
-- =============================================================================

