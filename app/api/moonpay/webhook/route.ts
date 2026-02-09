// MoonPay Webhook Handler
// POST /api/moonpay/webhook
// Handles transaction status updates from MoonPay

import { NextRequest, NextResponse } from 'next/server';
import { MoonPayService } from '@/lib/moonpay-service';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

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
        
        logger.log('Transaction updated:', {
          id: transaction.id,
          status: transaction.status,
          walletAddress: transaction.walletAddress,
          currencyCode: transaction.currencyCode,
          baseCurrencyAmount: transaction.baseCurrencyAmount,
          quoteCurrencyAmount: transaction.quoteCurrencyAmount,
        });

        // Map MoonPay status to our status format
        const statusMap: Record<string, string> = {
          'pending': 'pending',
          'waitingPayment': 'pending',
          'waitingAuthorization': 'pending',
          'processingPayment': 'processing',
          'pendingRefund': 'processing',
          'completed': 'completed',
          'failed': 'failed',
          'expired': 'failed',
        };
        
        const normalizedStatus = statusMap[transaction.status] || transaction.status.toLowerCase();
        
        // Extract user ID from walletAddress or externalTransactionId if available
        let userId: string | null = null;
        if (transaction.walletAddress) {
          // Try to find user by wallet address (you may need to adjust this based on your schema)
          // For now, we'll try to extract from externalTransactionId if it contains userId
          if (transaction.externalTransactionId) {
            const contextMatch = transaction.externalTransactionId.match(/userId:([a-f0-9-]+)/i);
            if (contextMatch) {
              userId = contextMatch[1];
            }
          }
        }
        
        // Update database with transaction status
        try {
          const transactionData: any = {
            onramp_transaction_id: transaction.id,
            provider: 'moonpay',
            status: normalizedStatus,
            status_updated_at: new Date().toISOString(),
            provider_data: transaction,
            updated_at: new Date().toISOString(),
          };
          
          // Add optional fields if available
          if (transaction.baseCurrencyAmount) transactionData.fiat_amount = transaction.baseCurrencyAmount;
          if (transaction.baseCurrencyCode) transactionData.fiat_currency = transaction.baseCurrencyCode;
          if (transaction.quoteCurrencyAmount) transactionData.crypto_amount = transaction.quoteCurrencyAmount;
          if (transaction.currencyCode) transactionData.crypto_currency = transaction.currencyCode;
          if (transaction.walletAddress) transactionData.wallet_address = transaction.walletAddress;
          if (userId) transactionData.user_id = userId;
          
          // Try to find existing transaction
          const { data: existingTx, error: findError } = await supabase
            .from('onramp_transactions')
            .select('id, user_id')
            .eq('onramp_transaction_id', transaction.id)
            .eq('provider', 'moonpay')
            .maybeSingle();
          
          if (findError && findError.code !== 'PGRST116') {
            logger.error('❌ Error finding MoonPay transaction:', findError);
          }
          
          // If we found an existing transaction, use its user_id
          if (existingTx && (existingTx as any).user_id && !userId) {
            transactionData.user_id = (existingTx as any).user_id;
          }
          
          // Only proceed if we have a user_id
          if (transactionData.user_id) {
            const { error: upsertError } = await supabase
              .from('onramp_transactions')
              .upsert(transactionData, {
                onConflict: 'onramp_transaction_id,provider',
              });
            
            if (upsertError) {
              logger.error('❌ Error updating MoonPay transaction in database:', upsertError);
            } else {
              logger.log(`✅ MoonPay transaction ${transaction.id} updated in database with status: ${normalizedStatus}`);
            }
          } else {
            logger.warn('⚠️ No user_id found for MoonPay transaction, skipping database update');
          }
        } catch (dbError: any) {
          logger.error('❌ Database update error for MoonPay:', dbError);
        }

        // Status can be: pending, waitingPayment, waitingAuthorization, 
        // processingPayment, pendingRefund, completed, failed, expired
        if (transaction.status === 'completed') {
          // Transaction completed successfully
          logger.log('✅ Transaction completed:', transaction.id);
          // Update user preferences if transaction completed
          if (userId) {
            try {
              const { UserOnRampPreferencesService } = await import('@/lib/user-onramp-preferences');
              await UserOnRampPreferencesService.updateAfterTransaction(userId, transaction.id);
            } catch (prefError: any) {
              logger.error('❌ Error updating user preferences:', prefError);
            }
          }
        } else if (transaction.status === 'failed' || transaction.status === 'expired') {
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

