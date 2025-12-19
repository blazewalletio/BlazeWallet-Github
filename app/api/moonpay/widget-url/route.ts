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

    const isSandbox = process.env.MOONPAY_ENVIRONMENT === 'sandbox';
    
    // Get origin from request headers for redirect URL
    const origin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/') || '';

    const widgetUrl = MoonPayService.buildWidgetUrl(
      {
        walletAddress,
        currencyCode,
        baseCurrencyCode,
        baseCurrencyAmount,
        theme,
        mode,
      },
      apiKey,
      isSandbox
    );
    
    // Add redirect URL if origin is available
    const widgetUrlWithRedirect = origin 
      ? `${widgetUrl}&redirectURL=${encodeURIComponent(origin)}`
      : widgetUrl;

    return NextResponse.json({
      success: true,
      widgetUrl: widgetUrlWithRedirect,
    });
  } catch (error: any) {
    logger.error('MoonPay widget URL API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

