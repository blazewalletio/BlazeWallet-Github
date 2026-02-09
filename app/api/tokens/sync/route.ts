import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { CHAINS } from '@/lib/chains';
import { getLiFiChainId } from '@/lib/lifi-chain-ids';
import { isOfficialToken } from '@/lib/official-tokens';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

// CoinGecko platform mappings for EVM chains
const COINGECKO_PLATFORMS: Record<string, string> = {
  ethereum: 'ethereum',
  polygon: 'polygon-pos',
  arbitrum: 'arbitrum-one',
  base: 'base',
  bsc: 'binance-smart-chain',
  optimism: 'optimistic-ethereum',
  avalanche: 'avalanche',
  fantom: 'fantom',
  cronos: 'cronos',
  zksync: 'zksync', // Note: CoinGecko might not have zkSync tokens
  linea: 'linea', // Note: CoinGecko might not have Linea tokens
};

// Popular tokens (marked as popular in database)
// ⭐ EXPANDED: Top 100+ popular tokens to ensure ALL are synced
const POPULAR_TOKENS = [
  // Stablecoins & Major
  'USDC', 'USDT', 'DAI', 'USDD', 'TUSD', 'FRAX', 'LUSD', 'BUSD',
  // Major chains
  'WETH', 'WBTC', 'MATIC', 'BNB', 'AVAX', 'FTM', 'CRO', 'LINK', 'UNI', 'AAVE',
  // Solana ecosystem (top tokens)
  'SOL', 'TRUMP', 'BONK', 'WIF', 'JUP', 'RAY', 'ORCA', 'MNGO', 'SAMO', 'COPE',
  'STEP', 'MEDIA', 'ATLAS', 'POLIS', 'FIDA', 'FRONT', 'COPE', 'ROPE', 'ALEPH',
  'TULIP', 'SLRS', 'PORT', 'SNY', 'LIKE', 'SLIM', 'WOOF', 'SDOGE', 'INU',
  // Memecoins & trending
  'PEPE', 'SHIB', 'DOGE', 'FLOKI', 'BABYDOGE', 'ELON', 'SAFEMOON',
  // DeFi
  'CAKE', 'SUSHI', 'CRV', 'MKR', 'COMP', 'SNX', 'YFI', '1INCH', 'BAL',
  // Layer 2 & new chains
  'ARB', 'OP', 'LRC', 'IMX', 'MAGIC', 'GMX', 'RDNT',
];

/**
 * Fetch tokens from Jupiter (baseline)
 */
async function fetchJupiterTokens(): Promise<any[]> {
  const urls = [
    'https://cache.jup.ag/tokens', // Most reliable
    'https://token.jup.ag/all',
    'https://tokens.jup.ag/tokens',
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(120000),
      });

      if (response.ok) {
        const tokens = await response.json();
        if (Array.isArray(tokens) && tokens.length > 0) {
          logger.log(`✅ [Jupiter] Fetched ${tokens.length} tokens from ${url}`);
          return tokens;
        }
      }
    } catch (error: any) {
      logger.warn(`⚠️ [Jupiter] ${url} failed: ${error.message}`);
    }
  }

  return [];
}

/**
 * Fetch actively traded tokens from DexScreener
 * This includes NEW tokens that aren't in Jupiter yet (like official TRUMP)!
 */
async function fetchDexScreenerActiveTokens(): Promise<any[]> {
  try {
    logger.log('🔍 [DexScreener] Fetching actively traded Solana tokens...');
    
    // ✅ EXPANDED: Search for ALL popular Solana tokens to ensure complete coverage
    const popularSolanaTokens = POPULAR_TOKENS.filter(t => 
      ['TRUMP', 'BONK', 'WIF', 'JUP', 'RAY', 'ORCA', 'MNGO', 'SAMO', 'COPE', 
       'STEP', 'MEDIA', 'ATLAS', 'POLIS', 'FIDA', 'FRONT', 'ROPE', 'ALEPH',
       'TULIP', 'SLRS', 'PORT', 'SNY', 'LIKE', 'SLIM', 'WOOF', 'SDOGE', 'INU',
       'USDC', 'USDT', 'SOL'].includes(t)
    );
    
    // Search for popular tokens to get actively traded ones
    const searchTerms = popularSolanaTokens.length > 0 ? popularSolanaTokens : ['TRUMP', 'BONK', 'WIF', 'JUP', 'USDC', 'USDT'];
    const tokenMap = new Map();
    
    logger.log(`🔍 [DexScreener] Searching for ${searchTerms.length} popular Solana tokens...`);

    for (const term of searchTerms) {
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${term}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(30000),
        });

        if (response.ok) {
          const data = await response.json();
          const solanaPairs = (data.pairs || []).filter((p: any) => 
            p.chainId === 'solana' || p.chainId === 'solana-mainnet'
          );

          solanaPairs.forEach((pair: any) => {
            if (pair.baseToken) {
              const token = pair.baseToken;
              const addr = token.address.toLowerCase();
              if (!tokenMap.has(addr)) {
                tokenMap.set(addr, {
                  address: token.address,
                  symbol: token.symbol,
                  name: token.name,
                  decimals: token.decimals || 9,
                  logoURI: pair.info?.imageUrl || '',
                  priceUsd: pair.priceUsd,
                  liquidity: pair.liquidity?.usd,
                  volume24h: pair.volume?.h24, // 24h volume for ranking
                });
              }
            }
          });
        }
      } catch (error: any) {
        logger.warn(`⚠️ [DexScreener] Search for ${term} failed: ${error.message}`);
      }
    }

    const tokens = Array.from(tokenMap.values());
    logger.log(`✅ [DexScreener] Found ${tokens.length} actively traded tokens`);
    return tokens;
  } catch (error: any) {
    logger.error('❌ [DexScreener] Failed:', error.message);
    return [];
  }
}

