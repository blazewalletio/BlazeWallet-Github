-- ============================================================================
-- ⭐ OFFICIAL TOKENS RANKING (Like MetaMask)
-- ============================================================================
-- Adds is_official flag and prioritizes official tokens in search results
-- Official tokens are canonical addresses that should ALWAYS appear first
-- ============================================================================

-- Add is_official column
ALTER TABLE public.token_registry 
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_token_registry_is_official ON public.token_registry(is_official) WHERE is_official = true;

-- Mark official tokens based on known canonical addresses
-- Solana
UPDATE public.token_registry 
SET is_official = true 
WHERE chain_key = 'solana' 
  AND address IN (
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', -- USDT
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', -- USDC
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', -- RAY
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', -- BONK
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', -- JUP
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'  -- WIF
  );

-- Ethereum
UPDATE public.token_registry 
SET is_official = true 
WHERE chain_key = 'ethereum' 
  AND LOWER(address) IN (
    LOWER('0xdAC17F958D2ee523a2206206994597C13D831ec7'), -- USDT
    LOWER('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'), -- USDC
    LOWER('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'), -- WBTC
    LOWER('0x514910771AF9Ca656af840dff83E8264EcF986CA')  -- LINK
  );

-- Polygon
UPDATE public.token_registry 
SET is_official = true 
WHERE chain_key = 'polygon' 
  AND LOWER(address) IN (
    LOWER('0xc2132D05D31c914a87C6611C10748AEb04B58e8F'), -- USDT
    LOWER('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174')  -- USDC
  );

-- BSC
UPDATE public.token_registry 
SET is_official = true 
WHERE chain_key = 'bsc' 
  AND LOWER(address) IN (
    LOWER('0x55d398326f99059fF775485246999027B3197955'), -- USDT
    LOWER('0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d')  -- USDC
  );

-- Arbitrum
UPDATE public.token_registry 
SET is_official = true 
WHERE chain_key = 'arbitrum' 
  AND LOWER(address) IN (
    LOWER('0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'), -- USDT
    LOWER('0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8')  -- USDC
  );

-- Base
UPDATE public.token_registry 
SET is_official = true 
WHERE chain_key = 'base' 
  AND LOWER(address) IN (
    LOWER('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')  -- USDC
  );

-- Optimism
UPDATE public.token_registry 
SET is_official = true 
WHERE chain_key = 'optimism' 
  AND LOWER(address) IN (
    LOWER('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'), -- USDT
    LOWER('0x7F5c764cBc14f9669B88837ca1490cCa17c31607')  -- USDC
  );

-- Avalanche
UPDATE public.token_registry 
SET is_official = true 
WHERE chain_key = 'avalanche' 
  AND LOWER(address) IN (
    LOWER('0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7'), -- USDT
    LOWER('0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E')  -- USDC
  );

-- Cronos
UPDATE public.token_registry 
SET is_official = true 
WHERE chain_key = 'cronos' 
  AND LOWER(address) IN (
    LOWER('0x66e428c3f67a68878562e79A0234c1F83c208770'), -- USDT
    LOWER('0xc21223249CA28397B4B6541dfFaEcC539BfF0c59')  -- USDC
  );

-- zkSync
UPDATE public.token_registry 
SET is_official = true 
WHERE chain_key = 'zksync' 
  AND LOWER(address) IN (
    LOWER('0x493257fD37EDB34451f62EDf8D2a0C418852bA4C'), -- USDT
    LOWER('0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4')  -- USDC
  );

-- Linea
UPDATE public.token_registry 
SET is_official = true 
WHERE chain_key = 'linea' 
  AND LOWER(address) IN (
    LOWER('0xA219439258ca9da29E9Cc4cE5596924745e12B93'), -- USDT
    LOWER('0x176211869cA2b568f2A7D4EE941E073a821EE1ff')  -- USDC
  );

-- Drop existing search_tokens function first (to avoid return type conflict)
DROP FUNCTION IF EXISTS public.search_tokens(TEXT, TEXT, INTEGER) CASCADE;

