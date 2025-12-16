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
    const transaction = await LiFiService.getStepTransaction(
      step,
      lifiApiKey
    );

    if (!transaction) {
      return NextResponse.json(
        { error: 'Failed to get transaction data' },
        { status: 500 }
      );
    }

    logger.log('✅ Transaction data received via API route');
    return NextResponse.json({ success: true, transaction });

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

