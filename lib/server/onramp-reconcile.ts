import { logger } from '@/lib/logger';
import { OnramperService } from '@/lib/onramper-service';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { dispatchNotification } from '@/lib/server/notification-dispatcher';

type ReconcileTargetStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';

interface OnrampRow {
  id: string;
  user_id: string;
  onramp_transaction_id: string;
  provider: string;
  status: string;
  created_at: string;
  updated_at: string;
  provider_data?: any;
}

export interface OnrampReconcileOptions {
  userId?: string;
  maxRows?: number;
  includeFresh?: boolean;
}

export interface OnrampReconcileResult {
  checked: number;
  updated: number;
  completed: number;
  failed: number;
  cancelled: number;
  processing: number;
  pending: number;
  timedOut: number;
  skipped: number;
  errors: Array<{ transactionId: string; reason: string }>;
}

const RECONCILE_ELIGIBLE_AFTER_MS = 10 * 60 * 1000;
const PENDING_TIMEOUT_MS = 2 * 60 * 60 * 1000;

function normalizeOnrampStatus(raw: string | null | undefined): ReconcileTargetStatus {
  const value = (raw || '').toLowerCase().trim();
  if (!value) return 'pending';

  if (['completed', 'success', 'succeeded', 'done'].includes(value)) return 'completed';
  if (['cancelled', 'canceled'].includes(value)) return 'cancelled';
  if (['refunded'].includes(value)) return 'refunded';
  if (['failed', 'error', 'expired', 'declined', 'rejected'].includes(value)) return 'failed';
  if (
    ['processing', 'in_progress', 'pending_refund', 'processingpayment', 'executing', 'confirming'].includes(value)
  ) {
    return 'processing';
  }
  return 'pending';
}

