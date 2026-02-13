import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      chainKey,
      txHash,
      transactionType = 'send',
      direction,
      fromAddress,
      toAddress,
      tokenSymbol,
      tokenAddress,
      tokenDecimals = 18,
      isNative = false,
      amount,
      amountUSD,
      gasUsed,
      gasPrice,
      gasCostUSD,
      status = 'confirmed',
      blockNumber,
      timestamp,
      metadata = {}
    } = body;

    // Validation
    if (!userId || !chainKey || !txHash || !direction || !fromAddress || !toAddress || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Primary path: database RPC (kept for backwards compatibility)
    const { data, error } = await supabaseAdmin.rpc('track_user_transaction', {
      p_user_id: userId,
      p_chain_key: chainKey,
      p_tx_hash: txHash,
      p_transaction_type: transactionType,
      p_direction: direction,
      p_from_address: fromAddress,
      p_to_address: toAddress,
      p_token_symbol: tokenSymbol || null,
      p_token_address: tokenAddress || null,
      p_token_decimals: tokenDecimals,
      p_is_native: isNative,
      p_amount: amount,
      p_amount_usd: amountUSD || null,
      p_gas_used: gasUsed || null,
      p_gas_price: gasPrice || null,
      p_gas_cost_usd: gasCostUSD || null,
      p_status: status,
      p_block_number: blockNumber || null,
      p_timestamp: timestamp || new Date().toISOString(),
      p_metadata: metadata
    });

    if (!error) {
      logger.log(`✅ Transaction tracked: ${txHash} (${direction} ${amountUSD ? `$${amountUSD}` : ''})`);
      return NextResponse.json({
        success: true,
        transactionId: data,
        method: 'rpc',
      });
    }

    // Fallback path: direct upsert when RPC is unavailable/broken.
    // Important: This endpoint is best-effort telemetry and should never break UX.
    logger.warn('⚠️ track_user_transaction RPC failed, falling back to direct upsert:', error);

    const parsedAmount = Number(amount);
    const parsedAmountUSD = amountUSD === undefined || amountUSD === null ? null : Number(amountUSD);
    const parsedGasUsed = gasUsed === undefined || gasUsed === null ? null : Number(gasUsed);
    const parsedGasPrice = gasPrice === undefined || gasPrice === null ? null : Number(gasPrice);
    const parsedGasCostUSD = gasCostUSD === undefined || gasCostUSD === null ? null : Number(gasCostUSD);
    const parsedBlockNumber = blockNumber === undefined || blockNumber === null ? null : Number(blockNumber);
    const parsedTokenDecimals = Number(tokenDecimals ?? 18);

    const { data: upsertData, error: upsertError } = await supabaseAdmin
      .from('user_transactions')
      .upsert(
        {
          user_id: userId,
          chain_key: chainKey,
          tx_hash: txHash,
          transaction_type: transactionType,
          direction,
          from_address: fromAddress,
          to_address: toAddress,
          token_symbol: tokenSymbol || null,
          token_address: tokenAddress || null,
          token_decimals: Number.isFinite(parsedTokenDecimals) ? parsedTokenDecimals : 18,
          is_native: Boolean(isNative),
          amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
          amount_usd: Number.isFinite(parsedAmountUSD as number) ? parsedAmountUSD : null,
          gas_used: Number.isFinite(parsedGasUsed as number) ? parsedGasUsed : null,
          gas_price: Number.isFinite(parsedGasPrice as number) ? parsedGasPrice : null,
          gas_cost_usd: Number.isFinite(parsedGasCostUSD as number) ? parsedGasCostUSD : null,
          status,
          block_number: Number.isFinite(parsedBlockNumber as number) ? parsedBlockNumber : null,
          timestamp: timestamp || new Date().toISOString(),
          metadata: metadata && typeof metadata === 'object' ? metadata : {},
        },
        { onConflict: 'user_id,chain_key,tx_hash' }
      )
      .select('id')
      .maybeSingle();

    if (upsertError) {
      logger.error('❌ Transaction tracking fallback upsert failed:', upsertError);
      return NextResponse.json({
        success: true,
        tracked: false,
        warning: 'tracking_temporarily_unavailable',
      });
    }

    logger.log(`✅ Transaction tracked via fallback upsert: ${txHash}`);
    return NextResponse.json({
      success: true,
      tracked: true,
      transactionId: upsertData?.id || null,
      method: 'upsert-fallback',
    });

  } catch (error: any) {
    logger.error('Transaction tracking API error:', error);
    return NextResponse.json({
      success: true,
      tracked: false,
      warning: 'tracking_exception',
    });
  }
}

