/**
 * 🎯 Metaplex On-Chain Metadata Fetcher
 * 
 * Tier 3 fallback when Jupiter doesn't have token info
 * Fetches metadata directly from Solana blockchain via Metaplex standard
 * 
 * Flow:
 * 1. Derive metadata PDA from mint address
 * 2. Fetch on-chain account data
 * 3. Parse Metaplex metadata format
 * 4. Return standardized SPLTokenMetadata
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import { 
  fetchDigitalAsset,
  fetchDigitalAssetByMetadata,
} from '@metaplex-foundation/mpl-token-metadata';
import { SPLTokenMetadata } from './spl-token-metadata';
import { logger } from '@/lib/logger';

// Cache for Metaplex fetches to avoid redundant RPC calls
const metaplexCache = new Map<string, { data: SPLTokenMetadata | null; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// ✅ FIX: Use Alchemy RPC (same as SolanaService) to avoid 403 errors!
const DEFAULT_RPC_URL = `https://solana-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || 'demo'}`;

/**
 * Fetch token metadata from Metaplex on-chain standard
 * @param mint - Token mint address
 * @param rpcUrl - Solana RPC endpoint (defaults to Alchemy)
 * @returns SPLTokenMetadata or null if not found
 */
export async function getMetaplexMetadata(
  mint: string,
  rpcUrl: string = DEFAULT_RPC_URL // ✅ Default to Alchemy!
): Promise<SPLTokenMetadata | null> {
  // Check memory cache first (avoid RPC spam)
  const cached = metaplexCache.get(mint);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    logger.log(`⚡ [Metaplex] Using cached metadata for ${mint}`);
    return cached.data;
  }

  try {
    logger.log(`🔍 [Metaplex] Fetching on-chain metadata for ${mint}...`);
    const startTime = Date.now();

    // Create UMI instance (Metaplex's new framework)
    const umi = createUmi(rpcUrl);
    
    // Convert mint to UMI publicKey
    const mintPublicKey = publicKey(mint);
    
    // Fetch digital asset (includes metadata)
    const asset = await fetchDigitalAsset(umi, mintPublicKey);
    
    const fetchTime = Date.now() - startTime;
    logger.log(`✅ [Metaplex] Fetched metadata in ${fetchTime}ms`);
    
    // Extract metadata
    const metadata = asset.metadata;
    
    // Parse URI for logo (if exists)
    let logoURI: string | undefined;
    if (metadata.uri) {
      // Try to fetch off-chain metadata (contains logo)
      try {
        const offChainResponse = await fetch(metadata.uri, { 
          signal: AbortSignal.timeout(5000) // 5s timeout
        });
        
        if (offChainResponse.ok) {
          const offChainData = await offChainResponse.json();
          logoURI = offChainData.image || offChainData.icon;
        }
      } catch (error) {
        logger.warn(`⚠️ [Metaplex] Failed to fetch off-chain metadata from ${metadata.uri}:`, error);
        // Continue without logo
      }
    }
    
    // Build result
    const result: SPLTokenMetadata = {
      mint,
      symbol: metadata.symbol || mint.slice(0, 4) + '...',
      name: metadata.name || 'Unknown Token',
      decimals: asset.mint.decimals,
      logoURI,
    };
    
    // Cache result
    metaplexCache.set(mint, { data: result, timestamp: Date.now() });
    
    logger.log(`✅ [Metaplex] Got token: ${result.name} (${result.symbol})`);
    
    return result;
    
  } catch (error) {
    logger.warn(`⚠️ [Metaplex] Failed to fetch metadata for ${mint}:`, error);
    
    // Cache null result to avoid repeated failures
    metaplexCache.set(mint, { data: null, timestamp: Date.now() });
    
    return null;
  }
}

/**
 * Batch fetch multiple tokens (with concurrency limit to avoid rate limits)
 */
export async function getMultipleMetaplexMetadata(
  mints: string[],
  rpcUrl: string = DEFAULT_RPC_URL, // ✅ Default to Alchemy!
  concurrency: number = 5
): Promise<Map<string, SPLTokenMetadata | null>> {
  const results = new Map<string, SPLTokenMetadata | null>();
  
  // Process in batches to avoid overwhelming RPC
  for (let i = 0; i < mints.length; i += concurrency) {
    const batch = mints.slice(i, i + concurrency);
    
    const batchResults = await Promise.allSettled(
      batch.map(mint => getMetaplexMetadata(mint, rpcUrl))
    );
    
    batchResults.forEach((result, index) => {
      const mint = batch[index];
      if (result.status === 'fulfilled') {
        results.set(mint, result.value);
      } else {
        logger.error(`Failed to fetch Metaplex metadata for ${mint}:`, result.reason);
        results.set(mint, null);
      }
    });
    
    // Small delay between batches to be nice to RPC
    if (i + concurrency < mints.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * Clear Metaplex cache (useful for testing or force refresh)
 */
export function clearMetaplexCache() {
  metaplexCache.clear();
  logger.log('🧹 Cleared Metaplex metadata cache');
}

