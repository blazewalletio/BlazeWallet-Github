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
    
    if (!response.ok) return false;
    
    const data = await response.json();
    
    // Check if we got valid quotes with payout
    if (Array.isArray(data) && data.length > 0) {
      return data.some((quote: any) => 
        quote.payout && parseFloat(quote.payout.toString()) > 0
      );
    }
    
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
 * Get potential cryptos for a chain from Onramper API
 * This is NOT hardcoded - it comes from Onramper's /supported endpoint
 */
async function getPotentialCryptosForChain(
  chainId: number,
  apiKey: string
): Promise<string[]> {
  try {
    // Get supported data from Onramper
    const supportedData = await OnramperService.getSupportedData(apiKey);
    
    if (!supportedData || !supportedData.cryptoCurrencies) {
      logger.warn('⚠️ Could not fetch potential cryptos from Onramper');
      return [];
    }
    
    // Get chain-specific filter (this is just a smart filter, not hardcoded list)
    const chainFilter = OnramperService.getSupportedAssets(chainId);
    
    // Filter: only include cryptos that are:
    // 1. In Onramper's supported list, AND
    // 2. Potentially available for this chain (based on chain filter)
    const potentialCryptos = supportedData.cryptoCurrencies.filter((crypto: string) => {
      return chainFilter.some(asset => 
        asset.toLowerCase() === crypto.toLowerCase()
      );
    });
    
    logger.log(`📊 Potential cryptos for chain ${chainId}:`, potentialCryptos);
    return potentialCryptos;
  } catch (error: any) {
    logger.error('❌ Error getting potential cryptos:', error);
    return [];
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

