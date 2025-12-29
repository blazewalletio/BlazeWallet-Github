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
 * EasyCron: every 5 minutes (migrated from Vercel Cron for better reliability)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { gasPriceService } from '@/lib/gas-price-service';
import { ethers } from 'ethers';
import { logger, secureLogger } from '@/lib/logger';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import { sanitizeErrorResponse } from '@/lib/error-handler';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Verify cron secret for security
const CRON_SECRET = (process.env.CRON_SECRET || 'dev-secret-change-in-production').trim();

export async function GET(req: NextRequest) {
  try {
    // Verify request is from Vercel Cron or has valid auth
    const authHeader = req.headers.get('authorization');
    const vercelCronHeader = req.headers.get('x-vercel-cron'); // Vercel adds this header to cron requests
    const vercelId = req.headers.get('x-vercel-id');
    const vercelDeploymentId = req.headers.get('x-vercel-deployment-id');
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    // Check if request is from Vercel Cron
    // Vercel cron jobs include the x-vercel-cron: 1 header
    const isFromVercel = !!(vercelId || vercelDeploymentId);
    const isVercelCron = vercelCronHeader === '1' || userAgent.includes('vercel-cron') || isFromVercel;
    const cronSecret = req.url.includes('CRON_SECRET=') ? new URL(req.url).searchParams.get('CRON_SECRET') : null;
    
    // ⚠️ DEPRECATED: Log warning if URL secret is used
    if (cronSecret && !authHeader) {
      logger.warn('⚠️ [SECURITY] CRON_SECRET in URL is deprecated. Use Authorization header instead.');
      logger.warn('   Update EasyCron to use: Authorization: Bearer {CRON_SECRET}');
    }
    
    // Detect cron source
    const isEasyCron = userAgent.includes('EasyCron') || userAgent.includes('curl') || userAgent.includes('python');
    
    // Debug logging
    logger.log('🔐 Auth check:', {
      userAgent,
      cronSource: isVercelCron ? 'vercel' : isEasyCron ? 'easycron' : 'unknown',
      vercelCronHeader: vercelCronHeader ? 'present' : 'missing',
      vercelId: vercelId ? 'present' : 'missing',
      vercelDeploymentId: vercelDeploymentId ? 'present' : 'missing',
      isFromVercel,
      isVercelCron,
      isEasyCron,
      hasAuthHeader: !!authHeader,
      hasCronSecret: !!cronSecret,
      cronSecretMatch: cronSecret === CRON_SECRET,
    });
    
    // Allow: Vercel Cron, EasyCron (via CRON_SECRET), Authorization header, or query param secret
    if (!isVercelCron && !isEasyCron && authHeader !== `Bearer ${CRON_SECRET}` && cronSecret !== CRON_SECRET) {
      logger.error('❌ Unauthorized cron attempt', {
        vercelCronHeader,
        vercelId: !!vercelId,
        vercelDeploymentId: !!vercelDeploymentId,
        userAgent,
        isVercelCron,
        hasAuthHeader: !!authHeader,
        hasCronSecret: !!cronSecret
      });
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'This endpoint can only be accessed by Vercel Cron or with valid authentication',
        debug: { 
          isFromVercel, 
          isVercelCron, 
          hasAuth: !!authHeader, 
          hasSecret: !!cronSecret,
          headers: {
            'x-vercel-cron': vercelCronHeader,
            'x-vercel-id': !!vercelId,
            'user-agent': userAgent
          }
        }
      }, { status: 401 });
    }

    // ✅ Rate limiting per IP (for cron endpoint)
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    // 20 requests per minute per IP (cron runs every 5 min, so 12/hour max)
    if (!apiRateLimiter.check(ipAddress, 20, 60000)) {
      logger.warn('⚠️ [Rate Limit] Cron endpoint rate limited:', ipAddress);
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    logger.log('\n========================================');
    logger.log('⏰ [CRON] SMART SEND EXECUTION JOB');
    logger.log('========================================');
    logger.log('🕐 Time:', new Date().toISOString());
    logger.log('🔔 Triggered by:', isVercelCron ? 'Vercel Cron' : isEasyCron ? 'EasyCron' : 'Manual/Unknown');

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

    logger.log(`📊 Found ${pendingTxs?.length || 0} pending transactions`);

    if (!pendingTxs || pendingTxs.length === 0) {
      logger.log('✅ No transactions to execute');
      logger.log('========================================\n');
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
        logger.log(`\n💫 Processing transaction ${tx.id}`);
        secureLogger.transaction(tx);

        // Check current gas price
        const currentGas = await gasPriceService.getGasPrice(tx.chain);
        logger.log(`   Current gas: ${currentGas.standard.toFixed(2)}`);

        // Check if gas is acceptable
        if (tx.optimal_gas_threshold && currentGas.standard > tx.optimal_gas_threshold) {
          logger.log(`   ⏭️  Skipping - gas too high (${currentGas.standard} > ${tx.optimal_gas_threshold})`);
          
          // Check if we should expire it
          const maxWaitReached = new Date() > new Date(tx.expires_at);
          if (maxWaitReached) {
            await supabase
              .from('scheduled_transactions')
              .update({ status: 'expired', updated_at: new Date().toISOString() })
              .eq('id', tx.id);
            logger.log(`   ⏱️  Transaction expired`);
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

          logger.log(`   ✅ Transaction executed: ${result.txHash}`);
          executed++;
        } else {
          throw new Error(result.error || 'Unknown execution error');
        }

      } catch (error: any) {
        // ✅ Enhanced error logging with full details
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        const errorStack = error?.stack || 'No stack trace';
        
        logger.error(`   ❌ Failed to execute ${tx.id}:`, {
          error: errorMessage,
          stack: errorStack,
          chain: tx.chain,
          amount: tx.amount,
          token_symbol: tx.token_symbol,
          has_encrypted_mnemonic: !!tx.encrypted_mnemonic,
          has_kms_key: !!tx.kms_encrypted_ephemeral_key,
          retry_count: tx.retry_count || 0,
        });

        // Update retry count
        const newRetryCount = (tx.retry_count || 0) + 1;
        const maxRetries = 3;

        // ✅ Store full error details (truncate if too long for database)
        const fullErrorMessage = errorMessage.length > 500 
          ? errorMessage.substring(0, 500) + '...' 
          : errorMessage;

        if (newRetryCount >= maxRetries) {
          // Mark as failed after max retries
          await supabase
            .from('scheduled_transactions')
            .update({
              status: 'failed',
              error_message: fullErrorMessage,
              retry_count: newRetryCount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tx.id);
          logger.log(`   ❌ Transaction failed after ${maxRetries} retries: ${fullErrorMessage}`);
        } else {
          // Mark as pending for retry
          await supabase
            .from('scheduled_transactions')
            .update({
              status: 'pending',
              error_message: fullErrorMessage,
              retry_count: newRetryCount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tx.id);
          logger.log(`   🔄 Will retry (attempt ${newRetryCount}/${maxRetries}): ${fullErrorMessage}`);
        }

        failed++;
      }
    }

    logger.log('\n📊 EXECUTION SUMMARY:');
    logger.log(`   ✅ Executed: ${executed}`);
    logger.log(`   ❌ Failed: ${failed}`);
    logger.log(`   ⏭️  Skipped: ${skipped}`);
    logger.log('========================================\n');

    return NextResponse.json({
      success: true,
      executed,
      failed,
      skipped,
      total: pendingTxs.length,
    });

  } catch (error: any) {
    logger.error('❌ [CRON] Fatal error:', error);
    return sanitizeErrorResponse(error);
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
    // ✅ SECURITY: Check if encrypted mnemonic exists
    if (!tx.encrypted_mnemonic || !tx.kms_encrypted_ephemeral_key) {
      throw new Error('Missing encrypted mnemonic. Transaction cannot be executed automatically.');
    }

    // Import the chain-specific execution service
    const { executeScheduledTransaction } = await import('@/lib/transaction-executor');

    const result = await executeScheduledTransaction({
      chain: tx.chain,
      fromAddress: tx.from_address,
      toAddress: tx.to_address,
      amount: tx.amount,
      tokenAddress: tx.token_address,
      gasPrice: currentGasPrice,
      
      // ✅ NEW: Pass encrypted mnemonic for KMS decryption
      encryptedMnemonic: tx.encrypted_mnemonic,
      kmsEncryptedEphemeralKey: tx.kms_encrypted_ephemeral_key,
    });

    // ✅ SECURITY: Delete encrypted keys after successful execution
    if (result.success) {
      await supabase
        .from('scheduled_transactions')
        .update({
          encrypted_mnemonic: null,
          kms_encrypted_ephemeral_key: null,
          key_deleted_at: new Date().toISOString(),
        })
        .eq('id', tx.id);
      logger.log(`   🔒 Encrypted keys deleted after execution`);
    }

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

    logger.log(`   💰 Tracked savings: $${savings.toFixed(2)} (${savingsPercentage.toFixed(1)}%)`);

  } catch (error: any) {
    logger.error('   ⚠️  Failed to track savings:', error.message);
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

    logger.log(`   📧 Notification queued`);

  } catch (error: any) {
    logger.error('   ⚠️  Failed to send notification:', error.message);
  }
}

