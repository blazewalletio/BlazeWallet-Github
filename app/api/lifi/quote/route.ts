import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { LiFiService } from '@/lib/lifi-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromChain = parseInt(searchParams.get('fromChain') || '1');
    const toChain = parseInt(searchParams.get('toChain') || '1');
    const fromToken = searchParams.get('fromToken') || '';
    const toToken = searchParams.get('toToken') || '';
    const fromAmount = searchParams.get('fromAmount') || '0';
    const toAddress = searchParams.get('toAddress') || '';
    const slippage = parseFloat(searchParams.get('slippage') || '0.03');
    const order = (searchParams.get('order') || 'RECOMMENDED') as 'RECOMMENDED' | 'CHEAPEST' | 'FASTEST';

    if (!fromToken || !toToken || !fromAmount || !toAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const lifiApiKey = process.env.LIFI_API_KEY;

    logger.log('📊 Fetching Li.Fi quote via API route:', {
      fromChain,
      toChain,
      fromToken: fromToken.substring(0, 10) + '...',
      toToken: toToken.substring(0, 10) + '...',
    });

    const quote = await LiFiService.getQuote(
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount,
      toAddress,
      slippage,
      order,
      lifiApiKey
    );

    if (!quote) {
      return NextResponse.json(
        { error: 'Failed to fetch quote from Li.Fi' },
        { status: 500 }
      );
    }

    logger.log('✅ Li.Fi quote received via API route');
    return NextResponse.json({ success: true, quote });

  } catch (error: any) {
    logger.error('Li.Fi quote error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote', details: error.message },
      { status: 500 }
    );
  }
}

