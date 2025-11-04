/**
 * 🔥 BLAZE WALLET - SMART SEND EXECUTION CRON JOB
 * 
 * Runs every 5 minutes to execute scheduled transactions
 * - Checks for ready transactions
 * - Validates gas prices
 * - Executes transactions on all 18 chains
 * - Sends notifications
 * - Tracks savings
 * 
 * Vercel Cron: every 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { gasPriceService } from '@/lib/gas-price-service';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Verify cron secret for security
const CRON_SECRET = process.env.CRON_SECRET || 'dev-secret-change-in-production';

export async function GET(req: NextRequest) {
  try {
    // Verify authorization
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      console.error('❌ Unauthorized cron attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('\n========================================');
    console.log('⏰ [CRON] SMART SEND EXECUTION JOB');
    console.log('========================================');
    console.log('🕐 Time:', new Date().toISOString());

    // Get all pending scheduled transactions
    const { data: pendingTxs, error: fetchError } = await supabase
      .from('scheduled_transactions')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .gt('expires_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('scheduled_for', { ascending: true })
      .limit(50); // Process max 50 per run

    if (fetchError) {
      throw new Error(`Failed to fetch pending transactions: ${fetchError.message}`);
    }

    console.log(`📊 Found ${pendingTxs?.length || 0} pending transactions`);

    if (!pendingTxs || pendingTxs.length === 0) {
      console.log('✅ No transactions to execute');
      console.log('========================================\n');
      return NextResponse.json({
        success: true,
        message: 'No transactions to execute',
        executed: 0,
      });
    }

    // Process each transaction
    let executed = 0;
    let failed = 0;
    let skipped = 0;

    for (const tx of pendingTxs) {
      try {
        console.log(`\n💫 Processing transaction ${tx.id}`);
        console.log(`   Chain: ${tx.chain}`);
        console.log(`   Amount: ${tx.amount} ${tx.token_symbol}`);
        console.log(`   To: ${tx.to_address}`);

        // Check current gas price
        const currentGas = await gasPriceService.getGasPrice(tx.chain);
        console.log(`   Current gas: ${currentGas.standard.toFixed(2)}`);

        // Check if gas is acceptable
        if (tx.optimal_gas_threshold && currentGas.standard > tx.optimal_gas_threshold) {
          console.log(`   ⏭️  Skipping - gas too high (${currentGas.standard} > ${tx.optimal_gas_threshold})`);
          
          // Check if we should expire it
          const maxWaitReached = new Date() > new Date(tx.expires_at);
          if (maxWaitReached) {
            await supabase
              .from('scheduled_transactions')
              .update({ status: 'expired', updated_at: new Date().toISOString() })
              .eq('id', tx.id);
            console.log(`   ⏱️  Transaction expired`);
          }
          
          skipped++;
          continue;
        }

        // Mark as executing
        await supabase
          .from('scheduled_transactions')
          .update({ status: 'executing', updated_at: new Date().toISOString() })
          .eq('id', tx.id);

        // Execute the transaction
        const result = await executeTransaction(tx, currentGas.standard);

        if (result.success) {
          // Update as completed
          await supabase
            .from('scheduled_transactions')
            .update({
              status: 'completed',
              executed_at: new Date().toISOString(),
              actual_gas_price: currentGas.standard,
              actual_gas_cost_usd: result.gasCostUSD || 0,
              actual_savings_usd: Math.max(0, tx.estimated_gas_cost_usd - (result.gasCostUSD || 0)),
              transaction_hash: result.txHash,
              block_number: result.blockNumber,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tx.id);

          // Track savings
          await trackSavings(tx, currentGas.standard, result.gasCostUSD || 0);

          // Send notification (will implement in next step)
          await sendNotification(tx, result);

          console.log(`   ✅ Transaction executed: ${result.txHash}`);
          executed++;
        } else {
          throw new Error(result.error || 'Unknown execution error');
        }

      } catch (error: any) {
        console.error(`   ❌ Failed to execute ${tx.id}:`, error.message);

        // Update retry count
        const newRetryCount = (tx.retry_count || 0) + 1;
        const maxRetries = 3;

        if (newRetryCount >= maxRetries) {
          // Mark as failed after max retries
          await supabase
            .from('scheduled_transactions')
            .update({
              status: 'failed',
              error_message: error.message,
              retry_count: newRetryCount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tx.id);
          console.log(`   ❌ Transaction failed after ${maxRetries} retries`);
        } else {
          // Mark as pending for retry
          await supabase
            .from('scheduled_transactions')
            .update({
              status: 'pending',
              error_message: error.message,
              retry_count: newRetryCount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tx.id);
          console.log(`   🔄 Will retry (attempt ${newRetryCount}/${maxRetries})`);
        }

        failed++;
      }
    }

    console.log('\n📊 EXECUTION SUMMARY:');
    console.log(`   ✅ Executed: ${executed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      executed,
      failed,
      skipped,
      total: pendingTxs.length,
    });

  } catch (error: any) {
    console.error('❌ [CRON] Fatal error:', error);

    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * Execute transaction on the appropriate chain
 */
