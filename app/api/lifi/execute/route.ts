import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { LiFiService } from '@/lib/lifi-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { step } = await req.json();

    if (!step) {
      return NextResponse.json(
        { error: 'Missing required parameter: step' },
        { status: 400 }
      );
    }

    const lifiApiKey = process.env.LIFI_API_KEY;

    logger.log('📝 Executing Li.Fi step via API route:', {
      stepId: step.id,
      tool: step.tool,
      type: step.type,
    });

    // ✅ According to LI.FI docs: POST /v1/advanced/stepTransaction
    // Requires full Step object (not route + stepIndex)
    // Returns Step object with transactionRequest populated
    const populatedStep = await LiFiService.getStepTransaction(
      step,
      lifiApiKey
    );

    if (!populatedStep) {
      return NextResponse.json(
        { error: 'Failed to get transaction data' },
        { status: 500 }
      );
    }

    logger.log('✅ Step transaction data received via API route');
    // Return the populated Step object (which has transactionRequest)
    return NextResponse.json({ success: true, transaction: populatedStep });

  } catch (error: any) {
    logger.error('❌ Li.Fi execute error in API route:', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { 
        error: 'Failed to execute Li.Fi transaction',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

