// ============================================================================
// 🔥 BLAZE WALLET - SMART SCHEDULER SERVICE
// ============================================================================
// Core service for scheduling transactions at optimal gas times
// ============================================================================

import { gasPriceService } from './gas-price-service';
import { priceService } from './price-service';
import { encryptForScheduling } from './scheduled-tx-encryption';
import { useWalletStore } from './wallet-store';
import { scheduledTxDebugLogger } from './scheduled-tx-debug-logger';

export interface ScheduledTransaction {
  id: string;
  user_id: string;
  supabase_user_id?: string;
  chain: string;
  from_address: string;
  to_address: string;
  amount: string;
  token_address?: string;
  token_symbol?: string;
  scheduled_for?: string;
  optimal_gas_threshold?: number;
  max_wait_hours: number;
  priority: 'low' | 'standard' | 'high' | 'instant';
  status: 'pending' | 'ready' | 'executing' | 'completed' | 'failed' | 'cancelled' | 'expired';
  created_at: string;
  updated_at: string;
  executed_at?: string;
  expires_at?: string;
  estimated_gas_price?: number;
  estimated_gas_cost_usd?: number;
  actual_gas_price?: number;
  actual_gas_cost_usd?: number;
  estimated_savings_usd?: number;
  actual_savings_usd?: number;
  transaction_hash?: string;
  error_message?: string;
  memo?: string;
}

export interface ScheduleOptions {
  user_id: string;
  supabase_user_id?: string;
  chain: string;
  from_address: string;
  to_address: string;
  amount: string;
  token_address?: string;
  token_symbol?: string;
  schedule_type: 'optimal' | 'specific_time' | 'gas_threshold';
  scheduled_for?: Date;
  optimal_gas_threshold?: number;
  max_wait_hours?: number;
  priority?: 'low' | 'standard' | 'high' | 'instant';
  memo?: string;
}

export interface SavingsStats {
  total_transactions: number;
  scheduled_transactions: number;
  total_savings_usd: number;
  average_savings_per_tx_usd: number;
  best_single_saving_usd: number;
  savings_per_chain: Record<string, number>;
}

class SmartSchedulerService {
  private baseUrl = '/api/smart-scheduler';