// GET: Fetch user transaction stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Source of truth: aggregate from transaction rows to avoid stale/inflated counters.
    const { data: txRows, error: txError } = await supabaseAdmin
      .from('user_transactions')
      .select('direction, amount_usd, timestamp, status')
      .eq('user_id', userId)
      .neq('status', 'failed');

    // Include onramp purchases so the "Transactions" number reflects buy operations too.
    const { data: onrampRows, error: onrampError } = await supabaseAdmin
      .from('onramp_transactions')
      .select('status, fiat_amount, created_at, status_updated_at')
      .eq('user_id', userId)
      .in('status', ['pending', 'processing', 'completed']);

    if (txError) {
      logger.error('Failed to aggregate user_transactions stats:', txError);
    }
    if (onrampError) {
      logger.error('Failed to aggregate onramp_transactions stats:', onrampError);
    }

    // Fallback to legacy RPC if both row-based queries are unavailable.
    if (txError && onrampError) {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_user_transaction_stats', {
        p_user_id: userId
      });

      if (rpcError) {
        return NextResponse.json(
          { success: false, error: 'Failed to get stats' },
          { status: 500 }
        );
      }

      const legacy = rpcData && rpcData.length > 0 ? rpcData[0] : {
        total_transactions: 0,
        total_volume_usd: 0,
        total_sent: 0,
        total_received: 0,
        total_gas_spent: 0,
        last_transaction_at: null,
      };

      return NextResponse.json({
        success: true,
        stats: {
          ...legacy,
          sent_transactions: 0,
          received_transactions: 0,
          buy_transactions: 0,
          onchain_transactions: Number(legacy.total_transactions || 0),
          source: 'legacy_rpc_fallback',
        },
      });
    }

    const sentTransactions = (txRows || []).filter((row: any) => row.direction === 'sent').length;
    const receivedTransactions = (txRows || []).filter((row: any) => row.direction === 'received').length;
    const onchainTransactions = sentTransactions + receivedTransactions;
    const buyTransactions = (onrampRows || []).length;

    const totalSent = (txRows || []).reduce((sum: number, row: any) => {
      if (row.direction !== 'sent') return sum;
      return sum + (Number(row.amount_usd) || 0);
    }, 0);
    const totalReceived = (txRows || []).reduce((sum: number, row: any) => {
      if (row.direction !== 'received') return sum;
      return sum + (Number(row.amount_usd) || 0);
    }, 0);
    const totalBuy = (onrampRows || []).reduce((sum: number, row: any) => {
      return sum + (Number(row.fiat_amount) || 0);
    }, 0);

    const timestamps: number[] = [];
    for (const row of txRows || []) {
      const t = Date.parse(row.timestamp);
      if (!Number.isNaN(t)) timestamps.push(t);
    }
    for (const row of onrampRows || []) {
      const t = Date.parse(row.status_updated_at || row.created_at);
      if (!Number.isNaN(t)) timestamps.push(t);
    }

    const lastTransactionAt = timestamps.length > 0
      ? new Date(Math.max(...timestamps)).toISOString()
      : null;

    const stats = {
      total_transactions: onchainTransactions + buyTransactions,
      total_volume_usd: Number((totalSent + totalReceived + totalBuy).toFixed(2)),
      total_sent: Number(totalSent.toFixed(2)),
      total_received: Number(totalReceived.toFixed(2)),
      total_buy: Number(totalBuy.toFixed(2)),
      total_gas_spent: 0,
      last_transaction_at: lastTransactionAt,
      favorite_token: null,
      updated_at: new Date().toISOString(),
      sent_transactions: sentTransactions,
      received_transactions: receivedTransactions,
      buy_transactions: buyTransactions,
      onchain_transactions: onchainTransactions,
      source: 'row_aggregate',
    };

    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error: any) {
    logger.error('Transaction stats API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

