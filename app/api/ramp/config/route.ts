import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/ramp/config
 * Returns Ramp Network configuration (API key, environment)
 * This endpoint provides the public API key to the client
 */
export async function GET(req: NextRequest) {
  try {
    const hostApiKey = process.env.NEXT_PUBLIC_RAMP_API_KEY || process.env.RAMP_API_KEY || '';
    const isSandbox = process.env.RAMP_ENVIRONMENT === 'sandbox' || (!hostApiKey.includes('_live_') && hostApiKey.length > 0);

    // If no API key, return a graceful error (not 500, but 200 with success: false)
    // This allows the frontend to show a user-friendly message
    if (!hostApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ramp API key not configured',
          config: {
            hostApiKey: '',
            isSandbox: true,
            environment: 'sandbox',
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      config: {
        hostApiKey,
        isSandbox,
        environment: isSandbox ? 'sandbox' : 'production',
      },
    });
  } catch (error: any) {
    console.error('❌ Failed to get Ramp config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get Ramp configuration',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

