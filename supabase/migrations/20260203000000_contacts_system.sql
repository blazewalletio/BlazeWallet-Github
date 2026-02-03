-- ============================================================================
-- BLAZE WALLET - CONTACTS SYSTEM
-- ============================================================================
-- Purpose: Store user's saved wallet addresses (contacts) for easy sending
-- Author: BLAZE Team
-- Date: 2026-02-03
-- ============================================================================

-- ============================================================================
-- TABLE: contacts
-- ============================================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Contact Info
  name TEXT NOT NULL, -- Display name (e.g., "Mom", "John Doe", "Exchange Wallet")
  address TEXT NOT NULL, -- Wallet address (0x..., base58, bc1...)
  chain TEXT NOT NULL, -- Chain type (ethereum, solana, bitcoin, etc.)
  
  -- Optional metadata
  note TEXT, -- Optional note (e.g., "Monthly rent", "Trading account")
  avatar_url TEXT, -- Optional avatar/emoji
  is_favorite BOOLEAN DEFAULT FALSE, -- Favorite contacts
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ, -- Track when last used for sorting
  
  -- Usage stats
  usage_count INTEGER DEFAULT 0, -- How many times used
  total_sent_usd DECIMAL(20, 2) DEFAULT 0, -- Total USD value sent to this contact
  
  UNIQUE(user_id, address, chain) -- Prevent duplicate contacts
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_chain ON contacts(chain);
CREATE INDEX idx_contacts_is_favorite ON contacts(is_favorite);
CREATE INDEX idx_contacts_last_used ON contacts(last_used_at DESC NULLS LAST);
CREATE INDEX idx_contacts_usage_count ON contacts(usage_count DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own contacts
CREATE POLICY "Users can view own contacts"
  ON contacts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own contacts
CREATE POLICY "Users can create own contacts"
  ON contacts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own contacts
CREATE POLICY "Users can update own contacts"
  ON contacts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own contacts
CREATE POLICY "Users can delete own contacts"
  ON contacts
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- Function to increment usage stats
CREATE OR REPLACE FUNCTION increment_contact_usage(
  p_user_id UUID,
  p_address TEXT,
  p_chain TEXT,
  p_amount_usd DECIMAL DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  UPDATE contacts
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW(),
    total_sent_usd = total_sent_usd + p_amount_usd
  WHERE 
    user_id = p_user_id 
    AND address = p_address 
    AND chain = p_chain;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_contact_usage TO authenticated;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================
-- Note: This is just for development. Remove in production.

-- Add sample contacts for testing (commented out by default)
/*
INSERT INTO contacts (user_id, name, address, chain, note, is_favorite)
VALUES 
  (auth.uid(), 'Mom''s Wallet', '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1', 'ethereum', 'Monthly support', true),
  (auth.uid(), 'Exchange Hot Wallet', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'bitcoin', 'Binance deposit', false),
  (auth.uid(), 'DeFi Yield Farm', '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 'ethereum', 'Uniswap staking', false),
  (auth.uid(), 'NFT Marketplace', 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', 'solana', 'Magic Eden', false);
*/

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE contacts IS 'User saved wallet addresses for quick sending';
COMMENT ON COLUMN contacts.name IS 'Display name for the contact';
COMMENT ON COLUMN contacts.address IS 'Blockchain wallet address';
COMMENT ON COLUMN contacts.chain IS 'Blockchain type (ethereum, solana, bitcoin, etc.)';
COMMENT ON COLUMN contacts.is_favorite IS 'Quick access favorite contacts';
COMMENT ON COLUMN contacts.usage_count IS 'Number of times sent to this contact';
COMMENT ON COLUMN contacts.total_sent_usd IS 'Total USD value sent to this contact';
COMMENT ON COLUMN contacts.last_used_at IS 'Last time this contact was used for sending';

