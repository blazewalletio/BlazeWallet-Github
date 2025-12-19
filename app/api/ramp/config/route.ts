import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * GET /api/ramp/config
 * Returns Ramp Network configuration (API key, environment)
 * This endpoint provides the public API key to the client
 */
export async function GET(req: NextRequest) {
  try {
    const hostApiKey = process.env.NEXT_PUBLIC_RAMP_API_KEY || process.env.RAMP_API_KEY || '';
    const isSandbox = process.env.RAMP_ENVIRONMENT === 'sandbox' || !hostApiKey.includes('_live_');

    if (!hostApiKey) {
      logger.warn('⚠️ Ramp API key not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'Ramp API key not configured',
        },
        { status: 500 }
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
    logger.error('❌ Failed to get Ramp config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get Ramp configuration',
      },
      { status: 500 }
    );
  }
}

