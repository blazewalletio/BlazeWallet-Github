import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { LiFiQuoteError, LiFiService } from '@/lib/lifi-service';
import { getLiFiChainId, isLiFiChainIdSupported } from '@/lib/lifi-chain-ids';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromChainParam = searchParams.get('fromChain');
    const toChainParam = searchParams.get('toChain');

    if (!fromChainParam || !toChainParam) {
      return NextResponse.json(
        { error: 'Missing required parameters: fromChain, toChain' },
        { status: 400 }
      );
    }
    
    const SOLANA_CHAIN_ID = '1151111081099710';

    const normalizeChainParam = (value: string): string | number => {
      if (value === SOLANA_CHAIN_ID) return SOLANA_CHAIN_ID;
      return /^\d+$/.test(value) ? parseInt(value, 10) : value.toLowerCase();
    };

    const normalizedFromChain = normalizeChainParam(fromChainParam);
    const normalizedToChain = normalizeChainParam(toChainParam);

    const fromChain =
      typeof normalizedFromChain === 'string' && normalizedFromChain !== SOLANA_CHAIN_ID && !/^\d+$/.test(normalizedFromChain)
        ? getLiFiChainId(normalizedFromChain)
        : normalizedFromChain;
    const toChain =
      typeof normalizedToChain === 'string' && normalizedToChain !== SOLANA_CHAIN_ID && !/^\d+$/.test(normalizedToChain)
        ? getLiFiChainId(normalizedToChain)
        : normalizedToChain;

    if (!fromChain || !toChain || !isLiFiChainIdSupported(fromChain) || !isLiFiChainIdSupported(toChain)) {
      return NextResponse.json(
        {
          error: 'Unsupported swap route',
          details: 'Selected source or destination chain is not supported for Li.Fi swaps in this wallet.',
        },
        { status: 400 }
      );
    }
    
    const fromToken = searchParams.get('fromToken') || '';
    const toToken = searchParams.get('toToken') || '';
    const fromAmount = searchParams.get('fromAmount') || '0';
    const fromAddress = searchParams.get('fromAddress') || '';
    const toAddress = searchParams.get('toAddress') || fromAddress; // ✅ For cross-chain, use toAddress if provided
    const slippage = parseFloat(searchParams.get('slippage') || '0.03');
    const order = (searchParams.get('order') || 'RECOMMENDED') as 'RECOMMENDED' | 'CHEAPEST' | 'FASTEST';

    if (!fromToken || !toToken || !fromAmount || !fromAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: fromToken, toToken, fromAmount, fromAddress' },
        { status: 400 }
      );
    }
    
    // ✅ For cross-chain swaps, toAddress is recommended (destination address on target chain)
    // If not provided, LI.FI will use fromAddress, but explicit toAddress is better
    logger.log('📊 Quote request details:', {
      fromChain,
      toChain,
      isCrossChain: fromChain !== toChain,
      fromAddress: fromAddress ? fromAddress.substring(0, 10) + '...' : 'missing',
      toAddress: toAddress ? toAddress.substring(0, 10) + '...' : 'using fromAddress',
    });

    const lifiApiKey = process.env.LIFI_API_KEY;

    logger.log('📊 Fetching Li.Fi quote via API route:', {
      fromChain,
      toChain,
      fromToken: fromToken && fromToken.length > 10 ? fromToken.substring(0, 10) + '...' : fromToken || 'undefined',
      toToken: toToken && toToken.length > 10 ? toToken.substring(0, 10) + '...' : toToken || 'undefined',
      fromAmount,
      fromAddress: fromAddress ? fromAddress.substring(0, 10) + '...' : 'undefined',
    });

    try {
      // ✅ CRITICAL: LiFiService.getQuote() handles 'native' conversion internally
      // But we also log what we're sending for debugging
      logger.log('📊 Calling LiFiService.getQuote with:', {
        fromChain,
        toChain,
        fromToken: fromToken === 'native' ? 'native (will be converted)' : fromToken.substring(0, 20) + '...',
        toToken: toToken === 'native' ? 'native (will be converted)' : toToken.substring(0, 20) + '...',
        fromAmount,
      });
      
      const quote = await LiFiService.getQuote(
        fromChain,
        toChain,
        fromToken, // Can be 'native' - LiFiService will convert it
        toToken,   // Can be 'native' - LiFiService will convert it
        fromAmount,
        fromAddress,
        slippage,
        order,
        lifiApiKey,
        toAddress // ✅ Pass toAddress for cross-chain swaps
      );

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
      
      if (error instanceof LiFiQuoteError) {
        return NextResponse.json(
          {
            error: error.message || 'Failed to fetch quote from Li.Fi',
            details: error.details || 'No additional details available',
            hint: isSolanaInvolved
              ? 'Solana routes require supported token pairs and sufficient amount.'
              : 'Please check token pair availability and minimum route amount.',
          },
          { status: error.httpStatus && error.httpStatus >= 400 && error.httpStatus < 500 ? error.httpStatus : 400 }
        );
      }

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