/**
 * Sync Solana tokens from MULTIPLE sources (Jupiter + DexScreener)
 * This ensures we have ALL tokens, including new ones like official TRUMP
 */
async function syncSolanaTokens(): Promise<number> {
  try {
    logger.log('🪐 [Sync] Starting multi-source Solana token sync...');

    const chainKey = 'solana';
    const actualChainId = CHAINS[chainKey]?.id || 101;

    // Fetch from multiple sources in parallel
    const [jupiterTokens, dexscreenerTokens] = await Promise.all([
      fetchJupiterTokens(),
      fetchDexScreenerActiveTokens(),
    ]);

    // Combine and deduplicate by address
    const tokenMap = new Map<string, any>();

    // 1. Add Jupiter tokens (baseline - all verified tokens)
    jupiterTokens.forEach((t: any) => {
      if (t.address && t.symbol) {
        const addr = t.address.toLowerCase();
        tokenMap.set(addr, {
          address: t.address,
          symbol: (t.symbol || '').toUpperCase(),
          name: t.name || t.symbol || 'Unknown Token',
          decimals: t.decimals || 9,
          logo_uri: t.logoURI || '',
          jupiter_mint: t.address,
          is_verified: true,
        });
      }
    });

    // 2. Add DexScreener tokens (overwrites with better data, adds NEW tokens)
    dexscreenerTokens.forEach((t: any) => {
      if (t.address && t.symbol) {
        const addr = t.address.toLowerCase();
        const existing = tokenMap.get(addr);
        if (existing) {
          // Update with DexScreener data (has price, liquidity, volume, better logo)
          existing.logo_uri = t.logoURI || existing.logo_uri;
          existing.price_usd = t.priceUsd;
          existing.liquidity_usd = t.liquidity;
          existing.volume_24h_usd = t.volume24h;
        } else {
          // NEW token not in Jupiter! (like official TRUMP)
          tokenMap.set(addr, {
            address: t.address,
            symbol: (t.symbol || '').toUpperCase(),
            name: t.name || t.symbol || 'Unknown Token',
            decimals: t.decimals || 9,
            logo_uri: t.logoURI || '',
            price_usd: t.priceUsd,
            liquidity_usd: t.liquidity,
            volume_24h_usd: t.volume24h,
            jupiter_mint: t.address,
            is_verified: false, // Not in Jupiter, so not verified yet
          });
        }
      }
    });

    // ✅ STEP 3: Mark official tokens (especially TRUMP - highest liquidity wins!)
    // For popular tokens with same symbol, mark the one with highest liquidity as official
    const symbolGroups = new Map<string, any[]>();
    Array.from(tokenMap.values()).forEach(t => {
      const symbol = t.symbol.toUpperCase();
      if (!symbolGroups.has(symbol)) {
        symbolGroups.set(symbol, []);
      }
      symbolGroups.get(symbol)!.push(t);
    });
    
    // Mark highest liquidity token per symbol as "official" (if popular and not already marked)
    symbolGroups.forEach((tokens, symbol) => {
      if (tokens.length > 1 && POPULAR_TOKENS.includes(symbol)) {
        // Sort by liquidity (highest first)
        tokens.sort((a, b) => (b.liquidity_usd || 0) - (a.liquidity_usd || 0));
        
        // Mark top token as official if not already marked
        const topToken = tokens[0];
        if (!isOfficialToken('solana', topToken.address)) {
          // Mark as official in tokenMap
          const addr = topToken.address.toLowerCase();
          const existing = tokenMap.get(addr);
          if (existing) {
            existing._isOfficial = true;
            logger.log(`⭐ [Sync] Marking ${symbol} (${topToken.address.substring(0, 8)}...) as official (highest liquidity: $${(topToken.liquidity_usd || 0).toLocaleString()})`);
          }
        }
      }
    });

    // Convert to array and prepare for database
    const tokensToInsert = Array.from(tokenMap.values()).map(t => ({
      chain_id: actualChainId,
      chain_key: chainKey,
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      logo_uri: t.logo_uri,
      price_usd: t.price_usd,
      volume_24h_usd: t.volume_24h_usd || null,
      liquidity_usd: t.liquidity_usd || null,
      jupiter_mint: t.jupiter_mint || t.address,
      is_popular: POPULAR_TOKENS.includes(t.symbol),
      is_verified: t.is_verified || false,
      // ⭐ Mark official: either in official list OR highest liquidity popular token
      is_official: isOfficialToken('solana', t.address) || (t._isOfficial || false),
    }));

    logger.log(`📊 [Sync] Total unique tokens: ${tokensToInsert.length}`);
    logger.log(`   - From Jupiter: ${jupiterTokens.length}`);
    logger.log(`   - From DexScreener: ${dexscreenerTokens.length}`);
    logger.log(`   - New tokens (not in Jupiter): ${tokensToInsert.length - jupiterTokens.length}`);

    // Batch insert in chunks of 1000
    const chunkSize = 1000;
    let totalInserted = 0;

    for (let i = 0; i < tokensToInsert.length; i += chunkSize) {
      const chunk = tokensToInsert.slice(i, i + chunkSize);
      const { error } = await getSupabaseAdmin()
        .from('token_registry')
        .upsert(chunk, {
          onConflict: 'chain_id,address',
          ignoreDuplicates: false,
        });

      if (error) {
        throw error;
      }

      totalInserted += chunk.length;
      const progress = ((totalInserted / tokensToInsert.length) * 100).toFixed(1);
      logger.log(`  ✅ Inserted ${totalInserted.toLocaleString()}/${tokensToInsert.length.toLocaleString()} tokens (${progress}%)...`);
    }

    logger.log(`✅ [Sync] Synced ${tokensToInsert.length} Solana tokens from multiple sources`);
    return tokensToInsert.length;
  } catch (error: any) {
    logger.error('❌ [Sync] Failed to sync Solana tokens:', error);
    throw error;
  }
}