async function executeTransaction(tx: any, currentGasPrice: number): Promise<{
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasCostUSD?: number;
  error?: string;
}> {
  try {
    // Import the chain-specific execution service
    const { executeScheduledTransaction } = await import('@/lib/transaction-executor');

    const result = await executeScheduledTransaction({
      chain: tx.chain,
      fromAddress: tx.from_address,
      toAddress: tx.to_address,
      amount: tx.amount,
      tokenAddress: tx.token_address,
      gasPrice: currentGasPrice,
    });

    return result;

  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Track savings for analytics
 */
async function trackSavings(tx: any, actualGasPrice: number, actualGasCostUSD: number) {
  try {
    const savings = tx.estimated_gas_cost_usd - actualGasCostUSD;
    const savingsPercentage = (savings / tx.estimated_gas_cost_usd) * 100;

    // Insert transaction savings record
    await supabase
      .from('transaction_savings')
      .insert({
        user_id: tx.user_id,
        supabase_user_id: tx.supabase_user_id,
        chain: tx.chain,
        transaction_hash: tx.transaction_hash || 'pending',
        gas_price_used: actualGasPrice,
        gas_cost_usd: actualGasCostUSD,
        baseline_gas_cost_usd: tx.estimated_gas_cost_usd,
        savings_usd: savings,
        savings_percentage: savingsPercentage,
        was_scheduled: true,
        scheduled_transaction_id: tx.id,
        optimal_timing: savings > 0,
      });

    // Update user aggregate stats (using stored procedure)
    await supabase.rpc('update_user_savings_stats', {
      p_user_id: tx.user_id,
      p_supabase_user_id: tx.supabase_user_id,
      p_chain: tx.chain,
      p_savings_usd: savings,
      p_was_scheduled: true,
    });

    console.log(`   💰 Tracked savings: $${savings.toFixed(2)} (${savingsPercentage.toFixed(1)}%)`);

  } catch (error: any) {
    console.error('   ⚠️  Failed to track savings:', error.message);
  }
}

/**
 * Send notification to user
 */
async function sendNotification(tx: any, result: any) {
  try {
    // Store notification in database for client to fetch
    await supabase
      .from('notifications')
      .insert({
        user_id: tx.user_id,
        type: 'transaction_executed',
        title: 'Smart Send Completed',
        message: `Your ${tx.amount} ${tx.token_symbol} transaction was sent successfully!`,
        data: {
          transaction_hash: result.txHash,
          chain: tx.chain,
          savings: tx.actual_savings_usd,
        },
        read: false,
      });

    console.log(`   📧 Notification queued`);

  } catch (error: any) {
    console.error('   ⚠️  Failed to send notification:', error.message);
  }
}

