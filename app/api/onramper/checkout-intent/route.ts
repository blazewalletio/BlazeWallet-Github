import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { OnramperService } from '@/lib/onramper-service';
import { CHAINS } from '@/lib/chains';
import crypto from 'crypto';

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
    const {
      fiatAmount,
      fiatCurrency,
      cryptoCurrency,
      walletAddress,
      paymentMethod,
      email,
      country,
    } = await req.json();

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

    logger.log('📊 Creating Onramper checkout intent:', {
      fiatAmount,
      fiatCurrency,
      cryptoCurrency,
      walletAddress: walletAddress.substring(0, 10) + '...',
      paymentMethod,
    });

    // IMPORTANT: First get a quote to determine the onramp provider
    // The /checkout/intent API requires an 'onramp' field, which we get from the quote
    // We fetch quotes WITHOUT paymentMethod first to get all available providers,
    // then filter for the one that supports our paymentMethod
    let onrampProvider: string | null = null;
    
    // CRITICAL: If we have a paymentMethod, use /supported/payment-types/{source} to find providers that support it
    // This endpoint returns which providers support which payment methods for a specific source/destination
    // According to Onramper docs, this is the most reliable way to check payment method support
    if (paymentMethod) {
      try {
        logger.log('📊 Fetching supported payment types to find providers that support payment method...');
        const fiatLower = fiatCurrency.toLowerCase();
        const cryptoLower = cryptoCurrency.toLowerCase();
        
        // Use /supported/payment-types/{source} endpoint to get providers that support this payment method
        // This endpoint shows which providers support which payment methods for EUR -> SOL
        const supportedPaymentTypesUrl = `https://api.onramper.com/supported/payment-types/${fiatLower}?type=buy&destination=${cryptoLower}&country=NL`;
        
        const supportedPaymentTypesResponse = await fetch(supportedPaymentTypesUrl, {
          headers: {
            'Authorization': onramperApiKey,
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
    
    // If we still don't have a provider, or if no paymentMethod was specified, use quotes API
    if (!onrampProvider) {
      try {
        logger.log('📊 Fetching quote to determine onramp provider...');
        const fiatLower = fiatCurrency.toLowerCase();
        const cryptoLower = cryptoCurrency.toLowerCase();
        // Fetch quotes WITHOUT paymentMethod to get all available providers
        const quoteUrl = `https://api.onramper.com/quotes/${fiatLower}/${cryptoLower}?amount=${fiatAmount}`;
        
        const quoteResponse = await fetch(quoteUrl, {
          headers: {
            'Authorization': onramperApiKey,
            'Accept': 'application/json',
          },
        });

      if (quoteResponse.ok) {
        const quoteData = await quoteResponse.json();
        // Log full quote response structure for debugging
        logger.log('📊 Quote response for onramp provider:', {
          isArray: Array.isArray(quoteData),
          length: Array.isArray(quoteData) ? quoteData.length : 'N/A',
          preview: JSON.stringify(quoteData, null, 2).substring(0, 2000),
        });
        
        // Log all providers and their payment methods
        if (Array.isArray(quoteData)) {
          logger.log('📊 All providers in quote response:', {
            providers: quoteData.map((q: any) => ({
              ramp: q.ramp,
              hasErrors: !!q.errors,
              errors: q.errors,
              hasPaymentMethods: !!q.availablePaymentMethods,
              paymentMethodsCount: q.availablePaymentMethods?.length || 0,
              paymentMethods: q.availablePaymentMethods?.map((pm: any) => ({
                paymentTypeId: pm.paymentTypeId,
                id: pm.id,
                name: pm.name,
              })) || [],
            })),
          });
        } else if (quoteData && typeof quoteData === 'object') {
          logger.log('📊 Single quote provider:', {
            ramp: quoteData.ramp,
            hasErrors: !!quoteData.errors,
            errors: quoteData.errors,
            hasPaymentMethods: !!quoteData.availablePaymentMethods,
            paymentMethodsCount: quoteData.availablePaymentMethods?.length || 0,
            paymentMethods: quoteData.availablePaymentMethods?.map((pm: any) => ({
              paymentTypeId: pm.paymentTypeId,
              id: pm.id,
              name: pm.name,
            })) || [],
          });
        }
        
        // Quote response is an array of quotes from different providers
        if (Array.isArray(quoteData) && quoteData.length > 0) {
          // CRITICAL: If we have a paymentMethod, we MUST find a provider that supports it
          if (paymentMethod) {
            const paymentMethodLower = paymentMethod.toLowerCase();
            
            // Log all available payment methods for debugging
            logger.log('🔍 Checking payment method support:', {
              requestedPaymentMethod: paymentMethodLower,
              providersCount: quoteData.length,
            });
            
            // Find all quotes that support the payment method
            const supportedQuotes = quoteData.filter((q: any) => {
              if (!q.ramp || q.errors) {
                logger.log('⏭️ Skipping quote:', {
                  ramp: q.ramp,
                  hasErrors: !!q.errors,
                  errors: q.errors,
                });
                return false;
              }
              
              // CRITICAL: If quote has no availablePaymentMethods, we cannot verify support
              // We MUST skip this quote to avoid choosing wrong provider
              if (!q.availablePaymentMethods || q.availablePaymentMethods.length === 0) {
                logger.warn('⚠️ Quote has no availablePaymentMethods - cannot verify payment method support:', {
                  ramp: q.ramp,
                  note: 'Skipping this quote to avoid choosing wrong provider',
                });
                return false;
              }
              
              // Check if this quote supports the payment method
              const supportsPaymentMethod = q.availablePaymentMethods.some((pm: any) => {
                const pmId = pm.paymentTypeId?.toLowerCase() || pm.id?.toLowerCase() || '';
                const pmName = pm.name?.toLowerCase() || '';
                
                // Payment method name mappings (e.g., "ideal" might be "sepainstant" in API)
                const paymentMethodMappings: Record<string, string[]> = {
                  'ideal': ['ideal', 'sepainstant', 'sepa', 'sepa instant', 'sepa-instant'],
                  'sepa': ['sepa', 'sepainstant', 'sepa instant', 'sepa-instant', 'banktransfer', 'bank transfer'],
                  'creditcard': ['creditcard', 'credit card', 'card', 'visa', 'mastercard'],
                  'applepay': ['applepay', 'apple pay', 'apple'],
                  'googlepay': ['googlepay', 'google pay', 'gpay'],
                  'bancontact': ['bancontact', 'bancontact card'],
                };
                
                // Get all possible names for this payment method
                const possibleNames = paymentMethodMappings[paymentMethodLower] || [paymentMethodLower];
                
                // Try multiple matching strategies
                const matches = possibleNames.some(possibleName => 
                  pmId === possibleName || 
                  pmName === possibleName ||
                  pmId.includes(possibleName) ||
                  pmName.includes(possibleName) ||
                  possibleName.includes(pmId) ||
                  possibleName.includes(pmName)
                ) || 
                  pmId === paymentMethodLower || 
                  pmName === paymentMethodLower ||
                  pmId.includes(paymentMethodLower) ||
                  pmName.includes(paymentMethodLower) ||
                  paymentMethodLower.includes(pmId) ||
                  paymentMethodLower.includes(pmName);
                
                if (matches) {
                  logger.log('✅ Payment method match found:', {
                    provider: q.ramp,
                    paymentMethodId: pmId,
                    paymentMethodName: pmName,
                    requested: paymentMethodLower,
                    matchedVia: possibleNames.find(pn => 
                      pmId.includes(pn) || pmName.includes(pn) || pn.includes(pmId) || pn.includes(pmName)
                    ) || 'direct match',
                  });
                }
                
                return matches;
              });
              
              return supportsPaymentMethod;
            });
            
            // Log which providers support the payment method
            logger.log('📊 Payment method support check:', {
              requestedPaymentMethod: paymentMethodLower,
              supportedProviders: supportedQuotes.map((q: any) => ({
                ramp: q.ramp,
                paymentMethods: q.availablePaymentMethods?.map((pm: any) => ({
                  id: pm.paymentTypeId || pm.id,
                  name: pm.name,
                })) || [],
              })),
            });
            
            if (supportedQuotes.length > 0) {
              // Choose the best quote from supported providers (highest payout or lowest fees)
              const bestQuote = supportedQuotes.reduce((best, current) => {
                const bestPayout = parseFloat(best.payout || '0');
                const currentPayout = parseFloat(current.payout || '0');
                return currentPayout > bestPayout ? current : best;
              });
              
              onrampProvider = bestQuote.ramp;
              logger.log('✅ Found onramp provider with paymentMethod support:', {
                provider: onrampProvider,
                paymentMethod: paymentMethodLower,
                payout: bestQuote.payout,
              });
            } else {
              // No provider supports this payment method - log full details
              // IMPORTANT: Log the FULL payment methods array as JSON string to see exact structure
              logger.error('❌ No onramp provider supports payment method:', {
                paymentMethod: paymentMethodLower,
                availableProviders: quoteData.map((q: any) => {
                  const paymentMethodsJson = q.availablePaymentMethods 
                    ? JSON.stringify(q.availablePaymentMethods, null, 2)
                    : '[]';
                  return {
                    ramp: q.ramp,
                    hasPaymentMethods: !!q.availablePaymentMethods,
                    paymentMethodsCount: q.availablePaymentMethods?.length || 0,
                    paymentMethodsFull: paymentMethodsJson, // Full JSON string to see exact structure
                  };
                }),
              });
            }
          } else {
            // No paymentMethod specified, use the best quote
            // NOTE: This is only when paymentMethod is NOT specified in the request
            const bestQuote = quoteData.find((q: any) => q.ramp && !q.errors);
            if (bestQuote?.ramp) {
              onrampProvider = bestQuote.ramp;
              logger.log('✅ Found onramp provider (best quote, no paymentMethod filter):', onrampProvider);
            }
          }
        } else if (quoteData && typeof quoteData === 'object' && quoteData.ramp) {
          // Single quote object - check if it supports the payment method
          if (paymentMethod) {
            const paymentMethodLower = paymentMethod.toLowerCase();
            
            // Use same matching logic as array case
            const paymentMethodMappings: Record<string, string[]> = {
              'ideal': ['ideal', 'sepainstant', 'sepa', 'sepa instant', 'sepa-instant'],
              'sepa': ['sepa', 'sepainstant', 'sepa instant', 'sepa-instant', 'banktransfer', 'bank transfer'],
              'creditcard': ['creditcard', 'credit card', 'card', 'visa', 'mastercard'],
              'applepay': ['applepay', 'apple pay', 'apple'],
              'googlepay': ['googlepay', 'google pay', 'gpay'],
              'bancontact': ['bancontact', 'bancontact card'],
            };
            
            const possibleNames = paymentMethodMappings[paymentMethodLower] || [paymentMethodLower];
            
            const supportsPaymentMethod = quoteData.availablePaymentMethods?.some((pm: any) => {
              const pmId = pm.paymentTypeId?.toLowerCase() || pm.id?.toLowerCase() || '';
              const pmName = pm.name?.toLowerCase() || '';
              
              return possibleNames.some(possibleName => 
                pmId === possibleName || 
                pmName === possibleName ||
                pmId.includes(possibleName) ||
                pmName.includes(possibleName) ||
                possibleName.includes(pmId) ||
                possibleName.includes(pmName)
              ) || 
                pmId === paymentMethodLower || 
                pmName === paymentMethodLower ||
                pmId.includes(paymentMethodLower) ||
                pmName.includes(paymentMethodLower) ||
                paymentMethodLower.includes(pmId) ||
                paymentMethodLower.includes(pmName);
            });
            
            if (supportsPaymentMethod) {
              onrampProvider = quoteData.ramp;
              logger.log('✅ Found onramp provider from single quote with paymentMethod support:', {
                provider: onrampProvider,
                paymentMethod: paymentMethodLower,
              });
            } else {
              logger.error('❌ Single quote provider does not support payment method:', {
                provider: quoteData.ramp,
                paymentMethod: paymentMethodLower,
                availableMethods: quoteData.availablePaymentMethods?.map((pm: any) => ({
                  id: pm.paymentTypeId || pm.id,
                  name: pm.name,
                  full: pm,
                })) || [],
                paymentMethodsFull: JSON.stringify(quoteData.availablePaymentMethods, null, 2),
              });
              // DO NOT set onrampProvider - we'll fail later
            }
          } else {
            onrampProvider = quoteData.ramp;
            logger.log('✅ Found onramp provider from single quote (no paymentMethod filter):', onrampProvider);
          }
        }
      } else {
        const errorText = await quoteResponse.text();
        logger.warn('⚠️ Failed to fetch quote for onramp provider:', {
          status: quoteResponse.status,
          statusText: quoteResponse.statusText,
          error: errorText.substring(0, 500),
        });
      }
    } catch (quoteError: any) {
      logger.warn('⚠️ Failed to fetch quote for onramp provider, continuing without it:', quoteError.message);
    }
    } // Close if (!onrampProvider) block
    
    // CRITICAL: If we still don't have an onramp provider, we MUST fail
    // The /checkout/intent API requires an 'onramp' field
    if (!onrampProvider) {
      logger.error('❌ Could not determine onramp provider from quotes');
      return NextResponse.json(
        { 
          success: false,
          error: 'Could not determine onramp provider',
          message: 'Unable to find a suitable payment provider for this transaction. Please try a different payment method or amount.',
        },
        { status: 400 }
      );
    }

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

    // Add onramp provider if we found one (required to avoid "Unsupported Onramp" error)
    // CRITICAL: If we have a paymentMethod, we MUST have an onramp provider that supports it
    // If we don't have one, we should fail here, not let Onramper choose (which might choose wrong provider)
    if (onrampProvider) {
      requestBody.onramp = onrampProvider;
      logger.log('✅ Added onramp provider to request:', {
        provider: onrampProvider,
        paymentMethod: paymentMethod || 'none',
        note: paymentMethod ? 'Provider supports the selected payment method' : 'No payment method filter applied',
      });
    } else {
      // If we have a paymentMethod but no provider, we MUST fail
      if (paymentMethod) {
        logger.error('❌ CRITICAL: No onramp provider found that supports payment method:', {
          paymentMethod,
          message: 'Cannot proceed - no provider supports this payment method for this transaction',
        });
        return NextResponse.json(
          { 
            success: false,
            error: 'No compatible payment provider found',
            message: `Unable to find a payment provider that supports "${paymentMethod}" for this transaction. Please try a different payment method.`,
            paymentMethod,
          },
          { status: 400 }
        );
      } else {
        // No paymentMethod specified - Onramper can use Ranking Engine
        logger.warn('⚠️ No onramp provider found - Onramper will use Ranking Engine (no payment method filter)');
      }
    }

    // Add optional fields
    if (paymentMethod) {
      requestBody.paymentMethod = paymentMethod.toLowerCase();
    }
    if (email) {
      requestBody.email = email;
    }
    if (country) {
      requestBody.country = country.toUpperCase();
    }

    // Add partner context for tracking
    requestBody.partnerContext = `blazewallet-${Date.now()}`;

    // Add redirect URL for successful payment completion
    // This will redirect users back to Blaze Wallet after payment
    // Docs: https://docs.onramper.com/reference/post_checkout-intent
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://my.blazewallet.io';
    const successRedirectUrl = `${baseUrl}/buy/success?provider=onramper&transactionId=${Date.now()}`;
    
    // Add supportedParams with partnerData for redirect URL
    // Format according to Onramper API: partnerData.redirectUrl.success
    requestBody.supportedParams = {
      partnerData: {
        redirectUrl: {
          success: successRedirectUrl,
        },
      },
    };

    logger.log('✅ Added redirect URL for successful payment:', {
      redirectUrl: successRedirectUrl,
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
      response = await fetch('https://api.onramper.com/checkout/intent', {
        method: 'POST',
        headers: {
          'Authorization': onramperApiKey, // Direct API key, NOT Bearer token
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody), // Include signature and signContent in body
      });
    } catch (fetchError: any) {
      logger.error('❌ Failed to call Onramper /checkout/intent API:', {
        error: fetchError.message,
        stack: fetchError.stack,
      });
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to connect to Onramper API',
          details: fetchError.message 
        },
        { status: 500 }
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

    // Return success with transaction information
    return NextResponse.json({
      success: true,
      transactionInformation: {
        transactionId: transactionInformation.transactionId,
        url: transactionInformation.url,
        type: transactionInformation.type, // "iframe" or "redirect"
        params: transactionInformation.params, // iframe permissions if type is "iframe"
      },
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

