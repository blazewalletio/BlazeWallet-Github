import { NextRequest, NextResponse } from 'next/server';
import { OnramperService } from '@/lib/onramper-service';
import { logger } from '@/lib/logger';
import { GeolocationService } from '@/lib/geolocation';

export const dynamic = 'force-dynamic';
export const revalidate = 900; // 15 minutes

// In-memory cache (survives between requests in serverless)
const cache = new Map<string, { cryptos: string[]; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

async function verifyCryptoAvailability(
  crypto: string,
  fiatCurrency: string = 'EUR',
  apiKey: string
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout
    
    const response = await fetch(
      `https://api.onramper.com/quotes/${fiatCurrency.toLowerCase()}/${crypto.toLowerCase()}?amount=50`,
      {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      logger.warn(`⚠️ ${crypto}: HTTP ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    
    // Check if we got valid quotes
    if (Array.isArray(data) && data.length > 0) {
      // A crypto is available if we have at least one provider quote
      // Even if payout is missing, if we have a provider (ramp) and available payment methods, it's available
      const hasValidQuote = data.some((quote: any) => {
        // Best case: has payout > 0
        if (quote.payout && parseFloat(quote.payout.toString()) > 0) {
          return true;
        }
        // Good case: has rate > 0
        if (quote.rate && parseFloat(quote.rate.toString()) > 0) {
          return true;
        }
        // Acceptable case: has provider and available payment methods (quote might be metadata-only but provider exists)
        if (quote.ramp && quote.availablePaymentMethods && quote.availablePaymentMethods.length > 0) {
          return true;
        }
        // Minimum case: has provider name (means provider exists, even if quote details are missing)
        if (quote.ramp) {
          return true;
        }
        return false;
      });
      
      if (hasValidQuote) {
        logger.log(`✅ ${crypto}: Available (${data.length} providers)`);
        return true;
      } else {
        logger.warn(`⚠️ ${crypto}: No valid quotes (${data.length} providers, but no valid data)`);
        return false;
      }
    }
    
    logger.warn(`⚠️ ${crypto}: No quotes returned`);
    return false;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      logger.warn(`⏱️ Timeout verifying ${crypto}`);
    } else {
      logger.error(`❌ Error verifying ${crypto}:`, error.message);
    }
    return false;
  }
}

/**
 * Get potential cryptos for a chain
 * Uses chain-specific filter to determine which cryptos to test
 * This is a smart filter based on chain capabilities, not a hardcoded list
 */
async function getPotentialCryptosForChain(
  chainId: number,
  apiKey: string
): Promise<string[]> {
  try {
    // Get chain-specific filter (this tells us which cryptos are typically available on this chain)
    const chainFilter = OnramperService.getSupportedAssets(chainId);
    
    // Also try to get from Onramper's /supported endpoint to see what they support
    let onramperCryptos: string[] = [];
    try {
      const supportedData = await OnramperService.getSupportedData(apiKey);
      if (supportedData && supportedData.cryptoCurrencies) {
        onramperCryptos = supportedData.cryptoCurrencies;
      }
    } catch (error: any) {
      logger.warn('⚠️ Could not fetch from Onramper /supported, using chain filter only');
    }
    
    // Combine both sources: use chain filter as primary, but also include any from Onramper
    // that match the chain filter
    const potentialCryptos = new Set<string>();
    
    // Add all from chain filter (these are the cryptos that should work on this chain)
    chainFilter.forEach(crypto => potentialCryptos.add(crypto.toUpperCase()));
    
    // Also add any from Onramper that match the chain filter
    if (onramperCryptos.length > 0) {
      onramperCryptos.forEach((crypto: string) => {
        const cryptoUpper = crypto.toUpperCase();
        // If it's in the chain filter, add it
        if (chainFilter.some(asset => asset.toUpperCase() === cryptoUpper)) {
          potentialCryptos.add(cryptoUpper);
        }
      });
    }
    
    const result = Array.from(potentialCryptos);
    logger.log(`📊 Potential cryptos for chain ${chainId}:`, result);
    return result;
  } catch (error: any) {
    logger.error('❌ Error getting potential cryptos:', error);
    // Fallback: use chain filter only
    const chainFilter = OnramperService.getSupportedAssets(chainId);
    logger.log(`📊 Using chain filter fallback for chain ${chainId}:`, chainFilter);
    return chainFilter.map(c => c.toUpperCase());
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chainIdParam = searchParams.get('chainId');
    const countryParam = searchParams.get('country');
    
    if (!chainIdParam) {
      return NextResponse.json(
        { error: 'chainId parameter is required' },
        { status: 400 }
      );
    }
    
    const chainId = parseInt(chainIdParam);
    const country = countryParam || await GeolocationService.detectCountry(req) || 'default';
    
    // Cache key: chainId + country
    const cacheKey = `chainId:${chainId}:country:${country}`;
    
    // Layer 1: Check in-memory cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.log(`✅ Cache hit: ${cacheKey} - ${cached.cryptos.length} verified cryptos`);
      return NextResponse.json({
        success: true,
        cryptos: cached.cryptos,
        cached: true,
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
        },
      });
    }
    
    // Get API key
    const onramperApiKey = process.env.ONRAMPER_API_KEY?.trim().replace(/^["']|["']$/g, '');
    
    if (!onramperApiKey) {
      // No API key: return empty array (no hardcoded fallback)
      logger.warn('⚠️ No API key - cannot verify cryptos, returning empty array');
      return NextResponse.json({
        success: true,
        cryptos: [],
        cached: false,
        error: 'API key not configured',
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      });
    }
    
    // Layer 2: Get potential cryptos from Onramper (NOT hardcoded)
    const potentialCryptos = await getPotentialCryptosForChain(chainId, onramperApiKey);
    
    if (potentialCryptos.length === 0) {
      logger.warn(`⚠️ No potential cryptos found for chain ${chainId}`);
      return NextResponse.json({
        success: true,
        cryptos: [],
        cached: false,
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
        },
      });
    }
    
    // Layer 3: Verify each crypto in parallel
    logger.log(`🔍 Verifying ${potentialCryptos.length} potential cryptos for chain ${chainId}...`);
    
    const verificationResults = await Promise.all(
      potentialCryptos.map(async (crypto) => {
        const available = await verifyCryptoAvailability(crypto, 'EUR', onramperApiKey);
        return available ? crypto : null;
      })
    );
    
    // Filter out nulls (unavailable cryptos)
    const verifiedCryptos = verificationResults.filter(c => c !== null) as string[];
    
    logger.log(`✅ Verified ${verifiedCryptos.length} available cryptos out of ${potentialCryptos.length} potential`);
    
    // Update cache with verified list (can be empty if none available)
    cache.set(cacheKey, {
      cryptos: verifiedCryptos,
      timestamp: Date.now(),
    });
    
    // Return verified list (can be empty)
    return NextResponse.json({
      success: true,
      cryptos: verifiedCryptos,
      cached: false,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
      },
    });
    
  } catch (error: any) {
    logger.error('❌ Error in available-cryptos endpoint:', error);
    
    // Return empty array on error (no hardcoded fallback)
    return NextResponse.json({
      success: true,
      cryptos: [],
      cached: false,
      error: error.message,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  }
}

