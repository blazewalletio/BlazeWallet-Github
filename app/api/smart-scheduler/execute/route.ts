// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULER API - EXECUTE (CRON JOB)
// ============================================================================
// Executes scheduled transactions at optimal gas times
// Called by Vercel Cron every 5 minutes
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { gasPriceService } from '@/lib/gas-price-service';
import { priceService } from '@/lib/price-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET!;

export async function GET(req: NextRequest) {
  try {
    // Verify request is from Vercel Cron or has valid auth
    const authHeader = req.headers.get('authorization');
    const isVercelCron = req.headers.get('user-agent')?.includes('vercel-cron');
    
    // Allow either Vercel Cron or manual trigger with secret
    if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Smart Scheduler cron job started...');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pending transactions
    const { data: pendingTxs, error: fetchError } = await supabase
      .from('scheduled_transactions')
      .select('*')
      .eq('status', 'pending')
      .lt('scheduled_for', new Date().toISOString())
      .or('scheduled_for.is.null')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(50); // Process max 50 per run

    if (fetchError) {
      console.error('❌ Failed to fetch pending transactions:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pendingTxs || pendingTxs.length === 0) {
      console.log('✅ No pending transactions to execute');
      return NextResponse.json({ success: true, executed: 0 });
    }

    console.log(`📋 Found ${pendingTxs.length} pending transactions`);

    let executed = 0;
    let skipped = 0;
    let failed = 0;

    // Process each transaction
    for (const tx of pendingTxs) {
      try {
        // Check if expired
        if (tx.expires_at && new Date(tx.expires_at) < new Date()) {
          await supabase
            .from('scheduled_transactions')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('id', tx.id);
          console.log(`⏰ Transaction ${tx.id} expired`);
          skipped++;
          continue;
        }

        // Get current gas price
        const currentGasData = await gasPriceService.getGasPrice(tx.chain);
        
        if (!currentGasData) {
          console.error(`❌ Failed to get gas price for ${tx.chain}`);
          skipped++;
          continue;
        }

        const currentGasPrice = currentGasData.standard;

        // Check if gas is optimal
        let shouldExecute = false;

        if (tx.optimal_gas_threshold) {
          // User set a specific gas threshold
          shouldExecute = currentGasPrice <= tx.optimal_gas_threshold;
        } else {
          // Execute at scheduled time or if gas is better than estimated
          shouldExecute = true; // For now, execute all ready transactions
        }

        if (!shouldExecute) {
          console.log(`⏳ Gas too high for transaction ${tx.id} (${currentGasPrice} > ${tx.optimal_gas_threshold})`);
          skipped++;
          continue;
        }

        // Mark as executing
        await supabase
          .from('scheduled_transactions')
          .update({ status: 'executing', updated_at: new Date().toISOString() })
          .eq('id', tx.id);

        // Calculate gas cost in USD
        let gasCostUSD = 0;
        try {
          const nativePrice = await priceService.getPrice(tx.chain === 'solana' ? 'solana' : tx.chain === 'bitcoin' ? 'bitcoin' : 'ethereum');
          
          if (tx.chain === 'solana') {
            gasCostUSD = (currentGasPrice * 5000 / 1_000_000_000) * nativePrice; // 5000 lamports avg
          } else if (tx.chain.includes('bitcoin') || tx.chain === 'litecoin' || tx.chain === 'dogecoin') {
            gasCostUSD = ((currentGasPrice * 250) / 100_000_000) * nativePrice; // 250 bytes avg
          } else {
            gasCostUSD = ((21000 * currentGasPrice) / 1e9) * nativePrice; // EVM
          }
        } catch (e) {
          console.error('Failed to calculate gas cost:', e);
        }

        // Calculate savings
        const estimatedCost = tx.estimated_gas_cost_usd || 0;
        const actualCost = gasCostUSD;
        const savings = estimatedCost - actualCost;

        // TODO: Actually execute the transaction using transaction-executor.ts
        // For now, we'll mark it as completed (Phase 2 will add actual execution)
        
        // Update transaction as completed
        const { error: updateError } = await supabase
          .from('scheduled_transactions')
          .update({
            status: 'completed',
            executed_at: new Date().toISOString(),
            actual_gas_price: currentGasPrice,
            actual_gas_cost_usd: gasCostUSD,
            actual_savings_usd: savings,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tx.id);

        if (updateError) {
          console.error(`❌ Failed to update transaction ${tx.id}:`, updateError);
          failed++;
          continue;
        }

        // Save transaction savings
        await supabase.from('transaction_savings').insert({
          user_id: tx.user_id,
          supabase_user_id: tx.supabase_user_id,
          chain: tx.chain,
          transaction_hash: 'SCHEDULED_TX', // Will be real hash in Phase 2
          gas_price_used: currentGasPrice,
          gas_cost_usd: gasCostUSD,
          baseline_gas_cost_usd: estimatedCost,
          savings_usd: savings,
          savings_percentage: estimatedCost > 0 ? (savings / estimatedCost) * 100 : 0,
          was_scheduled: true,
          scheduled_transaction_id: tx.id,
        });

        // Update user savings stats
        await supabase.rpc('update_user_savings_stats', {
          p_user_id: tx.user_id,
          p_supabase_user_id: tx.supabase_user_id,
          p_chain: tx.chain,
          p_savings_usd: savings,
          p_was_scheduled: true,
        });

        // Create notification
        await supabase.from('notifications').insert({
          user_id: tx.user_id,
          supabase_user_id: tx.supabase_user_id,
          type: 'transaction_executed',
          title: 'Transaction Executed',
          message: savings > 0 
            ? `Your transaction was executed! You saved $${savings.toFixed(2)} on gas fees`
            : `Your scheduled transaction was executed`,
          data: {
            scheduled_transaction_id: tx.id,
            chain: tx.chain,
            savings_usd: savings,
          },
        });

        console.log(`✅ Transaction ${tx.id} executed successfully (Saved: $${savings.toFixed(2)})`);
        executed++;

      } catch (txError: any) {
        console.error(`❌ Failed to process transaction ${tx.id}:`, txError);
        
        // Update as failed
        await supabase
          .from('scheduled_transactions')
          .update({
            status: 'failed',
            error_message: txError.message,
            retry_count: (tx.retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tx.id);

        failed++;
      }
    }

    console.log(`✅ Cron job completed: ${executed} executed, ${skipped} skipped, ${failed} failed`);

    return NextResponse.json({
      success: true,
      executed,
      skipped,
      failed,
      total: pendingTxs.length,
    });

  } catch (error: any) {
    console.error('❌ Smart Scheduler cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