/**
 * Fetch volume/liquidity data from DexScreener for a specific token
 * Works for all chains (Solana, Ethereum, BSC, etc.)
 */
async function fetchDexScreenerTokenData(address: string, chainKey: string): Promise<{ volume24h?: number; liquidity?: number; price?: number } | null> {
  try {
    // Map chain keys to DexScreener chain IDs
    const chainMap: Record<string, string> = {
      'ethereum': 'ethereum',
      'bsc': 'bsc',
      'polygon': 'polygon',
      'solana': 'solana',
      'base': 'base',
      'avalanche': 'avalanche',
      'arbitrum': 'arbitrum',
      'optimism': 'optimism',
      'fantom': 'fantom',
      'cronos': 'cronos',
    };

    const dexChain = chainMap[chainKey];
    if (!dexChain) return null;

    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000), // 10s timeout per token
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.pairs || data.pairs.length === 0) return null;

    // Get pair with highest liquidity
    const bestPair = data.pairs.reduce((best: any, current: any) => {
      const bestLiq = best.liquidity?.usd || 0;
      const currentLiq = current.liquidity?.usd || 0;
      return currentLiq > bestLiq ? current : best;
    }, data.pairs[0]);

    return {
      volume24h: bestPair.volume?.h24,
      liquidity: bestPair.liquidity?.usd,
      price: parseFloat(bestPair.priceUsd || '0'),
    };
  } catch (error: any) {
    return null; // Fail silently - not critical
  }
}

/**
 * Sync EVM chain tokens from CoinGecko + DexScreener (for volume/liquidity)
 */
