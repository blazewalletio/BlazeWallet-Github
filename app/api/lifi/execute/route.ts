import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { LiFiService } from '@/lib/lifi-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { route, stepIndex, userAddress } = await req.json();

    if (!route || stepIndex === undefined || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const lifiApiKey = process.env.LIFI_API_KEY;

    logger.log('📝 Executing Li.Fi step via API route:', {
      stepIndex,
      userAddress: userAddress.substring(0, 10) + '...',
    });

    const transaction = await LiFiService.getStepTransaction(
      route,
      stepIndex,
      userAddress,
      lifiApiKey
    );

    if (!transaction) {
      return NextResponse.json(
        { error: 'Failed to get transaction data' },
        { status: 500 }
      );
    }

    logger.log('✅ Transaction data received via API route');
    return NextResponse.json({ success: true, transaction });

  } catch (error: any) {
    logger.error('Li.Fi execute error:', error);
    return NextResponse.json(
      { error: 'Failed to execute', details: error.message },
      { status: 500 }
    );
  }
}

