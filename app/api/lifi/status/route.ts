import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { LiFiService } from '@/lib/lifi-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const txHash = searchParams.get('txHash') || '';
    const bridge = searchParams.get('bridge') || '';
    const fromChain = parseInt(searchParams.get('fromChain') || '1');
    const toChain = parseInt(searchParams.get('toChain') || '1');

    if (!txHash || !bridge) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const lifiApiKey = process.env.LIFI_API_KEY;

    const status = await LiFiService.getStatus(
      txHash,
      bridge,
      fromChain,
      toChain,
      lifiApiKey
    );

    if (!status) {
      return NextResponse.json(
        { error: 'Failed to fetch status' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, status });

  } catch (error: any) {
    logger.error('Li.Fi status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status', details: error.message },
      { status: 500 }
    );
  }
}

