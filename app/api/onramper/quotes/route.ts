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
    if (!onramperApiKey) {
      logger.error('ONRAMPER_API_KEY is not set in environment variables.');
      return NextResponse.json(
        { error: 'Onramper not configured', message: 'Please add ONRAMPER_API_KEY to environment variables' },
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
    const quote = await OnramperService.getQuote(
      fiatAmount,
      fiatCurrency,
      cryptoCurrency,
      paymentMethod,
      onramperApiKey
    );

    if (!quote) {
      return NextResponse.json(
        { error: 'Failed to fetch quote from Onramper' },
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

