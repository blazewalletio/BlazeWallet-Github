-- ============================================================================
-- 🪙 TOKEN REGISTRY - Comprehensive Token Database for All Chains
-- ============================================================================
-- Stores ALL tokens for ALL chains with full-text search support
-- Background sync job keeps it up-to-date
-- Client queries are instant (no waiting!)
-- ============================================================================

-- Create token_registry table
CREATE TABLE IF NOT EXISTS public.token_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id INTEGER NOT NULL,
  chain_key TEXT NOT NULL, -- 'solana', 'ethereum', 'polygon', etc.
  address TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 18,
  logo_uri TEXT,
  price_usd DECIMAL(20, 8),
  coingecko_id TEXT,
  jupiter_mint TEXT, -- For Solana tokens
  is_verified BOOLEAN DEFAULT false,
  is_popular BOOLEAN DEFAULT false, -- Popular tokens (USDC, USDT, etc.)
  search_vector tsvector, -- Full-text search vector
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one token per chain+address
  CONSTRAINT token_registry_chain_address_unique UNIQUE (chain_id, address)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_token_registry_chain_key ON public.token_registry(chain_key);
CREATE INDEX IF NOT EXISTS idx_token_registry_chain_id ON public.token_registry(chain_id);
CREATE INDEX IF NOT EXISTS idx_token_registry_symbol ON public.token_registry(symbol);
CREATE INDEX IF NOT EXISTS idx_token_registry_name ON public.token_registry(name);
CREATE INDEX IF NOT EXISTS idx_token_registry_address ON public.token_registry(address);
CREATE INDEX IF NOT EXISTS idx_token_registry_popular ON public.token_registry(is_popular) WHERE is_popular = true;
CREATE INDEX IF NOT EXISTS idx_token_registry_verified ON public.token_registry(is_verified) WHERE is_verified = true;

-- Full-text search index (GIN index for fast text search)
CREATE INDEX IF NOT EXISTS idx_token_registry_search_vector ON public.token_registry USING GIN(search_vector);

-- Function to update search_vector automatically
CREATE OR REPLACE FUNCTION public.update_token_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.symbol, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.address, '')), 'C');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update search_vector
DROP TRIGGER IF EXISTS trigger_update_token_search_vector ON public.token_registry;
CREATE TRIGGER trigger_update_token_search_vector
  BEFORE INSERT OR UPDATE ON public.token_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.update_token_search_vector();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_token_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_token_registry_updated_at ON public.token_registry;
CREATE TRIGGER trigger_update_token_registry_updated_at
  BEFORE UPDATE ON public.token_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.update_token_registry_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE public.token_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Everyone can read tokens (public data)
CREATE POLICY "Anyone can view tokens"
  ON public.token_registry
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- RLS Policy: Only service role can insert/update/delete (for sync job)
CREATE POLICY "Service role can manage tokens"
  ON public.token_registry
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to search tokens (full-text search)
CREATE OR REPLACE FUNCTION public.search_tokens(
  p_chain_key TEXT,
  p_query TEXT,
  p_limit INTEGER DEFAULT 200
)
RETURNS TABLE (
  id UUID,
  chain_id INTEGER,
  chain_key TEXT,
  address TEXT,
  symbol TEXT,
  name TEXT,
  decimals INTEGER,
  logo_uri TEXT,
  price_usd DECIMAL,
  is_verified BOOLEAN,
  is_popular BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tr.id,
    tr.chain_id,
    tr.chain_key,
    tr.address,
    tr.symbol,
    tr.name,
    tr.decimals,
    tr.logo_uri,
    tr.price_usd,
    tr.is_verified,
    tr.is_popular
  FROM public.token_registry tr
  WHERE 
    tr.chain_key = p_chain_key
    AND (
      -- Full-text search (prioritized)
      tr.search_vector @@ plainto_tsquery('english', p_query)
      OR
      -- Fallback: symbol/name/address contains query (case-insensitive)
      tr.symbol ILIKE '%' || p_query || '%'
      OR tr.name ILIKE '%' || p_query || '%'
      OR tr.address ILIKE '%' || p_query || '%'
    )
  ORDER BY
    -- Prioritize exact symbol matches
    CASE WHEN LOWER(tr.symbol) = LOWER(p_query) THEN 1 ELSE 2 END,
    -- Then prioritize symbol starts with
    CASE WHEN LOWER(tr.symbol) LIKE LOWER(p_query) || '%' THEN 1 ELSE 2 END,
    -- Then prioritize popular tokens
    CASE WHEN tr.is_popular THEN 1 ELSE 2 END,
    -- Then prioritize verified tokens
    CASE WHEN tr.is_verified THEN 1 ELSE 2 END,
    -- Then by symbol length (shorter = better match)
    LENGTH(tr.symbol),
    -- Finally by name
    tr.name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Function to get popular tokens for a chain
CREATE OR REPLACE FUNCTION public.get_popular_tokens(
  p_chain_key TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  chain_id INTEGER,
  chain_key TEXT,
  address TEXT,
  symbol TEXT,
  name TEXT,
  decimals INTEGER,
  logo_uri TEXT,
  price_usd DECIMAL,
  is_verified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tr.id,
    tr.chain_id,
    tr.chain_key,
    tr.address,
    tr.symbol,
    tr.name,
    tr.decimals,
    tr.logo_uri,
    tr.price_usd,
    tr.is_verified
  FROM public.token_registry tr
  WHERE 
    tr.chain_key = p_chain_key
    AND tr.is_popular = true
  ORDER BY tr.symbol
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Function to get token count per chain
CREATE OR REPLACE FUNCTION public.get_token_count(p_chain_key TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.token_registry
    WHERE chain_key = p_chain_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Add comment
COMMENT ON TABLE public.token_registry IS 'Comprehensive token registry for all chains. Synced from Jupiter (Solana) and CoinGecko (EVM chains). Full-text search enabled.';
COMMENT ON COLUMN public.token_registry.search_vector IS 'Full-text search vector (auto-generated from symbol, name, address)';
COMMENT ON COLUMN public.token_registry.is_popular IS 'Popular tokens (USDC, USDT, etc.) shown first in search results';
COMMENT ON COLUMN public.token_registry.is_verified IS 'Verified tokens (from official sources)';

-- Success message
SELECT '✅ Token registry table created with full-text search support!' as message;

