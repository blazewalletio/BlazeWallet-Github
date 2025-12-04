import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { OnramperService } from '@/lib/onramper-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const onramperApiKey = process.env.ONRAMPER_API_KEY;
    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country') || 'NL'; // Default to Netherlands
    
    // If no API key, return fallback data so UI still works
    if (!onramperApiKey) {
      logger.warn('⚠️ ONRAMPER_API_KEY not set - returning fallback data');
      return NextResponse.json({
        success: true,
        paymentMethods: [
          { id: 'creditcard', name: 'Credit/Debit Card', icon: 'card', processingTime: 'Instant', fee: '€2.00' },
          { id: 'applepay', name: 'Apple Pay', icon: 'applepay', processingTime: 'Instant', fee: '€1.50' },
          { id: 'googlepay', name: 'Google Pay', icon: 'googlepay', processingTime: 'Instant', fee: '€1.50' },
          { id: 'ideal', name: 'iDEAL', icon: 'ideal', processingTime: 'Instant', fee: '€0.50' },
          { id: 'bancontact', name: 'Bancontact', icon: 'bancontact', processingTime: 'Instant', fee: '€0.50' },
          { id: 'sepa', name: 'SEPA Bank Transfer', icon: 'bank', processingTime: '1-3 days', fee: '€0.00' },
        ],
        fiatCurrencies: ['EUR', 'USD', 'GBP'],
        cryptoCurrencies: ['ETH', 'USDT', 'USDC', 'BTC', 'SOL', 'MATIC', 'BNB', 'AVAX'],
      });
    }

    logger.log('📊 Fetching Onramper supported data...', { country });

    // Get supported data from Onramper (with country parameter for payment types)
    const supportedData = await OnramperService.getSupportedData(onramperApiKey, country);

    if (!supportedData) {
      // Return fallback data if API fails
      logger.warn('⚠️ Onramper API failed - returning fallback data');
      return NextResponse.json({
        success: true,
        paymentMethods: [
          { id: 'creditcard', name: 'Credit/Debit Card', icon: 'card', processingTime: 'Instant', fee: '€2.00' },
          { id: 'applepay', name: 'Apple Pay', icon: 'applepay', processingTime: 'Instant', fee: '€1.50' },
          { id: 'googlepay', name: 'Google Pay', icon: 'googlepay', processingTime: 'Instant', fee: '€1.50' },
          { id: 'ideal', name: 'iDEAL', icon: 'ideal', processingTime: 'Instant', fee: '€0.50' },
          { id: 'bancontact', name: 'Bancontact', icon: 'bancontact', processingTime: 'Instant', fee: '€0.50' },
          { id: 'sepa', name: 'SEPA Bank Transfer', icon: 'bank', processingTime: '1-3 days', fee: '€0.00' },
        ],
        fiatCurrencies: ['EUR', 'USD', 'GBP'],
        cryptoCurrencies: ['ETH', 'USDT', 'USDC', 'BTC', 'SOL', 'MATIC', 'BNB', 'AVAX'],
      });
    }

    logger.log('✅ Onramper supported data received');
    return NextResponse.json({ success: true, ...supportedData });

  } catch (error: any) {
    logger.error('Onramper supported-data error:', error);
    // Return fallback data on error
    return NextResponse.json({
      success: true,
      paymentMethods: [
        { id: 'creditcard', name: 'Credit/Debit Card', icon: 'card', processingTime: 'Instant', fee: '€2.00' },
        { id: 'applepay', name: 'Apple Pay', icon: 'applepay', processingTime: 'Instant', fee: '€1.50' },
        { id: 'googlepay', name: 'Google Pay', icon: 'googlepay', processingTime: 'Instant', fee: '€1.50' },
        { id: 'ideal', name: 'iDEAL', icon: 'ideal', processingTime: 'Instant', fee: '€0.50' },
        { id: 'bancontact', name: 'Bancontact', icon: 'bancontact', processingTime: 'Instant', fee: '€0.50' },
        { id: 'sepa', name: 'SEPA Bank Transfer', icon: 'bank', processingTime: '1-3 days', fee: '€0.00' },
      ],
      fiatCurrencies: ['EUR', 'USD', 'GBP'],
      cryptoCurrencies: ['ETH', 'USDT', 'USDC', 'BTC', 'SOL', 'MATIC', 'BNB', 'AVAX'],
    });
  }
}

