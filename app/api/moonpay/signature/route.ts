// MoonPay SDK Signature API Route
// POST /api/moonpay/signature
// Generates signature for MoonPay SDK (required when using walletAddress)

import { NextRequest, NextResponse } from 'next/server';
import { MoonPayService } from '@/lib/moonpay-service';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      currencyCode,
      baseCurrencyCode,
      baseCurrencyAmount,
    } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const secretKey = process.env.MOONPAY_SECRET_KEY;
    if (!secretKey) {
      logger.error('MOONPAY_SECRET_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'MoonPay secret key not configured' },
        { status: 500 }
      );
    }

    // Build query string for signature (same as URL signing)
    const params = new URLSearchParams();
    params.append('walletAddress', encodeURIComponent(walletAddress));
    if (currencyCode) {
      params.append('currencyCode', encodeURIComponent(currencyCode.toLowerCase()));
    }
    if (baseCurrencyCode) {
      params.append('baseCurrencyCode', encodeURIComponent(baseCurrencyCode.toLowerCase()));
    }
    if (baseCurrencyAmount) {
      params.append('baseCurrencyAmount', encodeURIComponent(baseCurrencyAmount.toString()));
    }

    // Generate signature (base64 for SDK, not URL-encoded)
    const queryString = params.toString();
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(queryString)
      .digest('base64');

    return NextResponse.json({
      success: true,
      signature, // Base64 signature (not URL-encoded for SDK)
    });
  } catch (error: any) {
    logger.error('MoonPay signature API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

