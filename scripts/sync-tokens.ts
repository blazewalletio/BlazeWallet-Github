/**
 * Direct Token Sync Script
 * 
 * This script syncs tokens directly to Supabase without going through the API
 * Run with: npx tsx scripts/sync-tokens.ts
 */

// Load environment variables from .env.local or .env
import { config } from 'dotenv';
import { resolve } from 'path';

// Try .env.local first, then .env
const envPath = resolve(process.cwd(), '.env.local');
const envPathFallback = resolve(process.cwd(), '.env');
config({ path: envPath });
config({ path: envPathFallback, override: false });

import { createClient } from '@supabase/supabase-js';
import { CHAINS } from '../lib/chains';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CoinGecko platform mappings
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
  zksync: 'zksync',
  linea: 'linea',
};

const POPULAR_TOKENS = ['USDC', 'USDT', 'WETH', 'WBTC', 'DAI', 'MATIC', 'BNB', 'AVAX', 'FTM', 'CRO'];

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      if (attempt < maxRetries) {
        console.log(`  ⚠️ Attempt ${attempt} failed (${response.status}), retrying in ${attempt * 2}s...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error: any) {
      if (attempt < maxRetries) {
        console.log(`  ⚠️ Attempt ${attempt} failed (${error.message}), retrying in ${attempt * 2}s...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

async function syncSolanaTokens(): Promise<number> {
  try {
    console.log('🪐 Fetching Solana tokens from Jupiter...');
    
    // Try multiple Jupiter endpoints (cache.jup.ag seems most reliable)
    const urls = [
      'https://cache.jup.ag/tokens', // Most reliable fallback
      'https://token.jup.ag/all', // Primary
      'https://tokens.jup.ag/tokens', // Fallback 1
    ];

    let response: Response | null = null;
    let lastError: Error | null = null;

    for (const url of urls) {
      try {
        console.log(`  🔄 Trying: ${url}...`);
        response = await fetchWithRetry(url, {
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'BlazeWallet/2.0',
          },
          signal: AbortSignal.timeout(120000), // 120s timeout
        }, 3);

        if (response.ok) {
          console.log(`  ✅ Success with ${url}`);
          break;
        } else {
          console.log(`  ⚠️ ${url} returned ${response.status}, trying next...`);
          response = null;
        }
      } catch (error: any) {
        console.log(`  ⚠️ ${url} failed: ${error.message}, trying next...`);
        lastError = error;
        response = null;
      }
    }

    if (!response || !response.ok) {
      throw lastError || new Error(`All Jupiter endpoints failed`);
    }

    const jupiterTokens: any[] = await response.json();
    console.log(`🪐 Got ${jupiterTokens.length} tokens from Jupiter`);

    const chainKey = 'solana';
    const actualChainId = CHAINS[chainKey]?.id || 101;

    const tokensToInsert = jupiterTokens
      .filter(t => t.address && t.symbol)
      .map(t => ({
        chain_id: actualChainId,
        chain_key: chainKey,
        address: t.address,
        symbol: (t.symbol || '').toUpperCase(),
        name: t.name || t.symbol || 'Unknown Token',
        decimals: t.decimals || 9,
        logo_uri: t.logoURI || '',
        jupiter_mint: t.address,
        is_popular: POPULAR_TOKENS.includes((t.symbol || '').toUpperCase()),
        is_verified: true,
      }));

    // Batch insert in chunks of 1000 for better performance
    const chunkSize = 1000;
    let totalInserted = 0;

    console.log(`  📦 Inserting ${tokensToInsert.length} tokens in batches of ${chunkSize}...`);

    for (let i = 0; i < tokensToInsert.length; i += chunkSize) {
      const chunk = tokensToInsert.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('token_registry')
        .upsert(chunk, {
          onConflict: 'chain_id,address',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`  ❌ Error inserting chunk ${Math.floor(i / chunkSize) + 1}:`, error.message);
        throw error;
      }

      totalInserted += chunk.length;
      const progress = ((totalInserted / tokensToInsert.length) * 100).toFixed(1);
      console.log(`  ✅ Inserted ${totalInserted.toLocaleString()}/${tokensToInsert.length.toLocaleString()} Solana tokens (${progress}%)...`);
    }

    console.log(`✅ Synced ${tokensToInsert.length} Solana tokens`);
    return tokensToInsert.length;
  } catch (error: any) {
    console.error('❌ Failed to sync Solana tokens:', error);
    throw error;
  }
}

async function syncEVMChainTokens(chainKey: string): Promise<number> {
  try {
    const platform = COINGECKO_PLATFORMS[chainKey];
    if (!platform) {
      console.warn(`⚠️ No CoinGecko platform mapping for ${chainKey}`);
      return 0;
    }

    console.log(`🔷 Fetching ${chainKey} tokens from CoinGecko (platform: ${platform})...`);

    // CoinGecko free tier: 10-50 calls/min, so we need to be careful
    // Add delay before each request to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5s delay between chains

    const response = await fetchWithRetry('https://api.coingecko.com/api/v3/coins/list?include_platform=true', {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'BlazeWallet/1.0',
      },
      signal: AbortSignal.timeout(120000), // 120s timeout
    }, 5); // More retries for CoinGecko

    if (!response.ok) {
      if (response.status === 429) {
        console.log(`  ⚠️ Rate limited! Waiting 60 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 60000));
        // Retry once more after waiting
        const retryResponse = await fetch('https://api.coingecko.com/api/v3/coins/list?include_platform=true', {
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'BlazeWallet/1.0',
          },
          signal: AbortSignal.timeout(120000),
        });
        if (!retryResponse.ok) {
          throw new Error(`CoinGecko API error: ${retryResponse.status} (rate limited)`);
        }
        // Use retry response
        const allCoins: any[] = await retryResponse.json();
        return processChainTokens(chainKey, platform, allCoins);
      }
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const allCoins: any[] = await response.json();
    return processChainTokens(chainKey, platform, allCoins);
  } catch (error: any) {
    console.error(`❌ Failed to sync ${chainKey} tokens:`, error);
    throw error;
  }
}

async function processChainTokens(chainKey: string, platform: string, allCoins: any[]): Promise<number> {
  try {
    const chainTokens = allCoins
      .filter((coin: any) => coin.platforms && coin.platforms[platform])
      .map((coin: any) => ({
        chain_id: CHAINS[chainKey]?.id || 1,
        chain_key: chainKey,
        address: coin.platforms[platform].toLowerCase(),
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        decimals: 18,
        logo_uri: `https://assets.coingecko.com/coins/images/${coin.id}/small.png`,
        coingecko_id: coin.id,
        is_popular: POPULAR_TOKENS.includes(coin.symbol.toUpperCase()),
        is_verified: true,
      }));

    console.log(`🔷 Found ${chainTokens.length} ${chainKey} tokens`);

    // Batch insert in chunks of 1000 for better performance
    const chunkSize = 1000;
    let totalInserted = 0;

    if (chainTokens.length > 0) {
      console.log(`  📦 Inserting ${chainTokens.length} tokens in batches of ${chunkSize}...`);

      for (let i = 0; i < chainTokens.length; i += chunkSize) {
        const chunk = chainTokens.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('token_registry')
          .upsert(chunk, {
            onConflict: 'chain_id,address',
            ignoreDuplicates: false,
          });

        if (error) {
          console.error(`  ❌ Error inserting chunk ${Math.floor(i / chunkSize) + 1}:`, error.message);
          throw error;
        }

        totalInserted += chunk.length;
        const progress = ((totalInserted / chainTokens.length) * 100).toFixed(1);
        console.log(`  ✅ Inserted ${totalInserted.toLocaleString()}/${chainTokens.length.toLocaleString()} ${chainKey} tokens (${progress}%)...`);
      }
    }

    console.log(`✅ Synced ${chainTokens.length} ${chainKey} tokens`);
    return chainTokens.length;
  } catch (error: any) {
    console.error(`❌ Failed to process ${chainKey} tokens:`, error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting token sync for all chains...\n');

  const results: Record<string, number> = {};
  const errors: Record<string, string> = {};

  // Sync Solana first
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
      results[chainKey] = await syncEVMChainTokens(chainKey);
      // Longer delay between chains to avoid CoinGecko rate limiting (free tier: 10-50 calls/min)
      // We already have a 5s delay inside syncEVMChainTokens, so this adds extra safety
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error: any) {
      errors[chainKey] = error.message;
      console.error(`❌ [${chainKey}] Sync failed, continuing with next chain...`);
      // Still wait a bit even on error to avoid hammering the API
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  const totalSynced = Object.values(results).reduce((sum, count) => sum + count, 0);
  const hasErrors = Object.keys(errors).length > 0;

  console.log('\n' + '='.repeat(50));
  console.log('📊 SYNC RESULTS');
  console.log('='.repeat(50));
  console.log(`Total tokens synced: ${totalSynced.toLocaleString()}`);
  console.log('\nPer chain:');
  Object.entries(results).forEach(([chain, count]) => {
    console.log(`  ${chain.padEnd(15)} ${count.toLocaleString().padStart(10)} tokens`);
  });

  if (hasErrors) {
    console.log('\n⚠️ Errors:');
    Object.entries(errors).forEach(([chain, error]) => {
      console.log(`  ${chain}: ${error}`);
    });
  }

  console.log('\n✅ Sync completed!');
}

main().catch(console.error);

