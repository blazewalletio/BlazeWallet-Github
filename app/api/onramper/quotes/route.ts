import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { OnramperService } from '@/lib/onramper-service';
import { GeolocationService } from '@/lib/geolocation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fiatAmount = parseFloat(searchParams.get('fiatAmount') || '0');
    const fiatCurrency = searchParams.get('fiatCurrency') || 'EUR';
    const cryptoCurrency = searchParams.get('cryptoCurrency') || 'ETH';
    const paymentMethod = searchParams.get('paymentMethod') || undefined;
    const country = searchParams.get('country') || undefined;
    
    // NOTE: paymentMethod is optional for quote requests
    // Onramper returns different structure with paymentMethod that doesn't include payout/rate
    // But we can use it to filter providers that support the payment method

    if (!fiatAmount || fiatAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid fiat amount' },
        { status: 400 }
      );
    }

    // CRITICAL: Clean API key - remove quotes, whitespace, and newlines
    const rawApiKey = process.env.ONRAMPER_API_KEY || '';
    const onramperApiKey = rawApiKey.trim().replace(/^["']|["']$/g, '').trim();
    
    // CRITICAL: No API key = error, we MUST use real Onramper rates
    if (!onramperApiKey) {
      logger.error('❌ ONRAMPER_API_KEY not set - cannot fetch real quotes');
      return NextResponse.json(
        { 
          error: 'Onramper not configured',
          message: 'ONRAMPER_API_KEY is required to fetch real-time quotes. Please configure the API key.',
          requiresApiKey: true
        },
        { status: 503 }
      );
    }

    // DEBUG: Log API key info (masked for security)
    logger.log('🔑 Onramper API Key Status:', {
      hasKey: !!onramperApiKey,
      keyLength: onramperApiKey.length,
      keyPrefix: onramperApiKey.substring(0, 10) + '...',
      keySuffix: '...' + onramperApiKey.substring(onramperApiKey.length - 4),
      rawLength: rawApiKey.length,
      rawPrefix: rawApiKey.substring(0, 15) + '...',
    });

    // Detect country if not provided
    let detectedCountry = country;
    if (!detectedCountry) {
      detectedCountry = await GeolocationService.detectCountry(req) || undefined;
      if (detectedCountry) {
        logger.log('✅ Auto-detected country:', detectedCountry);
      }
    }

    logger.log('📊 Fetching Onramper quotes from all providers:', {
      fiatAmount,
      fiatCurrency,
      cryptoCurrency,
      paymentMethod: paymentMethod || 'any',
      country: detectedCountry || 'auto-detect',
    });

    // Get quotes from ALL providers (multi-provider comparison)
    let quotes = null;
    let quoteError: any = null;
    try {
      quotes = await OnramperService.getAllProviderQuotes(
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
        paymentMethod,
        detectedCountry || undefined,
        onramperApiKey
      );
    } catch (err: any) {
      quoteError = err;
      logger.error('❌ Onramper quotes API call failed:', {
        error: err.message,
        stack: err.stack,
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
        hasApiKey: !!onramperApiKey,
        apiKeyPrefix: onramperApiKey ? onramperApiKey.substring(0, 10) + '...' : 'MISSING',
      });
    }

    if (!quotes || quotes.length === 0) {
      // CRITICAL: No fallback - we MUST use real Onramper rates
      logger.error('❌ Onramper API failed - cannot return quotes without real rates', {
        quoteError: quoteError?.message,
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
      });
      return NextResponse.json(
        { 
          error: 'Failed to fetch quotes from Onramper',
          message: quoteError?.message || 'Unable to get real-time quotes. Please try again or contact support.',
          details: quoteError?.message,
        },
        { status: 500 }
      );
    }

    logger.log(`✅ Onramper quotes received: ${quotes.length} providers`);
    return NextResponse.json({ success: true, quotes });

  } catch (error: any) {
    logger.error('Onramper quotes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote', details: error.message },
      { status: 500 }
    );
  }
}

