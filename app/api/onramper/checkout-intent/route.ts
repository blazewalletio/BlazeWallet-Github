import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { OnramperService } from '@/lib/onramper-service';
import { CHAINS } from '@/lib/chains';
import { GeolocationService } from '@/lib/geolocation';
import crypto from 'crypto';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import { getClientIP } from '@/lib/rate-limiter';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/onramper/checkout-intent
 * 
 * Initiates a transaction via Onramper's /checkout/intent API
 * Returns transaction information with type (iframe or redirect)
 * 
 * This is the RECOMMENDED approach for better UI/UX control:
 * - Returns type: "iframe" when widget can be embedded
 * - Returns type: "redirect" when payment provider requires redirect
 * 
 * Docs: https://docs.onramper.com/reference/post_checkout-intent
 */
export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIP(req.headers);
    const isAllowed = apiRateLimiter.check(`onramper:checkout:${clientIp}`, 30, 60 * 1000);
    if (!isAllowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', message: 'Rate limit exceeded for checkout requests' },
        { status: 429 }
      );
    }

    const {
      fiatAmount,
      fiatCurrency,
      cryptoCurrency,
      walletAddress,
      paymentMethod,
      email,
      country,
      onramp, // REQUIRED: Provider name (banxa, moonpay, etc.)
      userId: requestedUserId, // Optional: legacy client hint, never trusted over verified token
    } = await req.json();

    const supabaseAdmin = getSupabaseAdmin();
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    let verifiedUserId: string | null = null;
    if (bearerToken) {
      const { data: verifiedUser, error: verifyError } = await supabaseAdmin.auth.getUser(bearerToken);
      if (!verifyError && verifiedUser?.user?.id) {
        verifiedUserId = verifiedUser.user.id;
      }
    }
    const resolvedUserId = verifiedUserId || (typeof requestedUserId === 'string' ? requestedUserId : null);

    // Validate required fields
    if (!fiatAmount || !fiatCurrency || !cryptoCurrency || !walletAddress) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required fields',
          message: 'fiatAmount, fiatCurrency, cryptoCurrency, and walletAddress are required'
        },
        { status: 400 }
      );
    }

    // Validate provider (OPTIONAL - let Onramper's Ranking Engine choose if not provided)
    // If provider is specified, it will be used. Otherwise, Onramper chooses the best one.
    if (!onramp) {
      logger.log('ℹ️ No provider specified - Onramper will automatically select best provider via Ranking Engine');
    }

    // Get API key
    const onramperApiKey = process.env.ONRAMPER_API_KEY?.trim();
    if (!onramperApiKey) {
      logger.error('ONRAMPER_API_KEY is not set in environment variables.');
      return NextResponse.json(
        { 
          success: false,
          error: 'Onramper not configured', 
          message: 'Please add ONRAMPER_API_KEY to environment variables.',
          requiresApiKey: true
        },
        { status: 503 }
      );
    }

    // Get secret key for signature (required for /checkout/intent API)
    const onramperSecretKey = process.env.ONRAMPER_SECRET_KEY?.trim();
    if (!onramperSecretKey) {
      logger.error('ONRAMPER_SECRET_KEY is not set in environment variables. This is required for /checkout/intent API.');
      return NextResponse.json(
        { 
          success: false,
          error: 'Onramper secret key missing',
          message: 'ONRAMPER_SECRET_KEY is required for /checkout/intent API. Please add it to Vercel environment variables. Contact Onramper support to obtain your secret key.',
          requiresSecretKey: true,
          contactEmail: 'support@onramper.com',
        },
        { status: 503 }
      );
    }

    // Detect country if not provided
    let detectedCountry = country;
    if (!detectedCountry) {
      detectedCountry = await GeolocationService.detectCountry(req) || undefined;
      if (detectedCountry) {
        logger.log('✅ Auto-detected country:', detectedCountry);
      }
    }

    logger.log('📊 Creating Onramper checkout intent:', {
      fiatAmount,
      fiatCurrency,
      cryptoCurrency,
      walletAddress: walletAddress.substring(0, 10) + '...',
      paymentMethod,
      onramp,
      country: detectedCountry || 'auto-detect',
    });

    // Use provided provider if specified, otherwise let Onramper choose
    let onrampProvider = onramp ? onramp.toLowerCase() : null;
    
    if (onrampProvider) {
      logger.log('✅ Using specified onramp provider:', {
        provider: onrampProvider,
        paymentMethod: paymentMethod || 'none',
      });
    } else {
      logger.log('🎯 No provider specified - Onramper will use Ranking Engine to select best provider');
    }
    
    // Optional: Check if provider supports the payment method (for logging/debugging)
    if (paymentMethod && false) { // Disabled for now - provider already selected
      try {
        logger.log('📊 Fetching supported payment types to find providers that support payment method...');
        const fiatLower = fiatCurrency.toLowerCase();
        const cryptoLower = cryptoCurrency.toLowerCase();
        
        // Use /supported/payment-types/{source} endpoint to get providers that support this payment method
        // This endpoint shows which providers support which payment methods for EUR -> SOL
        const countryParam = detectedCountry ? `&country=${detectedCountry.toLowerCase()}` : '';
        const supportedPaymentTypesUrl = `https://api.onramper.com/supported/payment-types/${fiatLower}?type=buy&destination=${cryptoLower}${countryParam}`;
        
        const supportedPaymentTypesResponse = await fetch(supportedPaymentTypesUrl, {
          headers: {
            'Authorization': onramperApiKey || '',
            'Accept': 'application/json',
          },
        });
        
        if (supportedPaymentTypesResponse.ok) {
          const supportedPaymentTypesData = await supportedPaymentTypesResponse.json();
          const paymentTypesList = supportedPaymentTypesData.message || supportedPaymentTypesData || [];
          
          logger.log('📊 Supported payment types response:', {
            isArray: Array.isArray(paymentTypesList),
            count: Array.isArray(paymentTypesList) ? paymentTypesList.length : 'N/A',
            preview: JSON.stringify(paymentTypesList, null, 2).substring(0, 2000),
          });
          
          const paymentMethodLower = paymentMethod.toLowerCase();
          
          // Payment method name mappings (e.g., "ideal" might be "sepainstant" in API)
          const paymentMethodMappings: Record<string, string[]> = {
            'ideal': ['ideal', 'sepainstant', 'sepa', 'sepa instant', 'sepa-instant'],
            'sepa': ['sepa', 'sepainstant', 'sepa instant', 'sepa-instant', 'banktransfer', 'bank transfer', 'sepabanktransfer'],
            'creditcard': ['creditcard', 'credit card', 'card', 'visa', 'mastercard'],
            'applepay': ['applepay', 'apple pay', 'apple'],
            'googlepay': ['googlepay', 'google pay', 'gpay'],
            'bancontact': ['bancontact', 'bancontact card'],
          };
          
          const possibleNames = paymentMethodMappings[paymentMethodLower] || [paymentMethodLower];
          
          // Find payment type that matches our payment method
          const matchingPaymentType = paymentTypesList.find((pt: any) => {
            const ptId = pt.paymentTypeId?.toLowerCase() || pt.id?.toLowerCase() || '';
            const ptName = pt.name?.toLowerCase() || '';
            
            return possibleNames.some(possibleName => 
              ptId === possibleName ||
              ptName === possibleName ||
              ptId.includes(possibleName) ||
              ptName.includes(possibleName) ||
              possibleName.includes(ptId) ||
              possibleName.includes(ptName)
            ) || ptId === paymentMethodLower || ptName === paymentMethodLower;
          });
          
          if (matchingPaymentType && matchingPaymentType.details && matchingPaymentType.details.limits) {
            // Extract providers from the limits object
            // Format: { "banxa": { "min": 46, "max": 30000 }, ... }
            const supportingProviders = Object.keys(matchingPaymentType.details.limits).filter(
              (provider: string) => provider !== 'aggregatedLimit'
            );
            
            logger.log('📊 Providers that support payment method (from /supported/payment-types):', {
              paymentMethod: paymentMethodLower,
              paymentTypeId: matchingPaymentType.paymentTypeId,
              paymentTypeName: matchingPaymentType.name,
              supportingProviders,
              limits: matchingPaymentType.details.limits,
            });
            
            if (supportingProviders.length > 0) {
              // Use the first provider (or we could choose based on best rates)
              // According to Onramper docs, Banxa is the only provider that supports iDEAL for EUR -> SOL
              onrampProvider = supportingProviders[0];
              logger.log('✅ Found onramp provider from /supported/payment-types:', {
                provider: onrampProvider,
                paymentMethod: paymentMethodLower,
                totalSupporting: supportingProviders.length,
                allProviders: supportingProviders,
              });
            } else {
              logger.error('❌ No onramp provider found that supports payment method (from /supported/payment-types):', {
                paymentMethod: paymentMethodLower,
                paymentType: matchingPaymentType,
              });
            }
          } else {
            logger.error('❌ Payment method not found in /supported/payment-types:', {
              paymentMethod: paymentMethodLower,
              availablePaymentTypes: paymentTypesList.map((pt: any) => ({
                paymentTypeId: pt.paymentTypeId,
                name: pt.name,
              })),
            });
          }
        } else {
          logger.warn('⚠️ Failed to fetch supported payment types, falling back to quotes API:', {
            status: supportedPaymentTypesResponse.status,
            statusText: supportedPaymentTypesResponse.statusText,
          });
        }
      } catch (supportedPaymentTypesError: any) {
        logger.warn('⚠️ Error fetching supported payment types, falling back to quotes API:', supportedPaymentTypesError.message);
      }
    }
    
    // Provider is always 'banxa' - no need for fallback logic

    // Determine network code based on crypto currency
    // Map crypto currency to chain ID, then to Onramper network code
    const getNetworkFromCrypto = (crypto: string): string | null => {
      const cryptoUpper = crypto.toUpperCase();
      const cryptoLower = crypto.toLowerCase();
      
      // Map crypto currency to chain ID
      const cryptoToChainId: Record<string, number> = {
        'ETH': 1,
        'USDT': 1, // USDT on Ethereum
        'USDC': 1, // USDC on Ethereum
        'DAI': 1,
        'WBTC': 1,
        'MATIC': 137,
        'BNB': 56,
        'BUSD': 56,
        'SOL': 101,
        'AVAX': 43114,
      };
      
      const chainId = cryptoToChainId[cryptoUpper];
      if (chainId) {
        return OnramperService.getNetworkCode(chainId);
      }
      
      // Fallback: try to match by crypto name
      if (cryptoLower.includes('sol') || cryptoLower === 'sol') {
        return 'solana';
      }
      if (cryptoLower.includes('btc') || cryptoLower === 'btc') {
        return 'bitcoin';
      }
      if (cryptoLower.includes('eth') || cryptoLower === 'eth') {
        return 'ethereum';
      }
      if (cryptoLower.includes('matic') || cryptoLower === 'matic') {
        return 'polygon';
      }
      
      return null; // Let Onramper determine
    };
    
    const networkCode = getNetworkFromCrypto(cryptoCurrency);
    
    // Build request body for Onramper /checkout/intent API
    // IMPORTANT: Use correct field names per Onramper API documentation
    // Docs: https://docs.onramper.com/reference/post_checkout-intent
    const requestBody: any = {
      source: fiatCurrency.toLowerCase(), // NOT sourceCurrency
      destination: cryptoCurrency.toLowerCase(), // NOT destinationCurrency
      amount: parseFloat(fiatAmount), // NOT sourceAmount
      type: 'buy',
      wallet: {
        address: walletAddress, // NOT destinationWalletAddress (nested in wallet object)
      },
    };
    
    // Add network field if we can determine it (optional but recommended)
    if (networkCode) {
      requestBody.network = networkCode;
      logger.log('✅ Added network to request:', networkCode);
    } else {
      logger.warn('⚠️ Could not determine network code for crypto:', cryptoCurrency);
    }

    // Add selected provider ONLY if specified (otherwise Onramper's Ranking Engine chooses)
    // This allows Onramper to automatically select a provider that:
    // 1. Supports the payment method
    // 2. Is available/online
    // 3. Offers the best rates
    if (onrampProvider) {
      requestBody.onramp = onrampProvider;
      logger.log('✅ Added specified onramp provider to request:', {
        provider: onrampProvider,
        paymentMethod: paymentMethod || 'none',
      });
    } else {
      logger.log('🎯 Onramp provider not specified - Ranking Engine will select automatically');
    }

    // Add optional fields
    if (paymentMethod) {
      requestBody.paymentMethod = paymentMethod.toLowerCase();
    }
    if (email) {
      requestBody.email = email;
    }
    // Add country if detected (otherwise Onramper auto-detects via IP)
    if (detectedCountry) {
      requestBody.country = detectedCountry.toUpperCase();
    }

    // Add partner context for tracking (include verified userId if available)
    requestBody.partnerContext = resolvedUserId
      ? `userId:${resolvedUserId}|blazewallet-${Date.now()}`
      : `blazewallet-${Date.now()}`;

    // Add redirect URLs for payment completion (success and error)
    // This will redirect users back to Blaze Wallet after payment
    // Docs: https://docs.onramper.com/reference/post_checkout-intent
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://my.blazewallet.io';
    const successRedirectUrl = `${baseUrl}/buy/success?provider=onramper&transactionId=${Date.now()}`;
    const errorRedirectUrl = `${baseUrl}/buy/error?provider=onramper`;
    
    // Add supportedParams with partnerData for redirect URLs
    // Format according to Onramper API: partnerData.redirectUrl.success and .error
    requestBody.supportedParams = {
      partnerData: {
        redirectUrl: {
          success: successRedirectUrl,
          error: errorRedirectUrl, // Redirect to our error page for cancelled/failed payments
          failure: errorRedirectUrl, // Also handle failure cases
        },
      },
    };

    logger.log('✅ Added redirect URLs:', {
      success: successRedirectUrl,
      error: errorRedirectUrl,
      baseUrl,
    });

    // Generate signature according to Onramper API documentation
    // Docs: https://docs.onramper.com/docs/signatures/api-sign-requests
    // 
    // IMPORTANT: Only sign sensitive fields:
    // - wallets, networkWallets, walletAddressTags, walletAddress, walletMemo, walletAddresses
    // 
    // In our case, we have wallet.address, so we need to sign it as "walletAddress"
    // 
    // Steps:
    // 1. Create signContent string from sensitive fields (alphabetically sorted)
    // 2. Generate HMAC SHA256 signature
    // 3. Add both signature AND signContent to request body
    
    // Build signContent from sensitive fields (alphabetically sorted)
    // Since we only have walletAddress, signContent is simple
    const signContent = `walletAddress=${walletAddress}`;
    
    // Generate HMAC SHA256 signature
    const signature = crypto
      .createHmac('sha256', onramperSecretKey)
      .update(signContent)
      .digest('hex');

    // Add signature and signContent to request body (REQUIRED by Onramper)
    requestBody.signature = signature;
    requestBody.signContent = signContent;

    logger.log('🔐 Generated signature for checkout intent:', {
      signContent,
      signatureLength: signature.length,
      signaturePrefix: signature.substring(0, 20) + '...',
      requestBodyPreview: JSON.stringify(requestBody, null, 2).substring(0, 1500), // Log full request body for debugging
    });

    // Call Onramper /checkout/intent API
    // IMPORTANT: 
    // 1. Authorization header: API key directly (NOT Bearer token)
    // 2. Request body must include BOTH signature AND signContent fields
    // 3. X-Onramper-Secret header is NOT needed (secret key is only used to generate signature)
    let response;
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      response = await fetch('https://api.onramper.com/checkout/intent', {
        method: 'POST',
        headers: {
          'Authorization': onramperApiKey, // Direct API key, NOT Bearer token
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody), // Include signature and signContent in body
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      logger.error('❌ Failed to call Onramper /checkout/intent API:', {
        error: fetchError.message,
        stack: fetchError.stack,
        name: fetchError.name,
        isAbort: fetchError.name === 'AbortError',
      });
      
      // Handle timeout specifically
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { 
            success: false,
            error: 'Request timeout',
            message: 'Onramper API request timed out. Please try again.',
            details: 'The request took longer than 30 seconds to complete.'
          },
          { status: 504 } // Gateway Timeout
        );
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to connect to Onramper API',
          message: fetchError.message || 'Unable to reach Onramper API',
          details: fetchError.message 
        },
        { status: 502 } // Bad Gateway
      );
    }

    // Parse response
    let data;
    try {
      data = await response.json();
    } catch (parseError: any) {
      logger.error('❌ Failed to parse Onramper response:', {
        error: parseError.message,
        status: response.status,
        statusText: response.statusText,
      });
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid response from Onramper API',
          details: parseError.message 
        },
        { status: 500 }
      );
    }

    // Check for API errors
    if (!response.ok) {
      const errorMessage = data?.message || data?.error?.message || data?.error || response.statusText || 'Unknown error';
      logger.error('❌ Onramper /checkout/intent API error:', {
        status: response.status,
        statusText: response.statusText,
        errorMessage,
        fullError: JSON.stringify(data, null, 2),
        requestBody: JSON.stringify(requestBody, null, 2), // Log full request body for debugging
      });
      return NextResponse.json(
        { 
          success: false,
          error: 'Onramper API error',
          message: errorMessage,
          details: data,
        },
        { status: response.status }
      );
    }

    // IMPORTANT: Onramper response structure can be:
    // 1. Direct: { transactionInformation: {...} }
    // 2. Nested: { message: { transactionInformation: {...} } }
    // 3. Wrapped: { message: { validationInformation: true, transactionInformation: {...} } }
    let transactionInformation = data.transactionInformation;
    
    // Check if transactionInformation is nested in message
    if (!transactionInformation && data.message) {
      transactionInformation = data.message.transactionInformation;
    }
    
    // Check if it's in message.validationInformation structure
    if (!transactionInformation && data.message?.validationInformation) {
      transactionInformation = data.message.transactionInformation;
    }
    
    if (!transactionInformation) {
      logger.error('❌ No transactionInformation in Onramper response:', {
        dataKeys: Object.keys(data),
        hasMessage: !!data.message,
        messageKeys: data.message ? Object.keys(data.message) : [],
        fullResponse: JSON.stringify(data, null, 2).substring(0, 2000),
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid response from Onramper',
          message: 'No transaction information returned',
          details: data,
        },
        { status: 500 }
      );
    }

    // Log transaction type
    logger.log('✅ Onramper checkout intent created:', {
      transactionId: transactionInformation.transactionId,
      type: transactionInformation.type, // "iframe" or "redirect"
      hasUrl: !!transactionInformation.url,
    });

    // Create initial pending order immediately so Purchase History updates right after "Buy now".
    if (resolvedUserId) {
      const providerForRow = (onrampProvider || onramp || 'onramper').toLowerCase();
      const nowIso = new Date().toISOString();
      const pendingRow = {
        user_id: resolvedUserId,
        onramp_transaction_id: transactionInformation.transactionId,
        provider: providerForRow,
        fiat_amount: Number(fiatAmount),
        fiat_currency: String(fiatCurrency).toUpperCase(),
        crypto_currency: String(cryptoCurrency).toUpperCase(),
        payment_method: paymentMethod ? String(paymentMethod).toLowerCase() : null,
        wallet_address: String(walletAddress),
        status: 'pending',
        status_updated_at: nowIso,
        updated_at: nowIso,
        provider_data: {
          lifecycle: {
            source: 'checkout_intent',
            checkout_created_at: nowIso,
            last_reconciled_at: null,
          },
          effectiveCountry: detectedCountry?.toUpperCase() || null,
          onrampProvider: providerForRow,
        },
      };

      const { error: insertPendingError } = await supabaseAdmin
        .from('onramp_transactions')
        .upsert(pendingRow, { onConflict: 'onramp_transaction_id,provider' });

      if (insertPendingError) {
        logger.error('❌ Failed to create initial pending onramp transaction:', insertPendingError);
      }
    }

    // Return success with transaction information
    return NextResponse.json({
      success: true,
      transactionInformation: {
        transactionId: transactionInformation.transactionId,
        url: transactionInformation.url,
        type: transactionInformation.type, // "iframe" or "redirect"
        params: transactionInformation.params, // iframe permissions if type is "iframe"
      },
      effectiveCountry: detectedCountry?.toUpperCase() || null,
      // Also include session information if available (can be nested in message)
      sessionInformation: data.sessionInformation || data.message?.sessionInformation,
    });

  } catch (error: any) {
    logger.error('Onramper checkout-intent error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create checkout intent', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

