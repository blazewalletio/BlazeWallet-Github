// MoonPay Webhook Handler
// POST /api/moonpay/webhook
// Handles transaction status updates from MoonPay

import { NextRequest, NextResponse } from 'next/server';
import { MoonPayService } from '@/lib/moonpay-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-moonpay-signature') || '';

    // MoonPay supports two types of webhook secrets:
    // 1. Per-webhook "Signing Secret" (has priority) - MOONPAY_WEBHOOK_SECRET
    // 2. Global "Webhook signing key" - MOONPAY_WEBHOOK_SIGNING_KEY
    // 3. Fallback to secret key - MOONPAY_SECRET_KEY
    const webhookSecret = 
      process.env.MOONPAY_WEBHOOK_SECRET || // Per-webhook signing secret (priority)
      process.env.MOONPAY_WEBHOOK_SIGNING_KEY || // Global webhook signing key
      process.env.MOONPAY_SECRET_KEY; // Fallback to secret key
    
    if (!webhookSecret) {
      logger.error('No MoonPay webhook secret configured. Set MOONPAY_WEBHOOK_SECRET, MOONPAY_WEBHOOK_SIGNING_KEY, or MOONPAY_SECRET_KEY');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Verify signature
    const isValid = MoonPayService.verifyWebhookSignature(body, signature, webhookSecret);
    if (!isValid) {
      logger.error('Invalid MoonPay webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const data = JSON.parse(body);
    
    logger.log('MoonPay webhook received:', {
      type: data.type,
      status: data.data?.status,
      transactionId: data.data?.id,
    });

    // Handle different webhook types
    switch (data.type) {
      case 'transaction_updated':
        // Transaction status changed
        const transaction = data.data;
        
        // TODO: Update transaction in database
        // TODO: Notify user of status change
        // TODO: Update wallet balance if completed
        
        logger.log('Transaction updated:', {
          id: transaction.id,
          status: transaction.status,
          walletAddress: transaction.walletAddress,
          currencyCode: transaction.currencyCode,
          baseCurrencyAmount: transaction.baseCurrencyAmount,
          quoteCurrencyAmount: transaction.quoteCurrencyAmount,
        });

        // Status can be: pending, waitingPayment, waitingAuthorization, 
        // processingPayment, pendingRefund, completed, failed, expired
        if (transaction.status === 'completed') {
          // Transaction completed successfully
          logger.log('✅ Transaction completed:', transaction.id);
        } else if (transaction.status === 'failed') {
          // Transaction failed
          logger.error('❌ Transaction failed:', transaction.id);
        }
        break;

      default:
        logger.log('Unknown webhook type:', data.type);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('MoonPay webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

