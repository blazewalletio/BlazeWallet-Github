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

    if (!quotes) {
      logger.error('❌ Onramper API returned null/undefined quotes', {
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

    // Ensure quotes is an array
    if (!Array.isArray(quotes)) {
      logger.error('❌ Onramper API returned non-array quotes:', {
        quotesType: typeof quotes,
        quotesValue: JSON.stringify(quotes).substring(0, 200),
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
      });
      return NextResponse.json(
        { 
          error: 'Invalid quotes format from Onramper',
          message: 'Received invalid data format from Onramper API.',
        },
        { status: 500 }
      );
    }

    // ⚠️ CRITICAL: 0 quotes is a VALID response (no providers available for this combination)
    // Return 200 with empty array instead of 500 error
    // This allows the frontend to handle "no quotes" gracefully
    if (quotes.length === 0) {
      logger.log('⚠️ Onramper API returned empty quotes array (valid - no providers available)', {
        quoteError: quoteError?.message,
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
        paymentMethod: paymentMethod || 'any',
      });
      return NextResponse.json({ 
        success: true, 
        quotes: [],
        paymentMethod: paymentMethod || '',
        quoteCount: 0,
        message: paymentMethod 
          ? `No providers available for ${paymentMethod} with ${cryptoCurrency}`
          : `No quotes available for ${cryptoCurrency}`,
      });
    }

    logger.log(`✅ Onramper quotes received: ${quotes.length} providers`);
    logger.log(`📊 Payment method requested: ${paymentMethod || 'none'}`);
    
    // Log all providers and their payment methods BEFORE filtering
    if (paymentMethod && Array.isArray(quotes)) {
      try {
        logger.log(`🔍 BEFORE FILTERING - All providers:`, quotes.map((q: any) => ({
          ramp: q.ramp,
          paymentMethod: q.paymentMethod,
          hasErrors: !!(q.errors && q.errors.length > 0),
          availableMethods: q.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId || pm.id) || []
        })));
      } catch (logError: any) {
        logger.error('Error logging before filtering:', logError.message);
      }
    }
    
    // ⚠️ CRITICAL: Hard filter by payment method support if payment method is specified
    // This ensures frontend ONLY receives providers that actually support the payment method
    let filteredQuotes = quotes;
    if (paymentMethod) {
      try {
        const paymentMethodLower = paymentMethod.toLowerCase();
        const isIdeal = paymentMethodLower.includes('ideal');
        
        logger.log(`🔍 Starting filter for payment method: ${paymentMethod} (isIdeal: ${isIdeal})`);
        
        filteredQuotes = quotes.filter((q: any) => {
        // ⚠️ CRITICAL: PRIMARY CHECK - If quote has the payment method set, it's supported
        // This is the most reliable check - if Onramper returned a quote with paymentMethod set,
        // it means the provider supports it (even if there are minor errors)
        if (q.paymentMethod && q.paymentMethod.toLowerCase() === paymentMethodLower) {
          // Only reject if there are errors that specifically indicate payment method incompatibility
          const hasPaymentMethodError = q.errors?.some((err: any) => {
            const errorMsg = (err.message || '').toLowerCase();
            const errorType = (err.type || '').toLowerCase();
            return errorMsg.includes('does not support payment method') ||
                   errorMsg.includes('payment method not supported') ||
                   errorMsg.includes('payment type not supported') ||
                   errorType === 'paymentmethodnotsupported';
          });
          
          if (!hasPaymentMethodError) {
            return true; // Quote has correct paymentMethod and no payment-related errors
          }
          // If there's a payment-method-specific error, reject it
          return false;
        }
        
        // ⚠️ CRITICAL: Skip quotes with payment-method-specific errors (provider doesn't support this payment method)
        if (q.errors && q.errors.length > 0) {
          const hasPaymentMethodError = q.errors.some((err: any) => {
            const errorMsg = (err.message || '').toLowerCase();
            const errorType = (err.type || '').toLowerCase();
            return errorMsg.includes('does not support payment method') ||
                   errorMsg.includes('payment method not supported') ||
                   errorMsg.includes('payment type not supported') ||
                   errorType === 'paymentmethodnotsupported';
          });
          
          if (hasPaymentMethodError) {
            // This provider definitely doesn't support the payment method
            return false;
          }
          // Other errors (rate limits, temporary issues, etc.) are OK - continue checking
        }
        
        // ⚠️ CRITICAL: Check availablePaymentMethods array (this is the fallback check)
        const methods = q.availablePaymentMethods || [];
        const methodIds = methods.map((pm: any) => (pm.paymentTypeId || pm.id || '').toLowerCase()).filter(Boolean);
        
        const supportsMethod = methodIds.some((idLower: string) => {
          // Exact match
          if (idLower === paymentMethodLower) {
            return true;
          }
          
          // For iDEAL, also check for variants (ideal, idealbanktransfer, etc.)
          if (isIdeal && idLower.includes('ideal')) {
            return true;
          }
          
          // For SEPA, check for variants (sepa, sepabanktransfer, sepainstant)
          if (paymentMethodLower === 'sepa' && (idLower.includes('sepa') || idLower === 'banktransfer')) {
            return true;
          }
          
          // For bancontact, check for variants
          if (paymentMethodLower === 'bancontact' && idLower.includes('bancontact')) {
            return true;
          }
          
          return false;
        });
        
        const result = supportsMethod;
        if (!result) {
          try {
            logger.log(`   ❌ Filtered out ${q.ramp}: paymentMethod=${q.paymentMethod || 'none'}, availableMethods=${methodIds.join(', ') || 'none'}`);
          } catch (logError: any) {
            logger.log(`   ❌ Filtered out ${q.ramp}`);
          }
        } else {
          logger.log(`   ✅ ${q.ramp} supports ${paymentMethod} (availableMethods: ${methodIds.join(', ')})`);
        }
        return result;
      });
      
      logger.log(`🔍 AFTER FILTERING: ${quotes.length} → ${filteredQuotes.length} providers for "${paymentMethod}"`);
      
      // Log which providers were filtered out (using ramp comparison instead of object comparison)
      try {
        const filteredOutRamps = quotes
          .map((q: any) => q.ramp)
          .filter((ramp: string) => !filteredQuotes.some((fq: any) => fq.ramp === ramp));
        
        if (filteredOutRamps.length > 0) {
          logger.log(`   ❌ Filtered out ${filteredOutRamps.length} providers: ${filteredOutRamps.join(', ')}`);
        }
        
        if (filteredQuotes.length > 0) {
          logger.log(`   ✅ Providers with ${paymentMethod} support (${filteredQuotes.length}): ${filteredQuotes.map((q: any) => q.ramp).join(', ')}`);
          try {
            logger.log(`   ✅ Filtered quotes details:`, filteredQuotes.map((q: any) => ({
              ramp: q.ramp,
              paymentMethod: q.paymentMethod,
              availableMethods: q.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId || pm.id) || []
            })));
          } catch (logError: any) {
            logger.log(`   ✅ Filtered quotes: ${filteredQuotes.map((q: any) => q.ramp).join(', ')}`);
          }
        } else {
          logger.error(`   ❌ NO PROVIDERS FOUND supporting ${paymentMethod}!`);
          try {
            logger.error(`   ❌ All original quotes:`, quotes.map((q: any) => ({
              ramp: q.ramp,
              paymentMethod: q.paymentMethod,
              availableMethods: q.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId || pm.id) || [],
              hasErrors: !!(q.errors && q.errors.length > 0)
            })));
          } catch (logError: any) {
            logger.error(`   ❌ All original quotes: ${quotes.map((q: any) => q.ramp).join(', ')}`);
          }
        }
      } catch (logError: any) {
        logger.error('Error in filtering logs:', logError.message);
      }
      } catch (filterError: any) {
        logger.error('❌ Error filtering quotes by payment method:', {
          error: filterError.message,
          stack: filterError.stack,
          paymentMethod,
        });
        // Fallback: return all quotes if filtering fails (better than crashing)
        filteredQuotes = quotes;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      quotes: filteredQuotes,
      paymentMethod: paymentMethod || '', // ⚠️ CRITICAL: Include paymentMethod in response for frontend validation
      quoteCount: filteredQuotes.length
    });

  } catch (error: any) {
    logger.error('Onramper quotes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote', details: error.message },
      { status: 500 }
    );
  }
}

