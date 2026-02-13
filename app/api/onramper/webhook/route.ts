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
import { trackEvent } from '@/lib/analytics';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import { getClientIP } from '@/lib/rate-limiter';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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

const WEBHOOK_TIMESTAMP_MAX_SKEW_MS = 10 * 60 * 1000;

function parseWebhookTimestamp(req: NextRequest, payload: OnramperWebhookPayload): number | null {
  const headerTimestamp =
    req.headers.get('x-onramper-webhook-timestamp') ||
    req.headers.get('x-onramper-timestamp');

  const raw = headerTimestamp || (typeof payload.timestamp === 'number' ? String(payload.timestamp) : payload.statusDate);
  if (!raw) return null;

  const numericTs = Number(raw);
  if (Number.isFinite(numericTs) && numericTs > 0) {
    // Accept both seconds and milliseconds.
    return numericTs < 1e12 ? numericTs * 1000 : numericTs;
  }

  const parsedDate = Date.parse(raw);
  return Number.isFinite(parsedDate) ? parsedDate : null;
}

// Validate webhook signature with multiple format support
function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Try hex format (most common)
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    
    // Compare with signature (try both hex and base64)
    const signatureHex = signature.toLowerCase();
    const signatureBase64 = Buffer.from(signature, 'base64').toString('hex');
    
    // Try hex comparison
    if (crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(signatureHex)
    )) {
      return true;
    }
    
    // Try base64 comparison
    if (crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(signatureBase64)
    )) {
      return true;
    }
    
    // Try direct comparison (in case signature is already hex)
    if (digest === signatureHex) {
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Webhook signature validation error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const clientIp = getClientIP(req.headers);
    const webhookRateKey = `onramper:webhook:${clientIp}`;
    const isWebhookAllowed = apiRateLimiter.check(webhookRateKey, 120, 60 * 1000);
    if (!isWebhookAllowed) {
      return NextResponse.json({ error: 'Too many webhook requests' }, { status: 429 });
    }

    // Get webhook secret from environment
    const webhookSecret = process.env.ONRAMPER_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      logger.error('❌ Onramper webhook secret not configured - rejecting webhook');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 503 }
      );
    }
    
    // Get raw body for signature validation
    const rawBody = await req.text();
    // Onramper uses X-Onramper-Webhook-Signature header (per documentation)
    const signature = req.headers.get('x-onramper-webhook-signature') || 
                     req.headers.get('x-onramper-signature') || 
                     '';
    
    if (!signature) {
      logger.error('❌ Missing webhook signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const isValid = validateWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      logger.error('❌ Invalid webhook signature', {
        receivedSignature: signature.substring(0, 20) + '...',
        signatureLength: signature.length,
        payloadPreview: rawBody.substring(0, 100),
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    logger.log('✅ Webhook signature validated successfully');
    
    // Parse payload
    const payload: OnramperWebhookPayload = JSON.parse(rawBody);
    const webhookTimestamp = parseWebhookTimestamp(req, payload);
    if (webhookTimestamp) {
      const skew = Math.abs(Date.now() - webhookTimestamp);
      if (skew > WEBHOOK_TIMESTAMP_MAX_SKEW_MS) {
        logger.error('❌ Webhook timestamp outside allowed skew', {
          skewMs: skew,
          maxSkewMs: WEBHOOK_TIMESTAMP_MAX_SKEW_MS,
        });
        return NextResponse.json({ error: 'Stale webhook timestamp' }, { status: 401 });
      }
    } else {
      logger.warn('⚠️ Webhook timestamp not provided; replay protection reduced to idempotency checks');
    }
    
    // Onramper uses 'status' field (not 'event')
    const status = payload.status || payload.event || 'UNKNOWN';
    const transactionId = payload.onrampTransactionId || payload.transactionId || payload.orderId || 'UNKNOWN';
    const provider = payload.onramp || 'unknown';
    
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
    
    // Extract user ID from partnerContext if available (format: "userId:xxx")
    let userId: string | null = null;
    if (payload.partnerContext) {
      const contextMatch = payload.partnerContext.match(/userId:([a-f0-9-]+)/i);
      if (contextMatch) {
        userId = contextMatch[1];
      }
    }
    
    // Update database with transaction status
    const normalizedStatus = status.toUpperCase();
    const statusLower = normalizedStatus.toLowerCase();
    const eventFingerprint = crypto
      .createHash('sha256')
      .update(`${provider.toLowerCase()}|${transactionId}|${statusLower}|${payload.statusDate || payload.timestamp || ''}`)
      .digest('hex');
    
    try {
      // Upsert transaction record
      const transactionData: any = {
        onramp_transaction_id: transactionId,
        provider: provider.toLowerCase(),
        status: statusLower,
        status_updated_at: new Date().toISOString(),
        provider_data: payload,
        updated_at: new Date().toISOString(),
      };
      
      // Add optional fields if available
      if (payload.inAmount) transactionData.fiat_amount = payload.inAmount;
      if (payload.sourceCurrency) transactionData.fiat_currency = payload.sourceCurrency;
      if (payload.outAmount) transactionData.crypto_amount = payload.outAmount;
      if (payload.targetCurrency) transactionData.crypto_currency = payload.targetCurrency;
      if (payload.paymentMethod) transactionData.payment_method = payload.paymentMethod;
      if (payload.walletAddress) transactionData.wallet_address = payload.walletAddress;
      if (userId) transactionData.user_id = userId;
      
      // Try to find existing transaction or create new one
      const { data: existingTx, error: findError } = await supabaseAdmin
        .from('onramp_transactions')
        .select('id, user_id, status, provider_data')
        .eq('onramp_transaction_id', transactionId)
        .eq('provider', provider.toLowerCase())
        .maybeSingle();
      
      if (findError && findError.code !== 'PGRST116') {
        logger.error('❌ Error finding transaction:', findError);
      }
      
      const existingFingerprint = (existingTx as any)?.provider_data?.eventFingerprint;
      if (existingFingerprint && existingFingerprint === eventFingerprint) {
        logger.log('ℹ️ Duplicate webhook event ignored (idempotent)', {
          transactionId,
          provider,
          status: statusLower,
        });
        return NextResponse.json({
          success: true,
          received: true,
          duplicate: true,
        });
      }

      // If we found an existing transaction, use its user_id
      if (existingTx && (existingTx as any).user_id && !userId) {
        transactionData.user_id = (existingTx as any).user_id;
      }
      
      // Only proceed if we have a user_id
      if (transactionData.user_id) {
        transactionData.provider_data = {
          ...payload,
          eventFingerprint,
        };
        const { error: upsertError } = await supabaseAdmin
          .from('onramp_transactions')
          .upsert(transactionData, {
            onConflict: 'onramp_transaction_id,provider',
          });
        
        if (upsertError) {
          logger.error('❌ Error updating transaction in database:', upsertError);
        } else {
          logger.log(`✅ Transaction ${transactionId} updated in database with status: ${statusLower}`);
        }
      } else {
        logger.warn('⚠️ No user_id found for transaction, skipping database update');
      }
    } catch (dbError: any) {
      logger.error('❌ Database update error:', dbError);
    }
    
    // Handle different status types (Onramper uses status field)
    switch (normalizedStatus) {
      case 'PENDING':
        logger.log('📝 Transaction pending:', transactionId);
        // Track pending onramp purchase
        if (userId) {
          await trackEvent(userId, 'onramp_purchase_pending', {
            transaction_id: transactionId,
            provider,
            fiat_amount: payload.inAmount,
            fiat_currency: payload.sourceCurrency,
            crypto_amount: payload.outAmount,
            crypto_currency: payload.targetCurrency,
            payment_method: payload.paymentMethod,
          });
        }
        break;
        
      case 'PROCESSING':
        logger.log('⏳ Transaction processing:', transactionId);
        // Track processing onramp purchase
        if (userId) {
          await trackEvent(userId, 'onramp_purchase_processing', {
            transaction_id: transactionId,
            provider,
            fiat_amount: payload.inAmount,
            fiat_currency: payload.sourceCurrency,
            crypto_amount: payload.outAmount,
            crypto_currency: payload.targetCurrency,
            payment_method: payload.paymentMethod,
          });
        }
        break;
        
      case 'COMPLETED':
        logger.log('✅ Transaction completed:', {
          transactionId,
          inAmount: payload.inAmount,
          sourceCurrency: payload.sourceCurrency,
          outAmount: payload.outAmount,
          targetCurrency: payload.targetCurrency,
        });
        // Track successful onramp purchase
        if (userId) {
          await trackEvent(userId, 'onramp_purchase_completed', {
            transaction_id: transactionId,
            provider,
            fiat_amount: payload.inAmount,
            fiat_currency: payload.sourceCurrency,
            crypto_amount: payload.outAmount,
            crypto_currency: payload.targetCurrency,
            payment_method: payload.paymentMethod,
            wallet_address: payload.walletAddress,
          });
        }
        // Update user preferences if transaction completed
        if (userId && provider) {
          try {
            const { UserOnRampPreferencesService } = await import('@/lib/user-onramp-preferences');
            await UserOnRampPreferencesService.updateAfterTransaction(userId, transactionId);
          } catch (prefError: any) {
            logger.error('❌ Error updating user preferences:', prefError);
          }
        }
        break;
        
      case 'FAILED':
        logger.log('❌ Transaction failed:', transactionId);
        // Track failed onramp purchase
        if (userId) {
          await trackEvent(userId, 'onramp_purchase_failed', {
            transaction_id: transactionId,
            provider,
            fiat_amount: payload.inAmount,
            fiat_currency: payload.sourceCurrency,
            crypto_currency: payload.targetCurrency,
            payment_method: payload.paymentMethod,
            failure_reason: (payload as any).failureReason || 'unknown',
          });
        }
        break;
        
      case 'REFUNDED':
        logger.log('💰 Transaction refunded:', transactionId);
        // Track refunded onramp purchase
        if (userId) {
          await trackEvent(userId, 'onramp_purchase_refunded', {
            transaction_id: transactionId,
            provider,
            fiat_amount: payload.inAmount,
            fiat_currency: payload.sourceCurrency,
          });
        }
        break;
        
      case 'CANCELLED':
        logger.log('🚫 Transaction cancelled:', transactionId);
        // Track cancelled onramp purchase
        if (userId) {
          await trackEvent(userId, 'onramp_purchase_cancelled', {
            transaction_id: transactionId,
            provider,
            fiat_amount: payload.inAmount,
            fiat_currency: payload.sourceCurrency,
          });
        }
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

