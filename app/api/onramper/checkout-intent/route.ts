import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
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
      logger.error('❌ Onramper /checkout/intent API error:', {
        status: response.status,
        statusText: response.statusText,
        error: data,
      });
      return NextResponse.json(
        { 
          success: false,
          error: 'Onramper API error',
          message: data.message || 'Failed to create checkout intent',
          details: data,
        },
        { status: response.status }
      );
    }

    // Extract transaction information
    const transactionInformation = data.transactionInformation;
    if (!transactionInformation) {
      logger.error('❌ No transactionInformation in Onramper response:', data);
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
      // Also include session information if available
      sessionInformation: data.sessionInformation,
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