-- Update search_tokens function to prioritize official tokens
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
  price_usd DECIMAL(20, 8),
  volume_24h_usd DECIMAL(20, 2),
  liquidity_usd DECIMAL(20, 2),
  is_verified BOOLEAN,
  is_popular BOOLEAN,
  is_official BOOLEAN
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
    tr.is_popular,
    tr.is_official
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
    -- ⭐ 0. OFFICIAL TOKENS FIRST (HIGHEST PRIORITY - Like MetaMask!)
    CASE WHEN tr.is_official = true THEN 1 ELSE 2 END,
    -- 1. Exact symbol match (highest priority after official)
    -- This ensures "USDT" query shows real USDT first, not "FIRST USDT" or "Tether USDT"
    CASE WHEN LOWER(tr.symbol) = LOWER(p_query) THEN 1 ELSE 2 END,
    -- 2. Symbol starts with query (high priority, but after exact match)
    CASE WHEN LOWER(tr.symbol) LIKE LOWER(p_query) || '%' THEN 1 ELSE 2 END,
    -- 3. Name contains exact query (but symbol match is more important)
    CASE WHEN LOWER(tr.name) = LOWER(p_query) THEN 1 ELSE 2 END,
    -- 4. High liquidity = more popular/established (OBJECTIVE METRIC - most reliable!)
    -- This is better than manual flags because it's based on real trading data
    CASE 
      WHEN tr.liquidity_usd IS NOT NULL AND tr.liquidity_usd > 1000000 THEN 1  -- $1M+ = top tier
      WHEN tr.liquidity_usd IS NOT NULL AND tr.liquidity_usd > 100000 THEN 2  -- $100k+ = good
      WHEN tr.liquidity_usd IS NOT NULL AND tr.liquidity_usd > 10000 THEN 3    -- $10k+ = decent
      ELSE 4
    END,
    -- 5. High volume = actively traded (OBJECTIVE METRIC - shows real usage!)
    CASE 
      WHEN tr.volume_24h_usd IS NOT NULL AND tr.volume_24h_usd > 500000 THEN 1  -- $500k+ = very active
      WHEN tr.volume_24h_usd IS NOT NULL AND tr.volume_24h_usd > 50000 THEN 2    -- $50k+ = active
      WHEN tr.volume_24h_usd IS NOT NULL AND tr.volume_24h_usd > 5000 THEN 3   -- $5k+ = some activity
      ELSE 4
    END,
    -- 6. Popular tokens (manually marked - fallback if no liquidity/volume data)
    CASE WHEN tr.is_popular THEN 1 ELSE 2 END,
    -- 7. Verified tokens (trusted sources - fallback if no liquidity/volume data)
    CASE WHEN tr.is_verified THEN 1 ELSE 2 END,
    -- 8. Full-text search relevance score (PostgreSQL ranking)
    ts_rank_cd(tr.search_vector, plainto_tsquery('english', p_query)) DESC,
    -- 9. Liquidity (higher = better) - fine-grained sorting within same tier
    COALESCE(tr.liquidity_usd, 0) DESC,
    -- 10. Volume (higher = more active) - fine-grained sorting within same tier
    COALESCE(tr.volume_24h_usd, 0) DESC,
    -- 11. Tokens with price data (active trading)
    CASE WHEN tr.price_usd IS NOT NULL AND tr.price_usd > 0 THEN 1 ELSE 2 END,
    -- 12. Higher price = usually more established (but not always, so lower priority)
    COALESCE(tr.price_usd, 0) DESC,
    -- 13. Shorter symbol = usually better match (cleaner tokens have shorter symbols)
    -- "USDT" is better than "FIRST USDT" or "Tether USDT"
    LENGTH(tr.symbol),
    -- 14. Shorter name = usually better match (cleaner tokens have shorter names)
    -- "Tether USD" is better than "FIRST USDT" or "Tether USDT Token"
    LENGTH(tr.name),
    -- 15. Finally by name (alphabetical) for consistency
    tr.name
  LIMIT LEAST(p_limit, 50);  -- Cap at 50 for quality (deduplication will reduce further)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Add comment
COMMENT ON COLUMN public.token_registry.is_official IS 'True if this is the canonical/official token address (should always appear first in search)';

-- Success message
SELECT '✅ Official tokens ranking added! Official tokens will now appear first in search results (like MetaMask).' as message;

