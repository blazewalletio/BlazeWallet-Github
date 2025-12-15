import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { OnramperService } from '@/lib/onramper-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const {
      fiatAmount,
      fiatCurrency,
      cryptoCurrency,
      walletAddress,
      paymentMethod,
    } = await req.json();

    if (!fiatAmount || !fiatCurrency || !cryptoCurrency || !walletAddress || !paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // CRITICAL: Trim API key to remove any whitespace/newlines  
    const onramperApiKey = process.env.ONRAMPER_API_KEY?.trim();
    if (!onramperApiKey) {
      logger.error('ONRAMPER_API_KEY is not set in environment variables.');
      return NextResponse.json(
        { 
          error: 'Onramper not configured', 
          message: 'Please add ONRAMPER_API_KEY to environment variables. The buy feature requires an Onramper API key to process transactions.',
          requiresApiKey: true
        },
        { status: 503 }
      );
    }

    logger.log('📊 Creating Onramper transaction:', {
      fiatAmount,
      fiatCurrency,
      cryptoCurrency,
      walletAddress: walletAddress.substring(0, 10) + '...',
      paymentMethod,
    });

    // Create transaction via Onramper
    let transaction = null;
    try {
      transaction = await OnramperService.createTransaction(
        parseFloat(fiatAmount),
        fiatCurrency,
        cryptoCurrency,
        walletAddress,
        paymentMethod,
        onramperApiKey
      );
    } catch (transactionError: any) {
      logger.error('❌ Onramper createTransaction error:', {
        error: transactionError.message,
        stack: transactionError.stack,
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
        paymentMethod,
      });
      return NextResponse.json(
        { 
          error: 'Failed to create transaction with Onramper',
          details: transactionError.message 
        },
        { status: 500 }
      );
    }

    if (!transaction) {
      logger.error('❌ Onramper createTransaction returned null - check server logs for Onramper API error details');
      return NextResponse.json(
        { 
          error: 'Failed to create transaction with Onramper - no transaction returned',
          message: 'The Onramper API did not return a transaction. Please check the server logs for detailed error information from Onramper.',
        },
        { status: 500 }
      );
    }

    logger.log('✅ Onramper transaction created:', {
      transactionId: transaction.transactionId,
      status: transaction.status,
    });
    return NextResponse.json({ success: true, transaction });

  } catch (error: any) {
    logger.error('Onramper create-transaction error:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction', details: error.message },
      { status: 500 }
    );
  }
}

