// MoonPay Quote API Route
// GET /api/moonpay/quote?baseCurrencyAmount=100&baseCurrencyCode=EUR&quoteCurrencyCode=ETH

import { NextRequest, NextResponse } from 'next/server';
import { MoonPayService } from '@/lib/moonpay-service';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const baseCurrencyAmount = parseFloat(searchParams.get('baseCurrencyAmount') || '0');
    const baseCurrencyCode = searchParams.get('baseCurrencyCode') || 'EUR';
    const quoteCurrencyCode = searchParams.get('quoteCurrencyCode') || 'ETH';

    if (!baseCurrencyAmount || baseCurrencyAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid baseCurrencyAmount' },
        { status: 400 }
      );
    }

    const apiKey = process.env.MOONPAY_API_KEY;
    if (!apiKey) {
      logger.error('MOONPAY_API_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'MoonPay API key not configured' },
        { status: 500 }
      );
    }

    const isSandbox = process.env.MOONPAY_ENVIRONMENT === 'sandbox';

    logger.log('Fetching MoonPay quote:', {
      baseCurrencyAmount,
      baseCurrencyCode,
      quoteCurrencyCode,
      isSandbox,
    });

    const quote = await MoonPayService.getQuote(
      baseCurrencyAmount,
      baseCurrencyCode,
      quoteCurrencyCode,
      apiKey,
      isSandbox
    );

    if (!quote) {
      logger.error('MoonPay quote returned null');
      return NextResponse.json(
        { 
          error: 'Failed to fetch quote from MoonPay',
          details: 'Please check if the currency pair is supported'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      quote: {
        cryptoAmount: quote.quoteCurrencyAmount.toFixed(8),
        exchangeRate: quote.exchangeRate.toFixed(2),
        fee: quote.feeAmount.toFixed(2),
        networkFee: quote.networkFeeAmount.toFixed(2),
        totalAmount: quote.totalAmount.toFixed(2),
        baseCurrency: quote.baseCurrencyCode.toUpperCase(),
        quoteCurrency: quote.quoteCurrencyCode.toUpperCase(),
      },
    });
  } catch (error: any) {
    logger.error('MoonPay quote API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

