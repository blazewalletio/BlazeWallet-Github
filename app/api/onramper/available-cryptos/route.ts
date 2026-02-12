import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { OnramperService } from '@/lib/onramper-service';
import { GeolocationService } from '@/lib/geolocation';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import { getClientIP } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * API route to get available cryptocurrencies for a specific chain
 * NATIVE TOKENS ONLY - ensures 100% reliability across all providers
 * Returns only the native token for the requested chain (ETH, BNB, MATIC, etc.)
 */
export async function GET(req: NextRequest) {
  try {
    const clientIp = getClientIP(req.headers);
    const isAllowed = apiRateLimiter.check(`onramper:available-cryptos:${clientIp}`, 120, 60 * 1000);
    if (!isAllowed) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const chainId = parseInt(searchParams.get('chainId') || '1');
    const fiatCurrency = searchParams.get('fiatCurrency') || 'EUR';
    const countryParam = searchParams.get('country');
    
    // Detect country if not provided (for logging purposes)
    let country: string | undefined = countryParam || undefined;
    if (!country) {
      const detected = await GeolocationService.detectCountry(req);
      country = detected || undefined;
      if (country) {
        logger.log('✅ Auto-detected country for available-cryptos:', country);
      }
    }

    logger.log('📊 Fetching available cryptos (native only):', {
      chainId,
      fiatCurrency,
      country: country || 'auto-detect',
    });

    // Get native token only - no API key needed, no external API call
    const availableCryptos = await OnramperService.getAvailableCryptosForChain(
      chainId,
      fiatCurrency,
      country,
      undefined // API key not needed for native-only approach
    );

    return NextResponse.json({
      success: true,
      chainId,
      fiatCurrency,
      country: country?.toUpperCase() || null,
      availableCryptos,
      nativeOnly: true, // Flag to indicate this is native-only mode
    });
  } catch (error: any) {
    logger.error('Error in /api/onramper/available-cryptos:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch available cryptos',
        availableCryptos: [], // Return empty array on error
      },
      { status: 500 }
    );
  }
}
