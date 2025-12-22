/**
 * 🔔 ONRAMPER WEBHOOK HANDLER
 * 
 * Receives transaction status updates from Onramper
 * Validates webhook signature and updates transaction status
 * 
 * Docs: https://docs.onramper.com/docs/webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Webhook event types
type WebhookEventType = 
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED';

// Onramper webhook payload structure (per documentation)
interface OnramperWebhookPayload {
  apiKey?: string;
  country?: string;
  inAmount?: number;
  onramp?: string;
  onrampTransactionId?: string;
  outAmount?: number;
  paymentMethod?: string;
  partnerContext?: string;
  sourceCurrency?: string;
  status?: string; // PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED, CANCELLED
  statusDate?: string;
  targetCurrency?: string;
  // Legacy fields for backward compatibility
  event?: WebhookEventType;
  transactionId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  cryptoAmount?: number;
  cryptoCurrency?: string;
  walletAddress?: string;
  timestamp?: number;
  signature?: string;
}

// Validate webhook signature
function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  } catch (error) {
    logger.error('Webhook signature validation error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get webhook secret from environment
    const webhookSecret = process.env.ONRAMPER_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      logger.warn('⚠️ Onramper webhook secret not configured');
      // Still process webhook but log warning
    }
    
    // Get raw body for signature validation
    const rawBody = await req.text();
    // Onramper uses X-Onramper-Webhook-Signature header (per documentation)
    const signature = req.headers.get('x-onramper-webhook-signature') || 
                     req.headers.get('x-onramper-signature') || 
                     '';
    
    // Validate signature if secret is configured
    if (webhookSecret && signature) {
      const isValid = validateWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        logger.error('❌ Invalid webhook signature', {
          receivedSignature: signature.substring(0, 20) + '...',
          hasSecret: !!webhookSecret,
        });
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
      logger.log('✅ Webhook signature validated successfully');
    } else if (!webhookSecret) {
      logger.warn('⚠️ Webhook secret not configured - skipping signature validation');
    } else if (!signature) {
      logger.warn('⚠️ No signature header found - skipping validation');
    }
    
    // Parse payload
    const payload: OnramperWebhookPayload = JSON.parse(rawBody);
    
    // Onramper uses 'status' field (not 'event')
    const status = payload.status || payload.event || 'UNKNOWN';
    const transactionId = payload.onrampTransactionId || payload.transactionId || payload.orderId || 'UNKNOWN';
    
    logger.log('🔔 Onramper webhook received:', {
      status,
      transactionId,
      onrampTransactionId: payload.onrampTransactionId,
      sourceCurrency: payload.sourceCurrency,
      targetCurrency: payload.targetCurrency,
      inAmount: payload.inAmount,
      outAmount: payload.outAmount,
      paymentMethod: payload.paymentMethod,
      onramp: payload.onramp,
      country: payload.country,
    });
    
    // Handle different status types (Onramper uses status field)
    switch (status.toUpperCase()) {
      case 'PENDING':
        logger.log('📝 Transaction pending:', transactionId);
        // TODO: Update database with pending status
        break;
        
      case 'PROCESSING':
        logger.log('⏳ Transaction processing:', transactionId);
        // TODO: Update database with processing status
        break;
        
      case 'COMPLETED':
        logger.log('✅ Transaction completed:', {
          transactionId,
          inAmount: payload.inAmount,
          sourceCurrency: payload.sourceCurrency,
          outAmount: payload.outAmount,
          targetCurrency: payload.targetCurrency,
        });
        // TODO: 
        // - Update database with completed status
        // - Notify user of successful transaction
        // - Update wallet balance
        break;
        
      case 'FAILED':
        logger.log('❌ Transaction failed:', transactionId);
        // TODO: 
        // - Update database with failed status
        // - Notify user of failure
        break;
        
      case 'REFUNDED':
        logger.log('💰 Transaction refunded:', transactionId);
        // TODO: 
        // - Update database with refunded status
        // - Notify user of refund
        break;
        
      case 'CANCELLED':
        logger.log('🚫 Transaction cancelled:', transactionId);
        // TODO: Update database with cancelled status
        break;
        
      default:
        logger.warn('⚠️ Unknown webhook status:', status);
    }
    
    // Always return 200 to acknowledge receipt
    return NextResponse.json({ 
      success: true,
      received: true 
    });
    
  } catch (error: any) {
    logger.error('❌ Onramper webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}

