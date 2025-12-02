import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { LiFiService } from '@/lib/lifi-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // ✅ CRITICAL: Chain IDs can be numbers (EVM) or strings (Solana)
    // Solana chain ID in Li.Fi is "1151111081099710" (string), not 101
    const fromChainParam = searchParams.get('fromChain') || '1';
    const toChainParam = searchParams.get('toChain') || '1';
    
    // Convert to number if it's a numeric string, otherwise keep as string
    const fromChain = /^\d+$/.test(fromChainParam) ? parseInt(fromChainParam) : fromChainParam;
    const toChain = /^\d+$/.test(toChainParam) ? parseInt(toChainParam) : toChainParam;
    
    const fromToken = searchParams.get('fromToken') || '';
    const toToken = searchParams.get('toToken') || '';
    const fromAmount = searchParams.get('fromAmount') || '0';
    const fromAddress = searchParams.get('fromAddress') || searchParams.get('toAddress') || '';
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
        fromAddress,
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
      // Check if Solana is involved
      const isSolanaInvolved = fromChain.toString() === '1151111081099710' || 
                               toChain.toString() === '1151111081099710' ||
                               fromChain === 101 || toChain === 101; // Also check numeric 101 for backward compatibility
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch quote from Li.Fi',
          details: error.message || 'Unknown error',
          hint: isSolanaInvolved
            ? 'Solana swaps are supported via Li.Fi. Please check if the token pair is available.'
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

