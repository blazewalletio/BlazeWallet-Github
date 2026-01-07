import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { OnramperService } from '@/lib/onramper-service';
import { GeolocationService } from '@/lib/geolocation';

export const dynamic = 'force-dynamic';

/**
 * API route to get available cryptocurrencies for a specific chain
 * Uses Onramper's /supported/assets endpoint to get crypto's that actually have providers
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chainId = parseInt(searchParams.get('chainId') || '1');
    const fiatCurrency = searchParams.get('fiatCurrency') || 'EUR';
    const countryParam = searchParams.get('country');
    
    // Detect country if not provided
    let country: string | undefined = countryParam || undefined;
    if (!country) {
      const detected = await GeolocationService.detectCountry(req);
      country = detected || undefined;
      if (country) {
        logger.log('✅ Auto-detected country for available-cryptos:', country);
      }
    }

    // CRITICAL: Clean API key - remove quotes, whitespace, and newlines
    const rawApiKey = process.env.ONRAMPER_API_KEY || '';
    const onramperApiKey = rawApiKey.trim().replace(/^["']|["']$/g, '').trim();
    
    logger.log('📊 Fetching available cryptos:', {
      chainId,
      fiatCurrency,
      country: country || 'auto-detect',
      hasApiKey: !!onramperApiKey,
    });

    const availableCryptos = await OnramperService.getAvailableCryptosForChain(
      chainId,
      fiatCurrency,
      country,
      onramperApiKey || undefined
    );

    return NextResponse.json({
      success: true,
      chainId,
      fiatCurrency,
      country: country || null,
      availableCryptos,
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
