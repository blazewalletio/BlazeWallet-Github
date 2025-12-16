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
    
    // ✅ CRITICAL: Solana chain ID must remain as string "1151111081099710"
    // For EVM chains, convert to number. For Solana, keep as string.
    const SOLANA_CHAIN_ID = '1151111081099710';
    const fromChain = fromChainParam === SOLANA_CHAIN_ID 
      ? SOLANA_CHAIN_ID 
      : (/^\d+$/.test(fromChainParam) ? parseInt(fromChainParam) : fromChainParam);
    const toChain = toChainParam === SOLANA_CHAIN_ID 
      ? SOLANA_CHAIN_ID 
      : (/^\d+$/.test(toChainParam) ? parseInt(toChainParam) : toChainParam);
    
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

      if (!quote) {
        logger.error('❌ Li.Fi returned null quote', {
          fromChain,
          toChain,
          fromToken: fromToken === 'native' ? 'native' : fromToken.substring(0, 20),
          toToken: toToken.substring(0, 20),
          fromAmount,
        });
        return NextResponse.json(
          { 
            error: 'Failed to fetch quote from Li.Fi. Please check if the token pair is supported.',
            details: 'The LI.FI API returned null. Check server logs for more details.'
          },
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

