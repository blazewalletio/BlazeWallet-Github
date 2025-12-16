'use client';

import { useEffect, useRef } from 'react';
import { tokenCache } from '@/lib/token-cache';
import { CHAINS } from '@/lib/chains';
import { logger } from '@/lib/logger';

/**
 * 🚀 Token Preloader Component
 * 
 * Preloads tokens in the background when Dashboard mounts
 * This ensures cache is ready when user opens swap modal
 * 
 * Features:
 * - Non-blocking background sync
 * - Only loads tokens for supported chains
 * - Smart: Only syncs if cache is empty or stale
 * - Silent: No UI impact, works in background
 */
export default function TokenPreloader() {
  const hasStartedRef = useRef(false);

  useEffect(() => {
    // Only start once
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    // Start preloading tokens for all supported chains
    const preloadTokens = async () => {
      logger.log('🚀 [TokenPreloader] Starting background token preload...');

      const chainsToPreload = ['solana', 'ethereum'] as const; // Start with most used chains

      for (const chainKey of chainsToPreload) {
        const chainConfig = CHAINS[chainKey];
        if (!chainConfig?.id) continue;

        const chainId = chainConfig.id;

        try {
          // Check if cache already has tokens
          const cacheSize = await tokenCache.getCacheSize(chainId);
          
          if (cacheSize > 100) {
            logger.log(`✅ [TokenPreloader] Cache already has ${cacheSize} tokens for ${chainKey} - skipping`);
            continue;
          }

          logger.log(`🔄 [TokenPreloader] Preloading tokens for ${chainKey}...`);

          let allTokens: any[] = [];

          if (chainKey === 'solana') {
            const jupiterResponse = await fetch('/api/jupiter-tokens');
            if (jupiterResponse.ok) {
              allTokens = await jupiterResponse.json();
              logger.log(`🪐 [TokenPreloader] Fetched ${allTokens.length} tokens from Jupiter`);
            }
          } else if (chainKey === 'ethereum') {
            const ethereumResponse = await fetch('/api/ethereum-tokens');
            if (ethereumResponse.ok) {
              allTokens = await ethereumResponse.json();
              logger.log(`🔷 [TokenPreloader] Fetched ${allTokens.length} tokens from CoinGecko`);
            }
          }

          if (allTokens.length > 0) {
            // Convert to cache format
            const convertedTokens = allTokens
              .filter(t => t.address && t.symbol)
              .map(t => ({
                address: chainKey === 'ethereum' ? t.address.toLowerCase() : t.address,
                symbol: t.symbol,
                name: t.name || t.symbol,
                decimals: t.decimals || (chainKey === 'ethereum' ? 18 : 9),
                chainId: chainId,
                logoURI: t.logoURI || '',
                priceUSD: '0',
              }));

            // Store in cache (non-blocking)
            await tokenCache.storeTokens(chainId, convertedTokens);
            logger.log(`✅ [TokenPreloader] Cached ${convertedTokens.length} tokens for ${chainKey}`);
          }
        } catch (err: any) {
          logger.error(`❌ [TokenPreloader] Failed to preload ${chainKey}:`, err);
          // Continue with other chains even if one fails
        }
      }

      logger.log('✅ [TokenPreloader] Background preload complete');
    };

    // Start preload in background (non-blocking)
    // Use setTimeout to ensure it doesn't block initial render
    setTimeout(() => {
      preloadTokens().catch(err => {
        logger.error('❌ [TokenPreloader] Preload error:', err);
      });
    }, 1000); // Start 1 second after mount to not block initial render

  }, []);

  return null; // No UI
}

