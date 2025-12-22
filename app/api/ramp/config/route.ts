import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/ramp/config
 * Returns Ramp Network configuration (API key, environment)
 * This endpoint provides the public API key to the client
 */
export async function GET(req: NextRequest) {
  try {
    // Safely get environment variables
    const publicKey = typeof process.env.NEXT_PUBLIC_RAMP_API_KEY === 'string' 
      ? process.env.NEXT_PUBLIC_RAMP_API_KEY.trim() 
      : '';
    const privateKey = typeof process.env.RAMP_API_KEY === 'string' 
      ? process.env.RAMP_API_KEY.trim() 
      : '';
    const hostApiKey = publicKey || privateKey || '';
    
    // Determine sandbox status
    const envSandbox = process.env.RAMP_ENVIRONMENT === 'sandbox';
    const isSandbox = envSandbox || (!hostApiKey.includes('_live_') && hostApiKey.length > 0);

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
    // Return 200 with error instead of 500 to prevent frontend crashes
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get Ramp configuration',
        details: error?.message || 'Unknown error',
        config: {
          hostApiKey: '',
          isSandbox: true,
          environment: 'sandbox',
        },
      },
      { status: 200 }
    );
  }
}

