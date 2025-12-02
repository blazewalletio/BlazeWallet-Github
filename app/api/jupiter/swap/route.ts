import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { JupiterService } from '@/lib/jupiter-service';

export const dynamic = 'force-dynamic';

/**
 * Jupiter Swap Transaction API Route
 * 
 * Gets the swap transaction data from Jupiter
 */
export async function POST(req: NextRequest) {
  try {
    const { quote, userPublicKey, wrapUnwrapSOL, feeAccount, asLegacyTransaction } = await req.json();

    if (!quote || !userPublicKey) {
      return NextResponse.json(
        { error: 'Missing required parameters: quote, userPublicKey' },
        { status: 400 }
      );
    }

    logger.log('🪐 Getting Jupiter swap transaction via API route:', {
      userPublicKey: userPublicKey.substring(0, 10) + '...',
    });

    const swapTransaction = await JupiterService.getSwapTransaction(
      quote,
      userPublicKey,
      wrapUnwrapSOL ?? true,
      feeAccount,
      asLegacyTransaction ?? false
    );

    if (!swapTransaction) {
      return NextResponse.json(
        { error: 'Failed to get swap transaction from Jupiter' },
        { status: 500 }
      );
    }

    logger.log('✅ Jupiter swap transaction received via API route');
    return NextResponse.json({ success: true, swapTransaction });
  } catch (error: any) {
    logger.error('❌ Jupiter swap transaction error in API route:', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { 
        error: 'Failed to get swap transaction from Jupiter',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

