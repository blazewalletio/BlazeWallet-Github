-- ============================================================================
-- 📊 ADD VOLUME & LIQUIDITY RANKING FOR TOKEN POPULARITY
-- ============================================================================
-- Adds volume_24h and liquidity_usd columns for better popularity ranking
-- These metrics provide objective popularity indicators (not just manual flags)
-- ============================================================================

-- Add volume and liquidity columns
ALTER TABLE public.token_registry 
  ADD COLUMN IF NOT EXISTS volume_24h_usd DECIMAL(20, 2),
  ADD COLUMN IF NOT EXISTS liquidity_usd DECIMAL(20, 2);

-- Create index for faster sorting by volume/liquidity
CREATE INDEX IF NOT EXISTS idx_token_registry_volume_24h ON public.token_registry(volume_24h_usd DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_token_registry_liquidity ON public.token_registry(liquidity_usd DESC NULLS LAST);

-- Drop existing search_tokens function first (to avoid return type conflict)
DROP FUNCTION IF EXISTS public.search_tokens(TEXT, TEXT, INTEGER) CASCADE;

-- Update search_tokens function to use volume/liquidity in ranking
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
  volume_24h_usd DECIMAL,
  liquidity_usd DECIMAL,
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
    tr.volume_24h_usd,
    tr.liquidity_usd,
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
    -- ✅ QUALITY FILTER: Only show tokens with real liquidity/volume OR verified+popular
    -- This filters out ~90% of spam tokens (like MetaMask does)
    -- For chains without volume/liquidity data yet, we fall back to verified tokens
    AND (
      -- Tier 1: Tokens with real trading activity (best quality)
      (tr.liquidity_usd IS NOT NULL AND tr.liquidity_usd > 10000)  -- $10k+ liquidity
      OR (tr.volume_24h_usd IS NOT NULL AND tr.volume_24h_usd > 5000)  -- $5k+ volume
      -- Tier 2: Official verified tokens (fallback for chains without volume/liquidity data)
      OR (tr.is_verified = true AND tr.is_popular = true)  -- Official verified tokens
      OR tr.is_verified = true  -- Verified tokens (for chains where we don't have volume data yet)
      -- Tier 3: Exact symbol matches (always show, even if new)
      OR LOWER(tr.symbol) = LOWER(p_query)  -- Always show exact symbol matches (even if new)
    )
  ORDER BY
    -- 1. Exact symbol match (highest priority)
    CASE WHEN LOWER(tr.symbol) = LOWER(p_query) THEN 1 ELSE 2 END,
    -- 2. Symbol starts with query (high priority)
    CASE WHEN LOWER(tr.symbol) LIKE LOWER(p_query) || '%' THEN 1 ELSE 2 END,
    -- 3. Popular tokens (manually marked)
    CASE WHEN tr.is_popular THEN 1 ELSE 2 END,
    -- 4. Verified tokens (trusted sources)
    CASE WHEN tr.is_verified THEN 1 ELSE 2 END,
    -- 5. High liquidity = more popular/established (objective metric!)
    CASE WHEN tr.liquidity_usd IS NOT NULL AND tr.liquidity_usd > 100000 THEN 1 ELSE 2 END, -- $100k+ liquidity
    -- 6. High volume = actively traded (objective metric!)
    CASE WHEN tr.volume_24h_usd IS NOT NULL AND tr.volume_24h_usd > 50000 THEN 1 ELSE 2 END, -- $50k+ volume
    -- 7. Full-text search relevance score
    ts_rank_cd(tr.search_vector, plainto_tsquery('english', p_query)) DESC,
    -- 8. Liquidity (higher = better)
    COALESCE(tr.liquidity_usd, 0) DESC,
    -- 9. Volume (higher = more active)
    COALESCE(tr.volume_24h_usd, 0) DESC,
    -- 10. Tokens with price data (active trading)
    CASE WHEN tr.price_usd IS NOT NULL AND tr.price_usd > 0 THEN 1 ELSE 2 END,
    -- 11. Higher price = usually more established
    COALESCE(tr.price_usd, 0) DESC,
    -- 12. Shorter symbol = usually better match
    LENGTH(tr.symbol),
    -- 13. Finally by name (alphabetical)
    tr.name
  LIMIT LEAST(p_limit, 50);  -- Cap at 50 for quality (deduplication will reduce further)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Add comments
COMMENT ON COLUMN public.token_registry.volume_24h_usd IS '24h trading volume in USD (from DexScreener/CoinGecko) - used for popularity ranking';
COMMENT ON COLUMN public.token_registry.liquidity_usd IS 'Current liquidity in USD (from DexScreener/CoinGecko) - used for popularity ranking';

-- Success message
SELECT '✅ Volume and liquidity columns added for better token ranking!' as message;

