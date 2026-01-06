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
    logger.log(`📊 Payment method requested: ${paymentMethod || 'none'}`);
    
    // Log all providers and their payment methods BEFORE filtering
    if (paymentMethod) {
      logger.log(`🔍 BEFORE FILTERING - All providers:`, quotes.map((q: any) => ({
        ramp: q.ramp,
        paymentMethod: q.paymentMethod,
        hasErrors: !!(q.errors && q.errors.length > 0),
        availableMethods: q.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId || pm.id) || []
      })));
    }
    
    // ⚠️ CRITICAL: Hard filter by payment method support if payment method is specified
    // This ensures frontend ONLY receives providers that actually support the payment method
    let filteredQuotes = quotes;
    if (paymentMethod) {
      const paymentMethodLower = paymentMethod.toLowerCase();
      const isIdeal = paymentMethodLower.includes('ideal');
      
      logger.log(`🔍 Starting filter for payment method: ${paymentMethod} (isIdeal: ${isIdeal})`);
      
      filteredQuotes = quotes.filter((q: any) => {
        // Skip quotes with errors
        if (q.errors && q.errors.length > 0) {
          return false;
        }
        
        // If quote already has the payment method set, it's supported
        if (q.paymentMethod && q.paymentMethod.toLowerCase() === paymentMethodLower) {
          return true;
        }
        
        // Check availablePaymentMethods array
        const methods = q.availablePaymentMethods || [];
        const supportsMethod = methods.some((pm: any) => {
          const id = pm.paymentTypeId || pm.id || '';
          const idLower = id.toLowerCase();
          
          // Exact match
          if (idLower === paymentMethodLower) {
            return true;
          }
          
          // For iDEAL, also check for variants (ideal, idealbanktransfer, etc.)
          if (isIdeal && idLower.includes('ideal')) {
            return true;
          }
          
          return false;
        });
        
        const result = supportsMethod;
        if (!result) {
          logger.log(`   ❌ Filtered out ${q.ramp}: paymentMethod=${q.paymentMethod}, availableMethods=${JSON.stringify(methods.map((pm: any) => pm.paymentTypeId || pm.id))}`);
        }
        return result;
      });
      
      logger.log(`🔍 AFTER FILTERING: ${quotes.length} → ${filteredQuotes.length} providers for "${paymentMethod}"`);
      
      // Log which providers were filtered out
      const filteredOut = quotes.filter(q => !filteredQuotes.includes(q));
      if (filteredOut.length > 0) {
        logger.log(`   ❌ Filtered out ${filteredOut.length} providers: ${filteredOut.map((q: any) => q.ramp).join(', ')}`);
      }
      if (filteredQuotes.length > 0) {
        logger.log(`   ✅ Providers with ${paymentMethod} support (${filteredQuotes.length}): ${filteredQuotes.map((q: any) => q.ramp).join(', ')}`);
        logger.log(`   ✅ Filtered quotes details:`, filteredQuotes.map((q: any) => ({
          ramp: q.ramp,
          paymentMethod: q.paymentMethod,
          availableMethods: q.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId || pm.id) || []
        })));
      } else {
        logger.error(`   ❌ NO PROVIDERS FOUND supporting ${paymentMethod}!`);
        logger.error(`   ❌ All original quotes:`, quotes.map((q: any) => ({
          ramp: q.ramp,
          paymentMethod: q.paymentMethod,
          availableMethods: q.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId || pm.id) || [],
          hasErrors: !!(q.errors && q.errors.length > 0)
        })));
      }
    }
    
    return NextResponse.json({ success: true, quotes: filteredQuotes });

  } catch (error: any) {
    logger.error('Onramper quotes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote', details: error.message },
      { status: 500 }
    );
  }
}

