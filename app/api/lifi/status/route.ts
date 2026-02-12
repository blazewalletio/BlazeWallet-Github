import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { LiFiService } from '@/lib/lifi-service';
import { getLiFiChainId, isLiFiChainIdSupported } from '@/lib/lifi-chain-ids';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const txHash = searchParams.get('txHash') || '';
    const bridge = searchParams.get('bridge') || '';
    const fromChainParam = searchParams.get('fromChain');
    const toChainParam = searchParams.get('toChain');

    if (!txHash || !bridge || !fromChainParam || !toChainParam) {
      return NextResponse.json(
        { error: 'Missing required parameters: txHash, bridge, fromChain, toChain' },
        { status: 400 }
      );
    }

    const normalizeChain = (value: string): string | number | undefined => {
      const lowered = value.toLowerCase();
      if (/^\d+$/.test(value)) {
        return parseInt(value, 10);
      }
      return getLiFiChainId(lowered);
    };

    const fromChain = normalizeChain(fromChainParam);
    const toChain = normalizeChain(toChainParam);

    if (!fromChain || !toChain || !isLiFiChainIdSupported(fromChain) || !isLiFiChainIdSupported(toChain)) {
      return NextResponse.json(
        { error: 'Unsupported LI.FI chain pair for status tracking' },
        { status: 400 }
      );
    }

    const lifiApiKey = process.env.LIFI_API_KEY;

    const status = await LiFiService.getStatus(
      txHash,
      bridge,
      Number(fromChain),
      Number(toChain),
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

