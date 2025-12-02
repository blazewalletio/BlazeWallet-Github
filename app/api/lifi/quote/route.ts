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
    // ✅ FIXED: According to Li.Fi docs, the parameter is 'fromAddress' (wallet address initiating the swap)
    const fromAddress = searchParams.get('fromAddress') || searchParams.get('toAddress') || ''; // Support both for backward compatibility
    const slippage = parseFloat(searchParams.get('slippage') || '0.03');
    const order = (searchParams.get('order') || 'RECOMMENDED') as 'RECOMMENDED' | 'CHEAPEST' | 'FASTEST';

    if (!fromToken || !toToken || !fromAmount || !fromAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const lifiApiKey = process.env.LIFI_API_KEY;

    logger.log('📊 Fetching Li.Fi quote via API route:', {
      fromChain,
      toChain,
      fromToken: fromToken.length > 10 ? fromToken.substring(0, 10) + '...' : fromToken,
      toToken: toToken.length > 10 ? toToken.substring(0, 10) + '...' : toToken,
      fromAmount,
      fromAddress: fromAddress.substring(0, 10) + '...',
    });

    try {
      const quote = await LiFiService.getQuote(
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount,
        fromAddress, // ✅ FIXED: Changed from 'toAddress' to 'fromAddress'
        slippage,
        order,
        lifiApiKey
      );

      if (!quote) {
        logger.error('❌ Li.Fi returned null quote');
        return NextResponse.json(
          { error: 'Failed to fetch quote from Li.Fi. Please check if the token pair is supported.' },
          { status: 500 }
        );
      }

      logger.log('✅ Li.Fi quote received via API route');
      return NextResponse.json({ success: true, quote });
    } catch (error: any) {
      logger.error('❌ Li.Fi quote error in API route:', {
        error: error.message,
        stack: error.stack,
        fromChain,
        toChain,
        fromToken,
        toToken,
      });
      return NextResponse.json(
        { 
          error: 'Failed to fetch quote from Li.Fi',
          details: error.message || 'Unknown error',
          hint: fromChain === 101 || toChain === 101 
            ? 'Solana swaps may have limited support. Try EVM chains (Ethereum, Polygon, etc.) first.'
            : 'Please check if the token pair is supported by Li.Fi.'
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    logger.error('Li.Fi quote error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote', details: error.message },
      { status: 500 }
    );
  }
}

