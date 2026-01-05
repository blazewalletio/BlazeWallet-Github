import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { OnramperService } from '@/lib/onramper-service';
import { GeolocationService } from '@/lib/geolocation';

export const dynamic = 'force-dynamic';

/**
 * 🔍 DEBUG ENDPOINT
 * Comprehensive diagnostics for Onramper integration issues
 */
export async function GET(req: NextRequest) {
  const debugLogs: any[] = [];
  const addLog = (section: string, data: any) => {
    debugLogs.push({ section, timestamp: new Date().toISOString(), data });
    logger.log(`[DEBUG] ${section}:`, data);
  };

  try {
    const { searchParams } = new URL(req.url);
    const fiatAmount = parseFloat(searchParams.get('fiatAmount') || '100');
    const fiatCurrency = searchParams.get('fiatCurrency') || 'EUR';
    const cryptoCurrency = searchParams.get('cryptoCurrency') || 'ETH';
    const paymentMethod = searchParams.get('paymentMethod') || 'ideal';

    addLog('1. Request Parameters', {
      fiatAmount,
      fiatCurrency,
      cryptoCurrency,
      paymentMethod,
      url: req.url,
    });

    // Check API key
    const onramperApiKey = process.env.ONRAMPER_API_KEY?.trim();
    addLog('2. API Key Check', {
      hasApiKey: !!onramperApiKey,
      keyLength: onramperApiKey?.length,
      keyPrefix: onramperApiKey ? onramperApiKey.substring(0, 10) + '...' : 'MISSING',
    });

    if (!onramperApiKey) {
      return NextResponse.json({
        success: false,
        error: 'ONRAMPER_API_KEY not configured',
        logs: debugLogs,
      });
    }

    // Country detection
    const detectedCountry = await GeolocationService.detectCountry(req);
    addLog('3. Country Detection', {
      detectedCountry,
      headers: {
        'x-forwarded-for': req.headers.get('x-forwarded-for'),
        'cf-ipcountry': req.headers.get('cf-ipcountry'),
        'cloudfront-viewer-country': req.headers.get('cloudfront-viewer-country'),
      },
    });

    // Fetch supported data
    addLog('4. Fetching Supported Data', { status: 'starting' });
    let supportedData: any = null;
    try {
      const supportedUrl = `https://api.onramper.com/supported?apiKey=${onramperApiKey}`;
      const supportedResponse = await fetch(supportedUrl);
      supportedData = await supportedResponse.json();
      
      addLog('4. Supported Data Response', {
        status: supportedResponse.status,
        hasPaymentMethods: !!supportedData?.paymentMethods,
        paymentMethodCount: supportedData?.paymentMethods?.length || 0,
        paymentMethods: supportedData?.paymentMethods?.map((pm: any) => ({
          id: pm.id,
          name: pm.name,
          displayName: pm.displayName,
        })) || [],
      });
    } catch (err: any) {
      addLog('4. Supported Data Error', {
        error: err.message,
        stack: err.stack,
      });
    }

    // Fetch quotes WITH payment method
    addLog('5. Fetching Quotes (WITH payment method)', { paymentMethod });
    let quotesWithMethod: any = null;
    try {
      const quotesUrl = `https://api.onramper.com/quotes?apiKey=${onramperApiKey}&fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}&paymentMethod=${paymentMethod}${detectedCountry ? `&country=${detectedCountry}` : ''}`;
      
      addLog('5a. Quotes URL (WITH payment method)', { url: quotesUrl.replace(onramperApiKey, 'API_KEY_HIDDEN') });
      
      const quotesResponse = await fetch(quotesUrl);
      quotesWithMethod = await quotesResponse.json();
      
      addLog('5b. Quotes Response (WITH payment method)', {
        status: quotesResponse.status,
        hasQuotes: Array.isArray(quotesWithMethod),
        quoteCount: Array.isArray(quotesWithMethod) ? quotesWithMethod.length : 0,
        validQuotes: Array.isArray(quotesWithMethod) 
          ? quotesWithMethod.filter((q: any) => !q.errors).length 
          : 0,
        invalidQuotes: Array.isArray(quotesWithMethod) 
          ? quotesWithMethod.filter((q: any) => q.errors).length 
          : 0,
      });

      // Log each provider's response
      if (Array.isArray(quotesWithMethod)) {
        quotesWithMethod.forEach((quote: any, idx: number) => {
          addLog(`5c. Provider ${idx + 1}: ${quote.ramp}`, {
            hasError: !!quote.errors,
            errors: quote.errors?.map((e: any) => e.message) || [],
            hasRate: !!quote.rate,
            hasPayout: !!quote.payout,
            availablePaymentMethods: quote.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId) || [],
          });
        });
      }
    } catch (err: any) {
      addLog('5. Quotes Error (WITH payment method)', {
        error: err.message,
        stack: err.stack,
      });
    }

    // Fetch quotes WITHOUT payment method
    addLog('6. Fetching Quotes (WITHOUT payment method)', { note: 'To see all available payment methods per provider' });
    let quotesWithoutMethod: any = null;
    try {
      const quotesUrl = `https://api.onramper.com/quotes?apiKey=${onramperApiKey}&fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}${detectedCountry ? `&country=${detectedCountry}` : ''}`;
      
      addLog('6a. Quotes URL (WITHOUT payment method)', { url: quotesUrl.replace(onramperApiKey, 'API_KEY_HIDDEN') });
      
      const quotesResponse = await fetch(quotesUrl);
      quotesWithoutMethod = await quotesResponse.json();
      
      addLog('6b. Quotes Response (WITHOUT payment method)', {
        status: quotesResponse.status,
        hasQuotes: Array.isArray(quotesWithoutMethod),
        quoteCount: Array.isArray(quotesWithoutMethod) ? quotesWithoutMethod.length : 0,
      });

      // Log each provider's available payment methods
      if (Array.isArray(quotesWithoutMethod)) {
        quotesWithoutMethod.forEach((quote: any, idx: number) => {
          const paymentMethods = quote.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId) || [];
          const hasIdeal = paymentMethods.some((pm: string) => pm.toLowerCase().includes('ideal'));
          
          addLog(`6c. Provider ${idx + 1}: ${quote.ramp}`, {
            totalPaymentMethods: paymentMethods.length,
            paymentMethods,
            hasIdeal,
            idealVariants: paymentMethods.filter((pm: string) => pm.toLowerCase().includes('ideal')),
          });
        });
      }
    } catch (err: any) {
      addLog('6. Quotes Error (WITHOUT payment method)', {
        error: err.message,
        stack: err.stack,
      });
    }

    // Test with different country codes
    addLog('7. Testing with NL/BE country codes', { note: 'iDEAL is only available in Netherlands/Belgium' });
    for (const testCountry of ['NL', 'BE']) {
      try {
        const quotesUrl = `https://api.onramper.com/quotes?apiKey=${onramperApiKey}&fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${cryptoCurrency}&paymentMethod=${paymentMethod}&country=${testCountry}`;
        
        const quotesResponse = await fetch(quotesUrl);
        const testQuotes = await quotesResponse.json();
        
        const validQuotes = Array.isArray(testQuotes) ? testQuotes.filter((q: any) => !q.errors).length : 0;
        
        addLog(`7. Test with country=${testCountry}`, {
          status: quotesResponse.status,
          validQuotes,
          invalidQuotes: Array.isArray(testQuotes) ? testQuotes.length - validQuotes : 0,
          hasValidQuotes: validQuotes > 0,
        });
      } catch (err: any) {
        addLog(`7. Test with country=${testCountry} - Error`, {
          error: err.message,
        });
      }
    }

    // Summary & Diagnosis
    const diagnosis: string[] = [];
    
    if (detectedCountry && detectedCountry !== 'NL' && detectedCountry !== 'BE') {
      diagnosis.push(`⚠️ Country detected as "${detectedCountry}" but iDEAL only works in NL/BE`);
    }
    
    if (quotesWithMethod && Array.isArray(quotesWithMethod)) {
      const validCount = quotesWithMethod.filter((q: any) => !q.errors).length;
      if (validCount === 0) {
        diagnosis.push(`❌ 0 providers support iDEAL with current country: ${detectedCountry || 'auto-detect'}`);
      }
    }
    
    if (supportedData?.paymentMethods) {
      const idealMethod = supportedData.paymentMethods.find((pm: any) => 
        pm.id === 'ideal' || pm.id === 'idealbanktransfer'
      );
      if (idealMethod) {
        diagnosis.push(`✅ iDEAL is in supported payment methods (ID: ${idealMethod.id})`);
      } else {
        diagnosis.push(`⚠️ iDEAL not found in supported payment methods list`);
      }
    }

    addLog('8. Diagnosis', {
      issues: diagnosis,
      recommendation: diagnosis.length > 0 
        ? 'Country detection or payment method ID may be incorrect'
        : 'No obvious issues detected',
    });

    return NextResponse.json({
      success: true,
      logs: debugLogs,
      summary: {
        detectedCountry,
        validQuotesWithMethod: Array.isArray(quotesWithMethod) 
          ? quotesWithMethod.filter((q: any) => !q.errors).length 
          : 0,
        totalProviders: Array.isArray(quotesWithMethod) ? quotesWithMethod.length : 0,
        diagnosis,
      },
    });

  } catch (error: any) {
    addLog('FATAL ERROR', {
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json({
      success: false,
      error: error.message,
      logs: debugLogs,
    }, { status: 500 });
  }
}

