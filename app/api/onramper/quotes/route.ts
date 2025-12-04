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
    // NOTE: paymentMethod is NOT used for quote requests
    // Onramper returns different structure with paymentMethod that doesn't include payout/rate
    // Payment method is only used when creating the transaction, not for getting quotes

    if (!fiatAmount || fiatAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid fiat amount' },
        { status: 400 }
      );
    }

    // CRITICAL: Trim API key to remove any whitespace/newlines
    const onramperApiKey = process.env.ONRAMPER_API_KEY?.trim();
    
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
      note: 'paymentMethod not included (only used for transaction creation)',
    });

    // Get quote from Onramper (without paymentMethod)
    let quote = null;
    let quoteError: any = null;
    try {
      quote = await OnramperService.getQuote(
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
        undefined, // paymentMethod not used for quotes
        onramperApiKey
      );
    } catch (err: any) {
      quoteError = err;
      logger.error('❌ Onramper quote API call failed:', {
        error: err.message,
        stack: err.stack,
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
        hasApiKey: !!onramperApiKey,
        apiKeyPrefix: onramperApiKey ? onramperApiKey.substring(0, 10) + '...' : 'MISSING',
      });
    }

    if (!quote) {
      // CRITICAL: No fallback - we MUST use real Onramper rates
      logger.error('❌ Onramper API failed - cannot return quote without real rates', {
        quoteError: quoteError?.message,
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
      });
      return NextResponse.json(
        { 
          error: 'Failed to fetch quote from Onramper',
          message: quoteError?.message || 'Unable to get real-time quote. Please try again or contact support.',
          details: quoteError?.message,
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

