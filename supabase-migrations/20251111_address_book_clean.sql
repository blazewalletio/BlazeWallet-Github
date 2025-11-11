-- ============================================================================
-- 📇 BLAZE WALLET - ADDRESS BOOK SCHEMA (CLEAN INSTALL)
-- ============================================================================
-- This script safely drops and recreates everything
-- ============================================================================

-- ============================================================================
-- CLEANUP (Drop everything in reverse order of dependencies)
-- ============================================================================

-- Drop materialized view and related objects
DROP MATERIALIZED VIEW IF EXISTS address_book_stats CASCADE;
DROP FUNCTION IF EXISTS refresh_address_book_stats() CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS search_contacts(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_contact_by_address(UUID, TEXT, TEXT) CASCADE;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS trigger_update_address_book_updated_at ON address_book CASCADE;
DROP FUNCTION IF EXISTS update_address_book_updated_at() CASCADE;

-- Drop table (this will also drop all policies, indexes, and constraints)
DROP TABLE IF EXISTS address_book CASCADE;

-- ============================================================================
-- CREATE FRESH SCHEMA
-- ============================================================================

-- Address Book Contacts
CREATE TABLE address_book (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Contact Info
  name TEXT NOT NULL,
  chain TEXT NOT NULL,
  address TEXT NOT NULL,
  
  -- Customization
  emoji TEXT DEFAULT '👤',
  is_favorite BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT address_book_user_chain_address_key UNIQUE (user_id, chain, address),
  CONSTRAINT address_book_name_check CHECK (char_length(name) > 0 AND char_length(name) <= 100),
  CONSTRAINT address_book_chain_check CHECK (chain IN (
    'ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 
    'avalanche', 'bsc', 'fantom', 'cronos', 'zksync', 'linea',
    'solana', 'bitcoin', 'litecoin', 'dogecoin', 'bitcoincash'
  ))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_address_book_user_id ON address_book(user_id);
CREATE INDEX idx_address_book_user_chain ON address_book(user_id, chain);
CREATE INDEX idx_address_book_favorites ON address_book(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX idx_address_book_name_search ON address_book USING gin(to_tsvector('simple', name));
CREATE INDEX idx_address_book_created_at ON address_book(user_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE address_book ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts"
  ON address_book
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contacts"
  ON address_book
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
  ON address_book
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON address_book
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_address_book_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_address_book_updated_at
  BEFORE UPDATE ON address_book
  FOR EACH ROW
  EXECUTE FUNCTION update_address_book_updated_at();

-- ============================================================================
-- MATERIALIZED VIEW - Contact Statistics (FIXED!)
-- ============================================================================

CREATE MATERIALIZED VIEW address_book_stats AS
SELECT 
  ab.id as contact_id,
  ab.user_id,
  ab.name,
  ab.chain,
  ab.address,
  COUNT(st.id) as transaction_count,
  COALESCE(SUM(CAST(st.amount AS DECIMAL)), 0) as total_sent,
  MAX(st.executed_at) as last_transaction_at
FROM address_book ab
LEFT JOIN scheduled_transactions st 
  ON CAST(st.user_id AS UUID) = ab.user_id 
  AND st.to_address = ab.address 
  AND st.chain = ab.chain
  AND st.status = 'completed'
GROUP BY ab.id, ab.user_id, ab.name, ab.chain, ab.address;

CREATE UNIQUE INDEX idx_address_book_stats_contact_id ON address_book_stats(contact_id);
CREATE INDEX idx_address_book_stats_user_id ON address_book_stats(user_id);

-- ============================================================================
-- REFRESH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_address_book_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY address_book_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION search_contacts(
  p_user_id UUID,
  p_query TEXT,
  p_chain TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  chain TEXT,
  address TEXT,
  emoji TEXT,
  is_favorite BOOLEAN,
  tags TEXT[],
  transaction_count BIGINT,
  last_used TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ab.id,
    ab.name,
    ab.chain,
    ab.address,
    ab.emoji,
    ab.is_favorite,
    ab.tags,
    COALESCE(abs.transaction_count, 0) as transaction_count,
    abs.last_transaction_at as last_used
  FROM address_book ab
  LEFT JOIN address_book_stats abs ON abs.contact_id = ab.id
  WHERE 
    ab.user_id = p_user_id
    AND (p_chain IS NULL OR ab.chain = p_chain)
    AND (
      ab.name ILIKE '%' || p_query || '%'
      OR ab.address ILIKE '%' || p_query || '%'
      OR p_query = ''
    )
  ORDER BY 
    ab.is_favorite DESC,
    COALESCE(abs.transaction_count, 0) DESC,
    ab.name ASC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_contact_by_address(
  p_user_id UUID,
  p_chain TEXT,
  p_address TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  emoji TEXT,
  is_favorite BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ab.id,
    ab.name,
    ab.emoji,
    ab.is_favorite
  FROM address_book ab
  WHERE 
    ab.user_id = p_user_id
    AND ab.chain = p_chain
    AND ab.address = p_address
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SUCCESS!
-- ============================================================================

SELECT 'Address Book schema successfully installed!' as message;