  /**
   * Schedule a new transaction
   */
  async scheduleTransaction(options: ScheduleOptions): Promise<ScheduledTransaction> {
    scheduledTxDebugLogger.log('SCHEDULE_START', 'scheduleTransaction called', { options });
    
    try {
      // 🔐 CRITICAL: Get mnemonic from unlocked wallet
      const { wallet } = useWalletStore.getState();
      
      scheduledTxDebugLogger.log('SCHEDULE_STEP', 'Wallet store accessed', { 
        hasWallet: !!wallet,
        hasMnemonic: !!(wallet?.mnemonic),
      });
      
      if (!wallet || !wallet.mnemonic) {
        scheduledTxDebugLogger.log('SCHEDULE_ERROR', 'Wallet locked', { error: 'Wallet locked - please unlock first' });
        throw new Error('Wallet locked - please unlock first');
      }

      const mnemonic = wallet.mnemonic.phrase;
      
      if (!mnemonic || mnemonic.split(' ').length < 12) {
        scheduledTxDebugLogger.log('SCHEDULE_ERROR', 'Invalid mnemonic', { error: 'Invalid wallet mnemonic' });
        throw new Error('Invalid wallet mnemonic');
      }

      scheduledTxDebugLogger.log('SCHEDULE_STEP', 'Wallet unlocked - proceeding with encryption', {});
      console.log('✅ Wallet unlocked - proceeding with encryption');

      // Get current gas price for savings estimation
      scheduledTxDebugLogger.log('SCHEDULE_STEP', 'Fetching current gas price', { chain: options.chain });
      const currentGasData = await gasPriceService.getGasPrice(options.chain);
      const currentGasPrice = currentGasData?.standard || 0;
      scheduledTxDebugLogger.log('SCHEDULE_STEP', 'Gas price fetched', { 
        chain: options.chain,
        gasPrice: currentGasPrice,
      });

      // Calculate current gas cost in USD
      let currentGasCostUSD = 0;
      try {
        // ✅ FIX: Use correct currency SYMBOLS (not chain names)
        const currencySymbol = 
          options.chain === 'solana' ? 'SOL' :
          options.chain === 'bitcoin' ? 'BTC' :
          options.chain === 'ethereum' ? 'ETH' :
          options.chain === 'polygon' ? 'MATIC' :
          options.chain === 'avalanche' ? 'AVAX' :
          options.chain === 'bsc' ? 'BNB' :
          options.chain === 'fantom' ? 'FTM' :
          options.chain === 'cronos' ? 'CRO' :
          options.chain === 'litecoin' ? 'LTC' :
          options.chain === 'dogecoin' ? 'DOGE' :
          options.chain === 'bitcoincash' ? 'BCH' :
          'ETH'; // Fallback for all other EVM chains (Arbitrum, Optimism, Base, etc. use ETH)
        
        const nativePrice = await priceService.getPrice(currencySymbol);

        if (options.chain === 'solana') {
          // ✅ FIX: Correct Solana USD calculation (lamports → SOL → USD)
          currentGasCostUSD = (currentGasPrice / 1_000_000_000) * nativePrice;
        } else if (options.chain.includes('bitcoin') || options.chain === 'litecoin' || options.chain === 'dogecoin' || options.chain === 'bitcoincash') {
          currentGasCostUSD = ((currentGasPrice * 250) / 100_000_000) * nativePrice;
        } else {
          // EVM chains
          currentGasCostUSD = ((21000 * currentGasPrice) / 1e9) * nativePrice;
        }
      } catch (e) {
        console.error('Failed to calculate gas cost:', e);
      }

      // Calculate expiry time
      const maxWaitHours = options.max_wait_hours || 24;
      const scheduledTime = options.scheduled_for || new Date();
      const expiresAt = new Date(scheduledTime.getTime() + maxWaitHours * 60 * 60 * 1000);

      // 🔐 Encrypt mnemonic for time-limited storage
      scheduledTxDebugLogger.log('SCHEDULE_STEP', 'Encrypting authorization', { expiresAt: expiresAt.toISOString() });
      console.log('🔐 Encrypting authorization...');
      const encryptedAuth = await encryptForScheduling(mnemonic, expiresAt);
      scheduledTxDebugLogger.log('SCHEDULE_STEP', 'Authorization encrypted successfully', { 
        encryptedAuthLength: JSON.stringify(encryptedAuth).length,
        ciphertextLength: encryptedAuth.ciphertext.length,
      });
      console.log('✅ Authorization encrypted successfully');

      // Get supabase_user_id from localStorage if available
      const supabaseUserId = typeof window !== 'undefined' 
        ? localStorage.getItem('supabase_user_id') 
        : null;

      const requestBody = {
        ...options,
        supabase_user_id: supabaseUserId || undefined,
        scheduled_for: scheduledTime.toISOString(),
        current_gas_price: currentGasPrice,
        current_gas_cost_usd: currentGasCostUSD,
        encrypted_auth: '[REDACTED]', // Don't log encrypted auth
      };

      scheduledTxDebugLogger.log('SCHEDULE_STEP', 'Sending API request', {
        url: `${this.baseUrl}/create`,
        method: 'POST',
        body: requestBody,
      });

      const response = await fetch(`${this.baseUrl}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...options,
          supabase_user_id: supabaseUserId || undefined,
          scheduled_for: scheduledTime.toISOString(),
          current_gas_price: currentGasPrice,
          current_gas_cost_usd: currentGasCostUSD,
          encrypted_auth: encryptedAuth,
        }),
      });

      scheduledTxDebugLogger.log('SCHEDULE_STEP', 'API response received', {
        status: response.status,
        statusText: response.statusText,
      });

      const data = await response.json();

      scheduledTxDebugLogger.log('SCHEDULE_STEP', 'API response parsed', {
        success: data.success,
        hasData: !!data.data,
        error: data.error,
      });

      if (!response.ok) {
        scheduledTxDebugLogger.log('SCHEDULE_ERROR', 'API request failed', {
          status: response.status,
          error: data.error,
          details: data,
        });
        console.error('❌ Schedule transaction error:', data);
        throw new Error(data.error || 'Failed to create scheduled transaction');
      }

      scheduledTxDebugLogger.log('SCHEDULE_SUCCESS', 'Transaction scheduled successfully', {
        transactionId: data.data?.id,
        scheduledFor: data.data?.scheduled_for,
        chain: data.data?.chain,
      });

      console.log('✅ Transaction scheduled successfully');
      return data.data;
    } catch (error: any) {
      scheduledTxDebugLogger.log('SCHEDULE_ERROR', 'Schedule transaction failed', {
        error: error.message,
        stack: error.stack,
      }, error);
      console.error('❌ Failed to schedule transaction:', error);
      throw error;
    }
  }

  /**
   * Get all scheduled transactions for a user
   */
  async getScheduledTransactions(
    userId: string,
    chain?: string,
    status: string = 'pending'
  ): Promise<ScheduledTransaction[]> {
    scheduledTxDebugLogger.log('FETCH_START', 'getScheduledTransactions called', {
      userId,
      chain: chain || 'all chains',
      status,
    });

    console.log('\n🔍 [SmartScheduler] getScheduledTransactions called');
    console.log('   userId:', userId);
    console.log('   chain:', chain || 'all chains');
    console.log('   status:', status);
    
    try {
      const params = new URLSearchParams({
        user_id: userId,
        status,
      });

      if (chain) {
        params.append('chain', chain);
      }

      const url = `${this.baseUrl}/list?${params.toString()}`;
      scheduledTxDebugLogger.log('FETCH_STEP', 'Building API URL', { url });
      console.log('📡 [SmartScheduler] Fetching from:', url);
      
      const response = await fetch(url);
      scheduledTxDebugLogger.log('FETCH_STEP', 'API response received', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });
      console.log('📥 [SmartScheduler] Response status:', response.status, response.statusText);
      
      const data = await response.json();
      scheduledTxDebugLogger.log('FETCH_STEP', 'API response parsed', {
        success: data.success,
        count: data.count,
        has_data: data.data?.length > 0,
        transaction_ids: data.data?.map((tx: any) => tx.id) || [],
      });
      console.log('📦 [SmartScheduler] Response data:', {
        success: data.success,
        count: data.count,
        has_data: data.data?.length > 0,
        data_sample: data.data?.slice(0, 2)
      });

      if (!response.ok) {
        scheduledTxDebugLogger.log('FETCH_ERROR', 'API request failed', {
          status: response.status,
          error: data.error,
          details: data,
        }, data);
        console.error('❌ [SmartScheduler] API error:', data.error);
        throw new Error(data.error || 'Failed to fetch scheduled transactions');
      }

      scheduledTxDebugLogger.log('FETCH_SUCCESS', 'Transactions fetched successfully', {
        count: data.data.length,
        transactions: data.data.map((tx: any) => ({
          id: tx.id,
          chain: tx.chain,
          status: tx.status,
          scheduled_for: tx.scheduled_for,
          amount: tx.amount,
          token_symbol: tx.token_symbol,
        })),
      });

      console.log('✅ [SmartScheduler] Returning', data.data.length, 'transaction(s)\n');
      return data.data;
    } catch (error: any) {
      scheduledTxDebugLogger.log('FETCH_ERROR', 'Failed to fetch scheduled transactions', {
        error: error.message,
        stack: error.stack,
      }, error);
      console.error('❌ [SmartScheduler] Failed to fetch scheduled transactions:', error);
      console.error('   Error details:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Cancel a scheduled transaction
   */
  async cancelTransaction(transactionId: string, userId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transactionId,
          user_id: userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel transaction');
      }
    } catch (error: any) {
      console.error('❌ Failed to cancel transaction:', error);
      throw error;
    }
  }

  /**
   * Get savings statistics for a user
   */
  async getSavingsStats(userId: string): Promise<{
    stats: SavingsStats;
    recent_savings: any[];
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/savings?user_id=${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch savings stats');
      }

      return {
        stats: data.stats,
        recent_savings: data.recent_savings,
      };
    } catch (error: any) {
      console.error('❌ Failed to fetch savings stats:', error);
      throw error;
    }
  }

  /**
   * Calculate optimal gas timing for a chain using AI + historical data
   * Returns recommended execution time and estimated savings
   * Only recommends if 95%+ confident
   */
  async calculateOptimalTiming(chain: string, maxWaitHours: number = 24): Promise<{
    optimal_time: Date;
    current_gas_price: number;
    predicted_optimal_gas: number;
    estimated_savings_percent: number;
    estimated_savings_usd: number;
    confidence_score: number;
    reasoning: string;
    should_execute_now: boolean;
    alternative_times?: Array<{
      time: Date;
      gas_price: number;
      savings_percent: number;
    }>;
  }> {
    try {
      // Get current gas price
      const currentGasData = await gasPriceService.getGasPrice(chain);
      const currentGas = currentGasData?.standard || 0;

      if (!currentGas) {
        throw new Error('Failed to fetch current gas price');
      }

      console.log('🤖 Requesting AI prediction for', chain, 'current gas:', currentGas);

      // Call AI prediction API
      const response = await fetch('/api/smart-scheduler/predict-optimal-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain,
          current_gas_price: currentGas,
          max_wait_hours: maxWaitHours,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ AI prediction failed:', data);
        throw new Error(data.error || 'Failed to predict optimal time');
      }

      const prediction = data.data;

      console.log('✅ AI prediction received:', {
        optimal_time: prediction.optimal_time,
        confidence: prediction.confidence_score,
        savings: prediction.estimated_savings_percent,
      });

      // Check if we should execute now (low confidence or current gas is already optimal)
      const should_execute_now = prediction.confidence_score < 95 || 
                                   prediction.estimated_savings_percent < 5;

      return {
        optimal_time: new Date(prediction.optimal_time),
        current_gas_price: currentGas,
        predicted_optimal_gas: prediction.predicted_gas_price,
        estimated_savings_percent: prediction.estimated_savings_percent,
        estimated_savings_usd: prediction.estimated_savings_usd,
        confidence_score: prediction.confidence_score,
        reasoning: prediction.reasoning,
        should_execute_now,
        alternative_times: prediction.alternative_times?.map((alt: any) => ({
          time: new Date(alt.time),
          gas_price: alt.gas_price,
          savings_percent: alt.savings_percent,
        })),
      };
    } catch (error) {
      console.error('❌ Failed to calculate optimal timing:', error);
      
      // Fallback: recommend executing now if prediction fails
      const currentGasData = await gasPriceService.getGasPrice(chain);
      const currentGas = currentGasData?.standard || 0;
      
      return {
        optimal_time: new Date(),
        current_gas_price: currentGas,
        predicted_optimal_gas: currentGas,
        estimated_savings_percent: 0,
        estimated_savings_usd: 0,
        confidence_score: 0,
        reasoning: 'Unable to predict optimal time. Recommend executing now.',
        should_execute_now: true,
      };
    }
  }

  /**
   * Format gas price for display
   */
  formatGasPrice(gasPrice: number, chain: string): string {
    if (chain === 'solana') {
      return `${gasPrice.toFixed(0)} lamports`;
    } else if (chain.includes('bitcoin') || chain === 'litecoin' || chain === 'dogecoin') {
      return `${gasPrice.toFixed(0)} sat/vB`;
    } else {
      // EVM chains
      return `${gasPrice.toFixed(2)} gwei`;
    }
  }

  /**
   * Estimate transaction cost in USD
   */
  async estimateTransactionCost(
    chain: string,
    gasPrice: number
  ): Promise<number> {
    try {
      // Get correct currency symbol
      const currencySymbol = 
        chain === 'solana' ? 'SOL' :
        chain === 'bitcoin' ? 'BTC' :
        chain === 'ethereum' ? 'ETH' :
        chain === 'polygon' ? 'MATIC' :
        chain === 'avalanche' ? 'AVAX' :
        chain === 'bsc' ? 'BNB' :
        chain === 'fantom' ? 'FTM' :
        chain === 'cronos' ? 'CRO' :
        chain === 'litecoin' ? 'LTC' :
        chain === 'dogecoin' ? 'DOGE' :
        chain === 'bitcoincash' ? 'BCH' :
        'ETH'; // Fallback for all other EVM chains (Arbitrum, Optimism, Base, etc. use ETH)
      
      const nativePrice = await priceService.getPrice(currencySymbol);

      if (chain === 'solana') {
        // Solana gas is already in lamports, just convert to SOL
        return (gasPrice / 1_000_000_000) * nativePrice;
      } else if (chain.includes('bitcoin') || chain === 'litecoin' || chain === 'dogecoin' || chain === 'bitcoincash') {
        // Bitcoin-like: sat/vB * average tx size (250 bytes) → BTC → USD
        return ((gasPrice * 250) / 100_000_000) * nativePrice;
      } else {
        // EVM chains: gwei * gas limit (21000) → ETH/MATIC/BNB/etc → USD
        return ((21000 * gasPrice) / 1e9) * nativePrice;
      }
    } catch (error) {
      console.error('❌ Failed to estimate transaction cost:', error);
      return 0;
    }
  }
}

export const smartSchedulerService = new SmartSchedulerService();