async function syncEVMChainTokens(chainKey: string): Promise<number> {
  try {
    const platform = COINGECKO_PLATFORMS[chainKey];
    if (!platform) {
      logger.warn(`⚠️ [Sync] No CoinGecko platform mapping for ${chainKey}`);
      return 0;
    }

    logger.log(`🔷 [Sync] Fetching ${chainKey} tokens from CoinGecko (platform: ${platform})...`);

    const response = await fetch('https://api.coingecko.com/api/v3/coins/list?include_platform=true', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const allCoins: any[] = await response.json();
    
    // Get popular tokens first (they're more likely to have volume/liquidity data)
    const popularSymbols = POPULAR_TOKENS;
    const popularCoins = allCoins.filter((coin: any) => 
      coin.platforms && coin.platforms[platform] && popularSymbols.includes(coin.symbol.toUpperCase())
    );
    const otherCoins = allCoins.filter((coin: any) => 
      coin.platforms && coin.platforms[platform] && !popularSymbols.includes(coin.symbol.toUpperCase())
    );

    // Process popular tokens first (with volume/liquidity lookup from DexScreener)
    logger.log(`🔷 [Sync] Processing ${popularCoins.length} popular ${chainKey} tokens with volume/liquidity data...`);
    const popularTokens = await Promise.all(
      popularCoins.slice(0, 50).map(async (coin: any) => { // Limit to top 50 popular tokens to avoid rate limits
        const address = coin.platforms[platform].toLowerCase();
        const dexData = await fetchDexScreenerTokenData(address, chainKey);
        
        return {
          chain_id: CHAINS[chainKey]?.id || 1,
          chain_key: chainKey,
          address: address,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          decimals: 18,
          logo_uri: `https://assets.coingecko.com/coins/images/${coin.id}/small.png`,
          coingecko_id: coin.id,
          price_usd: dexData?.price || null,
          volume_24h_usd: dexData?.volume24h || null,
          liquidity_usd: dexData?.liquidity || null,
          is_popular: true,
          is_verified: true,
        };
      })
    );

    // Process other tokens (without volume/liquidity lookup to save API calls)
    const otherTokens = otherCoins.map((coin: any) => ({
      chain_id: CHAINS[chainKey]?.id || 1,
      chain_key: chainKey,
      address: coin.platforms[platform].toLowerCase(),
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      decimals: 18,
      logo_uri: `https://assets.coingecko.com/coins/images/${coin.id}/small.png`,
      coingecko_id: coin.id,
      price_usd: null,
      volume_24h_usd: null,
      liquidity_usd: null,
      is_popular: false,
      is_verified: true,
      is_official: isOfficialToken(chainKey, coin.platforms[platform].toLowerCase()), // ⭐ Mark official tokens
    }));

    const chainTokens = [...popularTokens, ...otherTokens];
    logger.log(`🔷 [Sync] Found ${chainTokens.length} ${chainKey} tokens (${popularTokens.length} with volume/liquidity data)`);

    // Upsert tokens
    const { error } = await getSupabaseAdmin()
      .from('token_registry')
      .upsert(chainTokens, {
        onConflict: 'chain_id,address',
        ignoreDuplicates: false,
      });

    if (error) {
      throw error;
    }

    logger.log(`✅ [Sync] Synced ${chainTokens.length} ${chainKey} tokens`);
    return chainTokens.length;
  } catch (error: any) {
    logger.error(`❌ [Sync] Failed to sync ${chainKey} tokens:`, error);
    throw error;
  }
}

/**
 * Sync all tokens for all chains
 */
export async function POST(request: NextRequest) {
  try {
    // Verify request is from cron job or has valid auth
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret') || 
                      new URL(request.url).searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';

    if (authHeader !== `Bearer ${expectedSecret}` && cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.log('🚀 [Sync] Starting token sync for all chains...');

    const results: Record<string, number> = {};
    const errors: Record<string, string> = {};

    // Sync Solana
    try {
      results.solana = await syncSolanaTokens();
    } catch (error: any) {
      errors.solana = error.message;
    }

    // Sync all EVM chains
    const evmChains = [
      'ethereum',
      'polygon',
      'arbitrum',
      'base',
      'bsc',
      'optimism',
      'avalanche',
      'fantom',
      'cronos',
      'zksync',
      'linea',
    ];

    for (const chainKey of evmChains) {
      try {
        logger.log(`🔷 [Sync] Starting ${chainKey} sync...`);
        results[chainKey] = await syncEVMChainTokens(chainKey);
        logger.log(`✅ [Sync] ${chainKey} sync complete: ${results[chainKey]} tokens`);
        // Small delay to avoid rate limiting (CoinGecko free tier: 10-50 calls/min)
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
      } catch (error: any) {
        logger.error(`❌ [Sync] ${chainKey} sync failed:`, error);
        errors[chainKey] = error.message;
        // Continue with next chain even if one fails
      }
    }

    const totalSynced = Object.values(results).reduce((sum, count) => sum + count, 0);
    const hasErrors = Object.keys(errors).length > 0;

    logger.log(`✅ [Sync] Completed! Synced ${totalSynced} tokens total`);

    return NextResponse.json({
      success: !hasErrors,
      totalSynced,
      results,
      errors: hasErrors ? errors : undefined,
    });
  } catch (error: any) {
    logger.error('❌ [Sync] Token sync failed:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to trigger sync manually (for testing)
 */
export async function GET(request: NextRequest) {
  // Only allow in development or with auth
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Use POST with authentication' },
      { status: 405 }
    );
  }

  // Trigger sync
  const response = await POST(request);
  return response;
}

