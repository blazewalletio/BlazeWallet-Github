import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { CHAINS } from '@/lib/chains';
import { getLiFiChainId } from '@/lib/lifi-chain-ids';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
const POPULAR_TOKENS = ['USDC', 'USDT', 'USDT', 'WETH', 'WBTC', 'DAI', 'MATIC', 'BNB', 'AVAX', 'FTM', 'CRO'];

/**
 * Sync Solana tokens from Jupiter
 */
async function syncSolanaTokens(): Promise<number> {
  try {
    logger.log('🪐 [Sync] Fetching Solana tokens from Jupiter...');
    
    const response = await fetch('https://token.jup.ag/all', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }

    const jupiterTokens: any[] = await response.json();
    logger.log(`🪐 [Sync] Got ${jupiterTokens.length} tokens from Jupiter`);

    const chainId = getLiFiChainId('solana');
    const chainKey = 'solana';

    // Prepare tokens for insertion
    const tokensToInsert = jupiterTokens
      .filter(t => t.address && t.symbol) // Only valid tokens
      .map(t => ({
        chain_id: typeof chainId === 'string' ? parseInt(chainId) || 101 : chainId,
        chain_key: chainKey,
        address: t.address,
        symbol: t.symbol.toUpperCase(),
        name: t.name || t.symbol,
        decimals: t.decimals || 9,
        logo_uri: t.logoURI || '',
        jupiter_mint: t.address,
        is_popular: POPULAR_TOKENS.includes(t.symbol.toUpperCase()),
        is_verified: true, // Jupiter tokens are verified
      }));

    // Upsert tokens (insert or update if exists)
    const { error } = await supabase
      .from('token_registry')
      .upsert(tokensToInsert, {
        onConflict: 'chain_id,address',
        ignoreDuplicates: false,
      });

    if (error) {
      throw error;
    }

    logger.log(`✅ [Sync] Synced ${tokensToInsert.length} Solana tokens`);
    return tokensToInsert.length;
  } catch (error: any) {
    logger.error('❌ [Sync] Failed to sync Solana tokens:', error);
    throw error;
  }
}

/**
 * Sync EVM chain tokens from CoinGecko
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
    
    // Filter for tokens on this platform
    const chainTokens = allCoins
      .filter((coin: any) => coin.platforms && coin.platforms[platform])
      .map((coin: any) => ({
        chain_id: CHAINS[chainKey]?.id || 1,
        chain_key: chainKey,
        address: coin.platforms[platform].toLowerCase(),
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        decimals: 18, // Default, will be fetched on-chain if needed
        logo_uri: `https://assets.coingecko.com/coins/images/${coin.id}/small.png`,
        coingecko_id: coin.id,
        is_popular: POPULAR_TOKENS.includes(coin.symbol.toUpperCase()),
        is_verified: true, // CoinGecko tokens are verified
      }));

    logger.log(`🔷 [Sync] Found ${chainTokens.length} ${chainKey} tokens from CoinGecko`);

    // Upsert tokens
    const { error } = await supabase
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

