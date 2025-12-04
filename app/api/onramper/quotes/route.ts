import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { OnramperService } from '@/lib/onramper-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fiatAmount = parseFloat(searchParams.get('fiatAmount') || '0');
    const fiatCurrency = searchParams.get('fiatCurrency') || 'EUR';
    const cryptoCurrency = searchParams.get('cryptoCurrency') || 'ETH';
    const paymentMethod = searchParams.get('paymentMethod') || '';

    if (!fiatAmount || fiatAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid fiat amount' },
        { status: 400 }
      );
    }

    const onramperApiKey = process.env.ONRAMPER_API_KEY;
    
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

    logger.log('📊 Fetching Onramper quote:', {
      fiatAmount,
      fiatCurrency,
      cryptoCurrency,
      paymentMethod,
    });

    // Get quote from Onramper
    let quote = null;
    try {
      quote = await OnramperService.getQuote(
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
        paymentMethod,
        onramperApiKey
      );
    } catch (quoteError: any) {
      logger.error('❌ Onramper quote API call failed:', quoteError);
    }

    if (!quote) {
      // CRITICAL: No fallback - we MUST use real Onramper rates
      logger.error('❌ Onramper API failed - cannot return quote without real rates');
      return NextResponse.json(
        { 
          error: 'Failed to fetch quote from Onramper',
          message: 'Unable to get real-time quote. Please try again or contact support.',
        },
        { status: 500 }
      );
    }

    logger.log('✅ Onramper quote received:', quote);
    return NextResponse.json({ success: true, quote });

  } catch (error: any) {
    logger.error('Onramper quotes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote', details: error.message },
      { status: 500 }
    );
  }
}

