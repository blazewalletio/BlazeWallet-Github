// MoonPay Widget URL API Route
// POST /api/moonpay/widget-url
// Generates MoonPay widget URL with proper configuration

import { NextRequest, NextResponse } from 'next/server';
import { MoonPayService } from '@/lib/moonpay-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      currencyCode,
      baseCurrencyCode,
      baseCurrencyAmount,
      theme = 'light',
      mode = 'buy',
    } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
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

    const secretKey = process.env.MOONPAY_SECRET_KEY;
    if (!secretKey) {
      logger.error('MOONPAY_SECRET_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'MoonPay secret key not configured (required for URL signing)' },
        { status: 500 }
      );
    }

    const isSandbox = process.env.MOONPAY_ENVIRONMENT === 'sandbox';
    
    // Get origin from request headers for redirect URL
    const origin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/') || '';

    // Build widget URL with signature (REQUIRED when using walletAddress)
    const widgetUrl = MoonPayService.buildWidgetUrl(
      {
        walletAddress,
        currencyCode,
        baseCurrencyCode,
        baseCurrencyAmount,
        theme,
        mode,
        redirectURL: origin || undefined,
        showWalletAddressForm: false, // Hide wallet address form (we provide it)
      },
      apiKey,
      secretKey,
      isSandbox
    );

    return NextResponse.json({
      success: true,
      widgetUrl,
    });
  } catch (error: any) {
    logger.error('MoonPay widget URL API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

