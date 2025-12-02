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
    
    // If no API key, return fallback estimate so UI still works
    if (!onramperApiKey) {
      logger.warn('⚠️ ONRAMPER_API_KEY not set - returning fallback quote estimate');
      
      // Get realistic exchange rates per crypto
      const exchangeRates: Record<string, number> = {
        'ETH': 3000,
        'BTC': 45000,
        'SOL': 150,
        'USDT': 1,
        'USDC': 1,
        'MATIC': 0.8,
        'BNB': 600,
        'AVAX': 40,
      };
      
      const rate = exchangeRates[cryptoCurrency] || 3000;
      const estimatedCrypto = (fiatAmount / rate).toFixed(6);
      const estimatedFee = (fiatAmount * 0.01).toFixed(2);
      
      return NextResponse.json({
        success: true,
        quote: {
          cryptoAmount: estimatedCrypto,
          exchangeRate: rate.toString(),
          fee: estimatedFee,
          totalAmount: fiatAmount.toString(),
        },
        isEstimate: true, // Flag to indicate this is an estimate
      });
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
      // Return fallback estimate if API fails
      logger.warn('⚠️ Onramper API failed - returning fallback quote estimate');
      
      const exchangeRates: Record<string, number> = {
        'ETH': 3000,
        'BTC': 45000,
        'SOL': 150,
        'USDT': 1,
        'USDC': 1,
        'MATIC': 0.8,
        'BNB': 600,
        'AVAX': 40,
      };
      
      const rate = exchangeRates[cryptoCurrency] || 3000;
      const estimatedCrypto = (fiatAmount / rate).toFixed(6);
      const estimatedFee = (fiatAmount * 0.01).toFixed(2);
      
      return NextResponse.json({
        success: true,
        quote: {
          cryptoAmount: estimatedCrypto,
          exchangeRate: rate.toString(),
          fee: estimatedFee,
          totalAmount: fiatAmount.toString(),
        },
        isEstimate: true,
      });
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

