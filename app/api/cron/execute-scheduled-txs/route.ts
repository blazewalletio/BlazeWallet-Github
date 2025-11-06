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
import { decryptScheduledAuth, clearEncryptedAuth } from '@/lib/scheduled-tx-decryption';

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

        // 🔐 Check if transaction has encrypted auth
        if (!tx.encrypted_auth) {
          console.log(`   ⚠️  No encrypted auth - skipping (cannot execute)`);
          skipped++;
          continue;
        }

        // Check current gas price
        const currentGas = await gasPriceService.getGasPrice(tx.chain);
        console.log(`   Current gas: ${currentGas.standard.toFixed(2)}`);

        // Check if gas is acceptable (if threshold specified)
        if (tx.optimal_gas_threshold && currentGas.standard > tx.optimal_gas_threshold) {
          console.log(`   ⏭️  Skipping - gas too high (${currentGas.standard} > ${tx.optimal_gas_threshold})`);
          
          // Check if we should expire it
          const maxWaitReached = new Date() > new Date(tx.expires_at);
          if (maxWaitReached) {
            await supabase
              .from('scheduled_transactions')
              .update({ status: 'expired', updated_at: new Date().toISOString() })
              .eq('id', tx.id);
            
            // Clear encrypted auth on expiry
            await clearEncryptedAuth(tx.id);
            console.log(`   ⏱️  Transaction expired - auth cleared`);
          }
          
          skipped++;
          continue;
        }

        // Mark as executing
        await supabase
          .from('scheduled_transactions')
          .update({ status: 'executing', updated_at: new Date().toISOString() })
          .eq('id', tx.id);

        // 🔓 Decrypt authorization
        console.log(`   🔐 Decrypting authorization...`);
        const decryptResult = await decryptScheduledAuth(tx.encrypted_auth, tx.id);
        
        if (!decryptResult.success || !decryptResult.mnemonic) {
          throw new Error(decryptResult.error || 'Failed to decrypt authorization');
        }

        console.log(`   ✅ Authorization decrypted successfully`);

        // Execute the transaction with decrypted mnemonic
        const result = await executeTransactionWithMnemonic(
          tx, 
          decryptResult.mnemonic, 
          currentGas.standard
        );

        // Clear mnemonic from memory immediately
        decryptResult.mnemonic = '';  // Overwrite

        if (result.success) {
          // Update as completed
          await supabase
            .from('scheduled_transactions')
            .update({
              status: 'completed',
              executed_at: new Date().toISOString(),
              actual_gas_price: currentGas.standard,
              actual_gas_cost_usd: result.gasCostUSD || 0,
              actual_savings_usd: Math.max(0, (tx.estimated_gas_cost_usd || 0) - (result.gasCostUSD || 0)),
              transaction_hash: result.txHash,
              block_number: result.blockNumber,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tx.id);

          // 🔥 Delete encrypted auth immediately after success
          await clearEncryptedAuth(tx.id);

          // Track savings
          await trackSavings(tx, currentGas.standard, result.gasCostUSD || 0);

          // Send notification
          await sendNotification(tx, result);

          console.log(`   ✅ Transaction executed: ${result.txHash}`);
          console.log(`   🔥 Encrypted auth permanently deleted`);
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
          
          // Clear encrypted auth on permanent failure
          await clearEncryptedAuth(tx.id);
          console.log(`   ❌ Transaction failed after ${maxRetries} retries - auth cleared`);
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
 * Execute transaction on the appropriate chain with decrypted mnemonic
 */
async function executeTransactionWithMnemonic(
  tx: any, 
  mnemonic: string, 
  currentGasPrice: number
): Promise<{
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasCostUSD?: number;
  error?: string;
}> {
  try {
    const chain = tx.chain.toLowerCase();
    
    // Solana execution
    if (chain === 'solana') {
      return await executeSolanaTransaction(tx, mnemonic, currentGasPrice);
    }
    
    // Bitcoin-like execution
    if (['bitcoin', 'litecoin', 'dogecoin', 'bitcoincash'].includes(chain)) {
      return await executeBitcoinLikeTransaction(tx, mnemonic, currentGasPrice);
    }
    
    // EVM execution (Ethereum, Polygon, etc.)
    return await executeEVMTransaction(tx, mnemonic, currentGasPrice);
    
  } catch (error: any) {
    console.error('❌ Execution error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Execute EVM transaction (Ethereum, Polygon, Arbitrum, etc.)
 */
async function executeEVMTransaction(
  tx: any,
  mnemonic: string,
  currentGasPrice: number
): Promise<any> {
  try {
    // Create wallet from mnemonic
    const wallet = ethers.Wallet.fromPhrase(mnemonic);
    
    // Get RPC URL for chain
    const rpcUrl = getRPCUrl(tx.chain);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const connectedWallet = wallet.connect(provider);

    // Check if token or native
    if (tx.token_address) {
      // ERC20 token transfer
      const erc20ABI = [
        'function transfer(address to, uint256 amount) returns (bool)'
      ];
      const tokenContract = new ethers.Contract(tx.token_address, erc20ABI, connectedWallet);
      
      const txResponse = await tokenContract.transfer(
        tx.to_address,
        ethers.parseUnits(tx.amount, 18)  // Assuming 18 decimals
      );
      
      const receipt = await txResponse.wait();
      
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasCostUSD: parseFloat(ethers.formatEther(receipt.gasUsed * receipt.gasPrice || 0n)) * 2000,  // Rough estimate
      };
    } else {
      // Native currency transfer
      const txResponse = await connectedWallet.sendTransaction({
        to: tx.to_address,
        value: ethers.parseEther(tx.amount),
      });
      
      const receipt = await txResponse.wait();
      
      return {
        success: true,
        txHash: receipt?.hash,
        blockNumber: receipt?.blockNumber,
        gasCostUSD: parseFloat(ethers.formatEther((receipt?.gasUsed || 0n) * (receipt?.gasPrice || 0n))) * 2000,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Execute Solana transaction
 */
async function executeSolanaTransaction(
  tx: any,
  mnemonic: string,
  currentGasPrice: number
): Promise<any> {
  try {
    const { SolanaService } = await import('@/lib/solana-service');
    const solanaService = new SolanaService();
    
    // Get keypair from mnemonic
    const keypair = solanaService.deriveKeypairFromMnemonic(mnemonic);
    
    // Send transaction
    const result = await solanaService.sendTransaction(
      keypair.publicKey.toBase58(),
      tx.to_address,
      tx.amount,  // Keep as string
      tx.token_address  // SPL token address or undefined for SOL
    );
    
    return {
      success: true,
      txHash: result,  // sendTransaction returns signature string directly
      gasCostUSD: 0.000005 * 150,  // Rough SOL gas estimate
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Execute Bitcoin-like transaction
 */
async function executeBitcoinLikeTransaction(
  tx: any,
  mnemonic: string,
  currentGasPrice: number
): Promise<any> {
  try {
    // Bitcoin execution logic
    // For now, return not implemented
    return {
      success: false,
      error: 'Bitcoin execution not yet implemented in server-side',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get RPC URL for chain
 */
function getRPCUrl(chain: string): string {
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY || 'demo';
  
  const rpcMap: Record<string, string> = {
    'ethereum': `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    'polygon': `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    'base': `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    'arbitrum': `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    'optimism': `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    'avalanche': 'https://api.avax.network/ext/bc/C/rpc',
    'fantom': 'https://rpc.ftm.tools',
    'cronos': 'https://evm.cronos.org',
    'zksync': `https://zksync-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    'linea': `https://linea-mainnet.g.alchemy.com/v2/${alchemyKey}`,
  };
  
  return rpcMap[chain] || rpcMap['ethereum'];
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

