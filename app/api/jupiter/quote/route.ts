import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { JupiterService } from '@/lib/jupiter-service';

export const dynamic = 'force-dynamic';

/**
 * Jupiter Quote API Route
 * 
 * For Solana same-chain swaps, we use Jupiter instead of Li.Fi
 * Li.Fi is used for cross-chain swaps, but Jupiter is better for Solana → Solana
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const inputMint = searchParams.get('inputMint') || '';
    const outputMint = searchParams.get('outputMint') || '';
    const amount = searchParams.get('amount') || '0';
    const slippageBps = parseInt(searchParams.get('slippageBps') || '50'); // 0.5% default
    const onlyDirectRoutes = searchParams.get('onlyDirectRoutes') === 'true';

    if (!inputMint || !outputMint || !amount || amount === '0') {
      return NextResponse.json(
        { error: 'Missing required parameters: inputMint, outputMint, amount' },
        { status: 400 }
      );
    }

    // Convert 'native' to wrapped SOL address
    const normalizedInputMint = JupiterService.isNativeSOL(inputMint)
      ? JupiterService.getNativeSOLAddress()
      : inputMint;
    const normalizedOutputMint = JupiterService.isNativeSOL(outputMint)
      ? JupiterService.getNativeSOLAddress()
      : outputMint;

    logger.log('🪐 Fetching Jupiter quote via API route:', {
      inputMint: normalizedInputMint.substring(0, 10) + '...',
      outputMint: normalizedOutputMint.substring(0, 10) + '...',
      amount,
      slippageBps,
    });

    try {
      const quote = await JupiterService.getQuote(
        normalizedInputMint,
        normalizedOutputMint,
        amount,
        slippageBps,
        onlyDirectRoutes
      );

      if (!quote) {
        logger.error('❌ Jupiter returned null quote');
        return NextResponse.json(
          { error: 'Failed to fetch quote from Jupiter. Please check if the token pair is supported.' },
          { status: 500 }
        );
      }

      logger.log('✅ Jupiter quote received via API route');
      return NextResponse.json({ success: true, quote });
    } catch (error: any) {
      logger.error('❌ Jupiter quote error in API route:', {
        error: error.message,
        stack: error.stack,
        inputMint: normalizedInputMint,
        outputMint: normalizedOutputMint,
      });
      return NextResponse.json(
        { 
          error: 'Failed to fetch quote from Jupiter',
          details: error.message || 'Unknown error',
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    logger.error('Jupiter quote error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote', details: error.message },
      { status: 500 }
    );
  }
}

