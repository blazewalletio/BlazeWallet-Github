// MoonPay Config API Route
// GET /api/moonpay/config
// Returns public API key and environment (safe to expose to client)

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.MOONPAY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'MoonPay API key not configured' },
        { status: 500 }
      );
    }

    const isSandbox = process.env.MOONPAY_ENVIRONMENT === 'sandbox';

    // Return public API key (safe to expose to client)
    return NextResponse.json({
      success: true,
      apiKey, // Public key is safe to expose
      isSandbox,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

