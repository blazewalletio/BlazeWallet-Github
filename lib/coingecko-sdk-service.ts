/**
 * CoinGecko SDK Service
 * Provides a singleton CoinGecko client with proper API key configuration
 */

import Coingecko from '@coingecko/coingecko-typescript';
import { logger } from '@/lib/logger';

let coingeckoClient: Coingecko | null = null;

/**
 * Get or create CoinGecko SDK client
 * Handles both Demo API keys (CG-xxx) and Pro API keys
 */
export function getCoinGeckoClient(): Coingecko {
  if (!coingeckoClient) {
    const apiKey = process.env.COINGECKO_API_KEY?.trim();
    
    // ✅ Check if key starts with 'CG-' for demo tier
    // Demo keys: CG-xxx format
    // Pro keys: Different format (usually longer, no CG- prefix)
    const isDemoKey = apiKey?.startsWith('CG-');
    
    if (isDemoKey) {
      // ✅ Demo API key (CG-xxx format)
      coingeckoClient = new Coingecko({
        demoAPIKey: apiKey,
        environment: 'demo',
        logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
        timeout: 30 * 1000, // 30 seconds
        maxRetries: 2, // Default retries for connection errors, rate limits, etc.
      });
      
      logger.log(`🦎 [CoinGecko SDK] Client initialized with Demo API key`, {
        hasApiKey: !!apiKey,
        keyLength: apiKey?.length || 0,
        environment: 'demo',
      });
    } else if (apiKey) {
      // ✅ Pro API key
      coingeckoClient = new Coingecko({
        proAPIKey: apiKey,
        environment: 'pro',
        logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
        timeout: 30 * 1000, // 30 seconds
        maxRetries: 2,
      });
      
      logger.log(`🦎 [CoinGecko SDK] Client initialized with Pro API key`, {
        hasApiKey: !!apiKey,
        keyLength: apiKey?.length || 0,
        environment: 'pro',
      });
    } else {
      // ✅ No API key - use free tier (public API)
      coingeckoClient = new Coingecko({
        logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
        timeout: 30 * 1000,
        maxRetries: 2,
      });
      
      logger.log(`🦎 [CoinGecko SDK] Client initialized without API key (free tier)`, {
        note: 'Rate limited to 10-50 calls/min',
      });
    }
  }
  
  return coingeckoClient;
}

/**
 * Reset client (useful for testing or key rotation)
 */
export function resetCoinGeckoClient(): void {
  coingeckoClient = null;
  logger.log(`🦎 [CoinGecko SDK] Client reset`);
}

