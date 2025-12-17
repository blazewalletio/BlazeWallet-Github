/**
 * Direct Token Sync Script (Uses sync functions directly)
 * 
 * This script runs the token sync directly without going through the API
 * Run with: npx tsx scripts/run-sync-direct.ts
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envPathFallback = resolve(process.cwd(), '.env');
config({ path: envPath });
config({ path: envPathFallback, override: false });

// Import sync functions directly from the route file
// We'll need to extract the sync logic into a separate module or call it directly
import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger';
import { CHAINS } from '../lib/chains';
import { isOfficialToken } from '../lib/official-tokens';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Copy POPULAR_TOKENS from route.ts
const POPULAR_TOKENS = [
  // Stablecoins & Major
  'USDC', 'USDT', 'DAI', 'USDD', 'TUSD', 'FRAX', 'LUSD', 'BUSD',
  // Major chains
  'WETH', 'WBTC', 'MATIC', 'BNB', 'AVAX', 'FTM', 'CRO', 'LINK', 'UNI', 'AAVE',
  // Solana ecosystem (top tokens)
  'SOL', 'TRUMP', 'BONK', 'WIF', 'JUP', 'RAY', 'ORCA', 'MNGO', 'SAMO', 'COPE',
  'STEP', 'MEDIA', 'ATLAS', 'POLIS', 'FIDA', 'FRONT', 'ROPE', 'ALEPH',
  'TULIP', 'SLRS', 'PORT', 'SNY', 'LIKE', 'SLIM', 'WOOF', 'SDOGE', 'INU',
  // Memecoins & trending
  'PEPE', 'SHIB', 'DOGE', 'FLOKI', 'BABYDOGE', 'ELON', 'SAFEMOON',
  // DeFi
  'CAKE', 'SUSHI', 'CRV', 'MKR', 'COMP', 'SNX', 'YFI', '1INCH', 'BAL',
  // Layer 2 & new chains
  'ARB', 'OP', 'LRC', 'IMX', 'MAGIC', 'GMX', 'RDNT',
];

// Copy fetchJupiterTokens from route.ts
async function fetchJupiterTokens(): Promise<any[]> {
  const urls = [
    'https://cache.jup.ag/tokens',
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
          console.log(`✅ [Jupiter] Fetched ${tokens.length} tokens from ${url}`);
          return tokens;
        }
      }
    } catch (error: any) {
      console.warn(`⚠️ [Jupiter] ${url} failed: ${error.message}`);
    }
  }

  return [];
}

// Copy fetchDexScreenerActiveTokens from route.ts (improved version)
async function fetchDexScreenerActiveTokens(): Promise<any[]> {
  try {
    console.log('🔍 [DexScreener] Fetching actively traded Solana tokens (expanded popular tokens list)...');
    
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
    
    console.log(`🔍 [DexScreener] Searching for ${searchTerms.length} popular Solana tokens...`);

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
              
              // ✅ Prioritize tokens with higher liquidity/volume
              const existing = tokenMap.get(addr);
              const newLiquidity = pair.liquidity?.usd || 0;
              const newVolume = pair.volume?.h24 || 0;
              
              // Only add/update if this token has better data or doesn't exist
              if (!existing || newLiquidity > (existing.liquidity || 0) || newVolume > (existing.volume24h || 0)) {
                tokenMap.set(addr, {
                  address: token.address,
                  symbol: token.symbol,
                  name: token.name,
                  decimals: token.decimals || 9,
                  logoURI: pair.info?.imageUrl || '',
                  priceUsd: pair.priceUsd,
                  liquidity: pair.liquidity?.usd,
                  volume24h: pair.volume?.h24,
                  _pairLiquidity: pair.liquidity?.usd || 0,
                  _pairVolume: pair.volume?.h24 || 0,
                });
              }
            }
          });
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error: any) {
        console.warn(`⚠️ [DexScreener] Search for ${term} failed: ${error.message}`);
      }
    }

    const tokens = Array.from(tokenMap.values());
    console.log(`✅ [DexScreener] Found ${tokens.length} actively traded tokens`);
    return tokens;
  } catch (error: any) {
    console.error('❌ [DexScreener] Failed:', error.message);
    return [];
  }
}

// Copy syncSolanaTokens from route.ts (improved version)
async function syncSolanaTokens(): Promise<number> {
  try {
    console.log('🪐 [Sync] Starting multi-source Solana token sync...');

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
            console.log(`⭐ [Sync] Marking ${symbol} (${topToken.address.substring(0, 8)}...) as official (highest liquidity: $${(topToken.liquidity_usd || 0).toLocaleString()})`);
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

    console.log(`📊 [Sync] Total unique tokens: ${tokensToInsert.length}`);
    console.log(`   - From Jupiter: ${jupiterTokens.length}`);
    console.log(`   - From DexScreener: ${dexscreenerTokens.length}`);
    console.log(`   - New tokens (not in Jupiter): ${tokensToInsert.length - jupiterTokens.length}`);

    // Batch insert in chunks of 1000
    const chunkSize = 1000;
    let totalInserted = 0;

    for (let i = 0; i < tokensToInsert.length; i += chunkSize) {
      const chunk = tokensToInsert.slice(i, i + chunkSize);
      const { error } = await supabase
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
      console.log(`  ✅ Inserted ${totalInserted.toLocaleString()}/${tokensToInsert.length.toLocaleString()} tokens (${progress}%)...`);
    }

    console.log(`✅ [Sync] Synced ${tokensToInsert.length} Solana tokens from multiple sources`);
    return tokensToInsert.length;
  } catch (error: any) {
    console.error('❌ [Sync] Failed to sync Solana tokens:', error);
    throw error;
  }
}

// Main function
async function main() {
  console.log('🚀 Starting token sync for Solana...\n');

  try {
    const count = await syncSolanaTokens();
    console.log(`\n✅ Sync completed! Synced ${count.toLocaleString()} Solana tokens`);
    console.log('\n💡 OFFICIAL TRUMP should now be in Supabase and marked as official!');
  } catch (error: any) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

main();