export async function reconcileOnrampTransactions(options: OnrampReconcileOptions = {}): Promise<OnrampReconcileResult> {
  const supabaseAdmin = getSupabaseAdmin();
  const maxRows = Math.max(1, Math.min(500, options.maxRows ?? 100));
  const includeFresh = !!options.includeFresh;

  const result: OnrampReconcileResult = {
    checked: 0,
    updated: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    processing: 0,
    pending: 0,
    timedOut: 0,
    skipped: 0,
    errors: [],
  };

  const reconcileBeforeIso = new Date(Date.now() - RECONCILE_ELIGIBLE_AFTER_MS).toISOString();
  let query = supabaseAdmin
    .from('onramp_transactions')
    .select('id,user_id,onramp_transaction_id,provider,status,created_at,updated_at,provider_data')
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: true })
    .limit(maxRows);

  if (!includeFresh) {
    query = query.lte('created_at', reconcileBeforeIso);
  }
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }

  const { data: rows, error: fetchError } = await query;
  if (fetchError) {
    logger.error('❌ [OnrampReconcile] Failed to fetch rows:', fetchError);
    result.errors.push({ transactionId: 'query', reason: fetchError.message || 'fetch_failed' });
    return result;
  }

  const pendingRows = (rows || []) as OnrampRow[];
  if (pendingRows.length === 0) return result;

  for (const row of pendingRows) {
    result.checked += 1;
    const now = Date.now();
    const createdAtMs = Date.parse(row.created_at);
    const ageMs = Number.isFinite(createdAtMs) ? now - createdAtMs : 0;

    try {
      let nextStatus: ReconcileTargetStatus | null = null;
      const patch: Record<string, any> = {
        updated_at: new Date().toISOString(),
        provider_data: {
          ...(row.provider_data || {}),
          lifecycle: {
            ...((row.provider_data || {}).lifecycle || {}),
            last_reconciled_at: new Date().toISOString(),
            source: 'reconcile',
          },
        },
      };

      const providerTx = await OnramperService.getTransaction(row.onramp_transaction_id);
      if (providerTx) {
        const normalized = normalizeOnrampStatus(providerTx.status);
        nextStatus = normalized;
        patch.provider = (providerTx.onramp || row.provider || 'onramper').toLowerCase();
        patch.status_updated_at = new Date().toISOString();
        patch.fiat_amount = providerTx.inAmount ?? row.provider_data?.inAmount ?? null;
        patch.fiat_currency = providerTx.sourceCurrency ?? row.provider_data?.sourceCurrency ?? null;
        patch.crypto_amount = providerTx.outAmount ?? row.provider_data?.outAmount ?? null;
        patch.crypto_currency = providerTx.targetCurrency ?? row.provider_data?.targetCurrency ?? null;
        patch.payment_method = providerTx.paymentMethod ?? row.provider_data?.paymentMethod ?? null;
        patch.wallet_address = providerTx.walletAddress ?? row.provider_data?.walletAddress ?? null;
        patch.provider_data = {
          ...patch.provider_data,
          last_provider_status: providerTx.status,
          onrampTransactionId: providerTx.onrampTransactionId || row.onramp_transaction_id,
        };
      } else if (ageMs > PENDING_TIMEOUT_MS) {
        nextStatus = 'failed';
        patch.status_updated_at = new Date().toISOString();
        patch.provider_data = {
          ...patch.provider_data,
          lifecycle: {
            ...(patch.provider_data.lifecycle || {}),
            timeout_reason: 'timeout_no_provider_confirmation',
          },
          failure_reason: 'timeout_no_provider_confirmation',
        };
        result.timedOut += 1;
      }

      if (!nextStatus) {
        result.skipped += 1;
        continue;
      }

      const previousStatus = (row.status || '').toLowerCase();
      patch.status = nextStatus;
      const { error: updateError } = await supabaseAdmin
        .from('onramp_transactions')
        .update(patch)
        .eq('id', row.id);
      if (updateError) {
        throw updateError;
      }

      result.updated += 1;
      if (nextStatus === 'completed') result.completed += 1;
      else if (nextStatus === 'failed') result.failed += 1;
      else if (nextStatus === 'cancelled') result.cancelled += 1;
      else if (nextStatus === 'processing') result.processing += 1;
      else result.pending += 1;

      if (previousStatus !== nextStatus) {
        try {
          let title = 'Buy update';
          let message = `Your purchase status is now ${nextStatus}.`;
          if (nextStatus === 'processing') {
            title = 'Buy processing';
            message = 'Your purchase is being processed.';
          } else if (nextStatus === 'completed') {
            title = 'Buy completed';
            message = 'Your purchase completed successfully.';
          } else if (nextStatus === 'failed') {
            title = 'Buy failed';
            message = 'Your purchase failed. Please check provider details.';
          } else if (nextStatus === 'cancelled') {
            title = 'Buy cancelled';
            message = 'Your purchase was cancelled.';
          } else if (nextStatus === 'refunded') {
            title = 'Buy refunded';
            message = 'Your purchase was refunded by the provider.';
          } else if (nextStatus === 'pending') {
            title = 'Buy pending';
            message = 'Your purchase is pending provider confirmation.';
          }

          await dispatchNotification({
            userId: row.user_id,
            supabaseUserId: row.user_id,
            type: nextStatus === 'failed' ? 'transaction_failed' : 'transaction_executed',
            title,
            message,
            data: {
              provider: row.provider,
              transactionId: row.onramp_transaction_id,
              status: nextStatus,
              url: '/?open=purchase-history',
            },
          });
        } catch (notifyError) {
          logger.warn('⚠️ [OnrampReconcile] Failed to dispatch notification:', notifyError);
        }
      }
    } catch (error: any) {
      logger.error('❌ [OnrampReconcile] Failed transaction reconciliation:', {
        tx: row.onramp_transaction_id,
        error: error?.message,
      });
      result.errors.push({
        transactionId: row.onramp_transaction_id,
        reason: error?.message || 'reconcile_failed',
      });
    }
  }

  return result;
}

