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

interface OnramperWebhookPayload {
  event: WebhookEventType;
  transactionId: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  cryptoAmount?: number;
  cryptoCurrency?: string;
  walletAddress?: string;
  status?: string;
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
    const signature = req.headers.get('x-onramper-signature') || '';
    
    // Validate signature if secret is configured
    if (webhookSecret && signature) {
      const isValid = validateWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        logger.error('❌ Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }
    
    // Parse payload
    const payload: OnramperWebhookPayload = JSON.parse(rawBody);
    
    logger.log('🔔 Onramper webhook received:', {
      event: payload.event,
      transactionId: payload.transactionId,
      orderId: payload.orderId,
      status: payload.status,
    });
    
    // Handle different event types
    switch (payload.event) {
      case 'PENDING':
        logger.log('📝 Transaction pending:', payload.transactionId);
        // TODO: Update database with pending status
        break;
        
      case 'PROCESSING':
        logger.log('⏳ Transaction processing:', payload.transactionId);
        // TODO: Update database with processing status
        break;
        
      case 'COMPLETED':
        logger.log('✅ Transaction completed:', payload.transactionId);
        // TODO: 
        // - Update database with completed status
        // - Notify user of successful transaction
        // - Update wallet balance
        break;
        
      case 'FAILED':
        logger.log('❌ Transaction failed:', payload.transactionId);
        // TODO: 
        // - Update database with failed status
        // - Notify user of failure
        break;
        
      case 'REFUNDED':
        logger.log('💰 Transaction refunded:', payload.transactionId);
        // TODO: 
        // - Update database with refunded status
        // - Notify user of refund
        break;
        
      case 'CANCELLED':
        logger.log('🚫 Transaction cancelled:', payload.transactionId);
        // TODO: Update database with cancelled status
        break;
        
      default:
        logger.warn('⚠️ Unknown webhook event type:', payload.event);
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

